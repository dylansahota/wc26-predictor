import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // ET date string e.g. '2026-06-12'

  if (!date) {
    return NextResponse.json({ error: 'Date required' }, { status: 400 })
  }

  // Fetch matches for the given ET date
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('et_date', date)
    .order('kickoff_utc', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Find deadline — kickoff of the first match of the day
  const deadline = matches.length > 0 ? matches[0].kickoff_utc : null
  const now = new Date()
  const deadlinePassed = deadline ? now > new Date(deadline) : false

  // Fetch this player's predictions for these matches
  const matchIds = matches.map(m => m.id)
  const { data: myPredictions } = await supabaseAdmin
    .from('predictions')
    .select('match_id, home_score, away_score, points')
    .eq('player_id', session.id)
    .in('match_id', matchIds)

  // Fetch other players' predictions — only if deadline has passed
  let otherPredictions: any[] = []
  if (deadlinePassed && matchIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('predictions')
      .select('match_id, home_score, away_score, player_id, players(name, colour)')
      .neq('player_id', session.id)
      .in('match_id', matchIds)
    otherPredictions = data ?? []
  }

  return NextResponse.json({
    matches,
    deadline,
    deadlinePassed,
    myPredictions: myPredictions ?? [],
    otherPredictions,
  })
}
