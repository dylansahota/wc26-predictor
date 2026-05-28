import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch all finished matches, most recent ET date first
  const { data: matches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_flag, away_flag, home_score, away_score, kickoff_utc, et_date, stage')
    .eq('status', 'finished')
    .order('et_date', { ascending: false })
    .order('kickoff_utc', { ascending: true })

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  if (!matches?.length) {
    return NextResponse.json({ groups: [] })
  }

  const matchIds = matches.map(m => m.id)

  // Fetch all predictions for finished matches with player info
  const { data: predictions, error: predError } = await supabaseAdmin
    .from('predictions')
    .select('match_id, home_score, away_score, points, player_id, players(name, colour)')
    .in('match_id', matchIds)

  if (predError) {
    return NextResponse.json({ error: predError.message }, { status: 500 })
  }

  // Group predictions by match_id
  const predsByMatch: Record<number, any[]> = {}
  for (const pred of predictions ?? []) {
    if (!predsByMatch[pred.match_id]) predsByMatch[pred.match_id] = []
    predsByMatch[pred.match_id].push(pred)
  }

  // Group matches by et_date
  const dateMap: Record<string, any[]> = {}
  for (const match of matches) {
    if (!dateMap[match.et_date]) dateMap[match.et_date] = []
    dateMap[match.et_date].push({
      ...match,
      predictions: predsByMatch[match.id] ?? [],
    })
  }

  const groups = Object.entries(dateMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([et_date, matchList]) => ({ et_date, matches: matchList }))

  return NextResponse.json({ groups })
}
