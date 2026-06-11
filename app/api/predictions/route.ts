import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { predictions } = await req.json()
  // predictions = [{ match_id, home_score, away_score }, ...]

  if (!predictions?.length) {
    return NextResponse.json({ error: 'No predictions provided' }, { status: 400 })
  }

  // Verify deadline hasn't passed for these matches
  const matchIds = predictions.map((p: any) => p.match_id)

  const { data: matches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, kickoff_utc, et_date')
    .in('id', matchIds)

  if (matchError || !matches?.length) {
    return NextResponse.json({ error: 'Matches not found' }, { status: 404 })
  }

  // Deadline = 1 hour before the earliest kickoff of the day
  const earliest = matches.reduce((a, b) =>
    new Date(a.kickoff_utc) < new Date(b.kickoff_utc) ? a : b
  )
  const deadline = new Date(new Date(earliest.kickoff_utc).getTime() - 60 * 60 * 1000)

  if (new Date() > deadline) {
    return NextResponse.json({ error: 'Deadline passed' }, { status: 403 })
  }

  // Upsert predictions (allow re-submission before deadline)
  const rows = predictions.map((p: any) => ({
    player_id: session.id,
    match_id: p.match_id,
    home_score: p.home_score,
    away_score: p.away_score,
    points: null,
  }))

  const { error } = await supabaseAdmin
    .from('predictions')
    .upsert(rows, { onConflict: 'player_id,match_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
