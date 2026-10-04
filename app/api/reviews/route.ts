import { NextResponse } from 'next/server'
import { accountClient, accountEnabled } from '@/lib/account-auth'
import { readSmallJson, sameSiteWrite } from '@/lib/account-policy'
import { reviewMetadata, validReviewReplacement, DeliveryReview } from '@/lib/delivery-review'
import { createAccountLimiter } from '@/lib/account-rate-limit'

const allowWrite = createAccountLimiter(Date.now,{ global:240, perKey:40 })
const columns = 'id,source,cause,phase,view_state,version,created_at_ms,updated_at_ms,acknowledged_at_ms,resolved_at_ms,alert'
type Row = { id:string; source:string; cause:string; phase:string; view_state:string; version:number; created_at_ms:number; updated_at_ms:number; acknowledged_at_ms:number|null; resolved_at_ms:number|null; alert:string }
function fromRow(row: Row) {
  return reviewMetadata({ id:row.id, source:row.source, cause:row.cause, phase:row.phase, view:row.view_state,
    version:row.version, createdAt:row.created_at_ms, updatedAt:row.updated_at_ms, acknowledgedAt:row.acknowledged_at_ms, resolvedAt:row.resolved_at_ms, alert:row.alert })
}
function toRow(r: DeliveryReview, ownerId: string) {
  return { id:r.id, owner_id:ownerId, source:r.source, cause:r.cause, phase:r.phase, view_state:r.view, version:r.version,
    created_at_ms:r.createdAt, updated_at_ms:r.updatedAt, acknowledged_at_ms:r.acknowledgedAt, resolved_at_ms:r.resolvedAt, alert:r.alert }
}
function reply(body: unknown, status = 200) { return NextResponse.json(body,{ status, headers:{ 'Cache-Control':'private, no-store' } }) }
async function identity(request: Request) {
  if (!accountEnabled()) return null
  const client = accountClient(request), { data, error } = await client.auth.getUser()
  return !error && data.user?.email_confirmed_at ? { client, ownerId:data.user.id } : null
}
function unavailable(code?: string) {
  return reply({ error: ['42P01','PGRST205'].includes(code || '') ? 'Private review storage is not installed.' : 'Review storage is unavailable. Your local review remains open.' }, 503)
}
export async function GET(request: Request) {
  try {
    const user = await identity(request)
    if (!user) return reply({ error:'Sign in to view private reviews.' },401)
    const { data, error } = await user.client.from('delivery_reviews').select(columns).eq('owner_id',user.ownerId).order('updated_at_ms',{ ascending:false }).limit(20)
    if (error) return unavailable(error.code)
    return reply({ reviews:(data as Row[]).map(fromRow), kind:'user-reported-metadata' })
  } catch { return unavailable() }
}
export async function PUT(request: Request) {
  if (!sameSiteWrite(request)) return reply({ error:'Cross-site request blocked.' },403)
  try {
    const user = await identity(request)
    if (!user) return reply({ error:'Sign in to save private reviews.' },401)
    if (!allowWrite(user.ownerId)) return reply({ error:'Too many review writes. Wait a minute and retry.' },429)
    let review: DeliveryReview
    try { review = reviewMetadata((await readSmallJson(request)).review) } catch { return reply({ error:'Invalid review metadata.' },400) }
    if (!['ring','phone'].includes(review.source)) return reply({ error:'Generated demonstrations are never saved to accounts.' },400)
    if (review.updatedAt > Date.now() + 300000) return reply({ error:'Check your device clock.' },400)
    const { data: previousRow, error: readError } = await user.client.from('delivery_reviews').select(columns).eq('owner_id',user.ownerId).eq('id',review.id).maybeSingle()
    if (readError) return unavailable(readError.code)
    const previous = previousRow ? fromRow(previousRow as Row) : null
    // Retrying a completed identical write is safe; mismatched content is not.
    if (previous?.version === review.version) {
      return JSON.stringify(previous) === JSON.stringify(review) ? reply({ review:previous }) : reply({ error:'Review changed elsewhere. Reload before continuing.' },409)
    }
    if (!previous) {
      if (review.version !== 1 || review.phase !== 'needs-review') return reply({ error:'Create the initial review before sending updates.' },409)
      const { error } = await user.client.from('delivery_reviews').insert(toRow(review,user.ownerId))
      if (error) return error.code === '23505' ? reply({ error:'Review changed elsewhere. Reload before continuing.' },409) : unavailable(error.code)
    } else {
      if (!validReviewReplacement(previous,review)) return reply({ error:'Review changed elsewhere or the transition is invalid. Reload before continuing.' },409)
      const { data, error } = await user.client.from('delivery_reviews').update(toRow(review,user.ownerId)).eq('owner_id',user.ownerId).eq('id',review.id).eq('version',previous.version).select('id')
      if (error) return unavailable(error.code)
      if (!data?.length) return reply({ error:'Review changed elsewhere. Reload before continuing.' },409)
    }
    return reply({ review })
  } catch { return unavailable() }
}
export async function DELETE(request: Request) {
  if (!sameSiteWrite(request)) return reply({ error:'Cross-site request blocked.' },403)
  try {
    const user = await identity(request)
    if (!user) return reply({ error:'Sign in to manage private reviews.' },401)
    const { confirmDelete } = await readSmallJson(request)
    if (confirmDelete !== true) return reply({ error:'Explicit deletion confirmation is required.' },400)
    const { error } = await user.client.from('delivery_reviews').delete().eq('owner_id',user.ownerId).eq('phase','resolved')
    return error ? unavailable(error.code) : reply({ deleted:'resolved-reviews-only' })
  } catch { return unavailable() }
}
