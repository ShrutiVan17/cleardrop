begin;

create table public.delivery_reviews (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('ring','phone')),
  cause text not null check (cause in ('scene-change','viewer-report')),
  phase text not null check (phase in ('needs-review','acknowledged','checking-removal','resolved')),
  view_state text not null check (view_state in ('concern','reference-restored','unknown')),
  version integer not null check (version between 1 and 100000),
  created_at_ms bigint not null check (created_at_ms >= 0),
  updated_at_ms bigint not null check (updated_at_ms >= created_at_ms),
  acknowledged_at_ms bigint,
  resolved_at_ms bigint,
  alert text not null check (alert in ('not-requested','presented','denied','unsupported','failed')),
  received_at timestamptz not null default now(),
  check ((phase = 'needs-review') = (acknowledged_at_ms is null)),
  check ((phase = 'resolved') = (resolved_at_ms is not null)),
  check (acknowledged_at_ms is null or acknowledged_at_ms between created_at_ms and updated_at_ms),
  check (resolved_at_ms is null or resolved_at_ms between acknowledged_at_ms and updated_at_ms)
);
create index delivery_reviews_owner_updated on public.delivery_reviews(owner_id, updated_at_ms desc);
alter table public.delivery_reviews enable row level security;
revoke all on public.delivery_reviews from anon, authenticated;
grant select, insert, update, delete on public.delivery_reviews to authenticated;
create policy review_owner_select on public.delivery_reviews for select to authenticated using ((select auth.uid()) = owner_id);
create policy review_owner_insert on public.delivery_reviews for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy review_owner_update on public.delivery_reviews for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy review_owner_delete on public.delivery_reviews for delete to authenticated using ((select auth.uid()) = owner_id);

create function public.guard_delivery_review() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_at_ms > extract(epoch from clock_timestamp()) * 1000 + 300000 or new.updated_at_ms > extract(epoch from clock_timestamp()) * 1000 + 300000 then
    raise exception 'Review timestamp is in the future';
  end if;
  if TG_OP = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
    if (select count(*) from public.delivery_reviews where owner_id = new.owner_id) >= 200 then raise exception 'Review history limit reached'; end if;
    if new.phase <> 'needs-review' or new.version <> 1 or new.acknowledged_at_ms is not null or new.resolved_at_ms is not null then raise exception 'Reviews must start awaiting review'; end if;
  else
    if new.id <> old.id or new.owner_id <> old.owner_id or new.source <> old.source or new.created_at_ms <> old.created_at_ms or new.version <> old.version + 1 then raise exception 'Review identity or version changed'; end if;
    if new.updated_at_ms < old.updated_at_ms or (old.cause = 'viewer-report' and new.cause <> 'viewer-report') or
      (old.acknowledged_at_ms is not null and new.acknowledged_at_ms is distinct from old.acknowledged_at_ms) then raise exception 'Review history cannot be rewritten'; end if;
    if not ((old.phase = 'needs-review' and new.phase in ('needs-review','acknowledged')) or
      (old.phase = 'acknowledged' and new.phase in ('acknowledged','checking-removal')) or
      (old.phase = 'checking-removal' and new.phase in ('checking-removal','resolved'))) then raise exception 'Invalid review transition'; end if;
  end if;
  new.received_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.guard_delivery_review() from public;
create trigger guard_delivery_review before insert or update on public.delivery_reviews for each row execute function public.guard_delivery_review();

comment on table public.delivery_reviews is 'User-reported review metadata only. No video, device identifiers or credentials. Not authenticated sensor evidence.';
commit;
