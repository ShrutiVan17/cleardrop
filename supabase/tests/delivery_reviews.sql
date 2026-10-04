-- Run after the migration in the SQL Editor as postgres. Every fixture rolls back.
begin;
insert into auth.users (id) values ('0a000000-0000-4000-8000-000000000101'), ('0a000000-0000-4000-8000-000000000102');
set local role authenticated;
select set_config('request.jwt.claim.sub','0a000000-0000-4000-8000-000000000101',true);
insert into public.delivery_reviews (id,owner_id,source,cause,phase,view_state,version,created_at_ms,updated_at_ms,alert)
values ('0a000000-0000-4000-8000-000000000201','0a000000-0000-4000-8000-000000000101','ring','viewer-report','needs-review','concern',1,1000,1000,'not-requested');
do $$ begin
  if (select count(*) from public.delivery_reviews) <> 1 then raise exception 'Owner cannot read its fixture'; end if;
  begin
    insert into public.delivery_reviews (id,owner_id,source,cause,phase,view_state,version,created_at_ms,updated_at_ms,alert)
    values ('0a000000-0000-4000-8000-000000000202','0a000000-0000-4000-8000-000000000102','ring','scene-change','needs-review','concern',1,1000,1000,'not-requested');
    raise exception 'Foreign owner insert was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','0a000000-0000-4000-8000-000000000102',true);
do $$ declare affected integer; begin
  if (select count(*) from public.delivery_reviews) <> 0 then raise exception 'Foreign review was visible'; end if;
  update public.delivery_reviews set view_state='unknown',version=2 where id='0a000000-0000-4000-8000-000000000201';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign update was allowed'; end if;
  delete from public.delivery_reviews where id='0a000000-0000-4000-8000-000000000201';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign deletion was allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','0a000000-0000-4000-8000-000000000101',true);
do $$ declare blocked boolean := false; begin
  begin
    update public.delivery_reviews set version=3 where id='0a000000-0000-4000-8000-000000000201';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Skipped version was allowed'; end if;
  blocked := false;
  begin
    update public.delivery_reviews set phase='resolved',version=2,acknowledged_at_ms=1001,resolved_at_ms=1002,updated_at_ms=1002
    where id='0a000000-0000-4000-8000-000000000201';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Skipped acknowledgement was allowed'; end if;
  blocked := false;
  begin
    update public.delivery_reviews set cause='scene-change',version=2 where id='0a000000-0000-4000-8000-000000000201';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Human report downgrade was allowed'; end if;
end $$;
update public.delivery_reviews set phase='acknowledged',version=2,acknowledged_at_ms=1100,updated_at_ms=1100 where id='0a000000-0000-4000-8000-000000000201';
update public.delivery_reviews set phase='checking-removal',version=3,updated_at_ms=1200 where id='0a000000-0000-4000-8000-000000000201';
update public.delivery_reviews set phase='resolved',view_state='reference-restored',version=4,resolved_at_ms=1300,updated_at_ms=1300 where id='0a000000-0000-4000-8000-000000000201';
do $$ declare blocked boolean := false; begin
  if (select phase from public.delivery_reviews where id='0a000000-0000-4000-8000-000000000201') <> 'resolved' then raise exception 'Legal resolution failed'; end if;
  begin
    update public.delivery_reviews set phase='needs-review',version=5,acknowledged_at_ms=null,resolved_at_ms=null where id='0a000000-0000-4000-8000-000000000201';
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Closed review was reopened'; end if;
end $$;
delete from public.delivery_reviews where id='0a000000-0000-4000-8000-000000000201';
do $$ begin if (select count(*) from public.delivery_reviews) <> 0 then raise exception 'Owner deletion failed'; end if; end $$;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.delivery_reviews;
    raise exception 'Anonymous select was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner CRUD, owner isolation, anonymous denial, consecutive versions, legal transitions, immutable human evidence and closed-state guard' as verification;
rollback;
