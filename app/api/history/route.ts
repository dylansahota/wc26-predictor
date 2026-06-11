import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch all players so we can show N/A for missing predictions
  const { data: players, error: playersError } = await supabaseAdmin
    .from('players')
    .select('id, name, colour')
    .order('name', { ascending: true })

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 })
  }

  // Fetch all matches (not just finished — we show TBC until scored)
  const { data: matches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_flag, away_flag, home_score, away_score, kickoff_utc, et_date, stage, status')
    .order('et_date', { ascending: false })
    .order('kickoff_utc', { ascending: true })

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  // Group matches by et_date
  const dateMap: Record<string, typeof matches> = {}
  for (const match of matches ?? []) {
    if (!dateMap[match.et_date]) dateMap[match.et_date] = []
    dateMap[match.et_date].push(match)
  }

  // Only include dates where the deadline has passed (1 hour before first kickoff)
  const now = new Date()
  const pastDates = Object.entries(dateMap).filter(([, dayMatches]) => {
    const firstKickoff = dayMatches.reduce((a, b) =>
      new Date(a.kickoff_utc) < new Date(b.kickoff_utc) ? a : b
    )
    const deadline = new Date(new Date(firstKickoff.kickoff_utc).getTime() - 60 * 60 * 1000)
    return now > deadline
  })

  if (pastDates.length === 0) {
    return NextResponse.json({ groups: [], players })
  }

  // Fetch all predictions for these matches
  const matchIds = pastDates.flatMap(([, dayMatches]) => dayMatches.map(m => m.id))

  const { data: predictions, error: predError } = await supabaseAdmin
    .from('predictions')
    .select('match_id, home_score, away_score, points, player_id')
    .in('match_id', matchIds)

  if (predError) {
    return NextResponse.json({ error: predError.message }, { status: 500 })
  }

  // Index predictions by match_id → player_id
  const predMap: Record<number, Record<number, { home_score: number; away_score: number; points: number | null }>> = {}
  for (const pred of predictions ?? []) {
    if (!predMap[pred.match_id]) predMap[pred.match_id] = {}
    predMap[pred.match_id][pred.player_id] = {
      home_score: pred.home_score,
      away_score: pred.away_score,
      points: pred.points,
    }
  }

  // Build groups with per-player prediction slots (null = no submission)
  const groups = pastDates
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([et_date, dayMatches]) => ({
      et_date,
      matches: dayMatches.map(match => ({
        ...match,
        predictions: (players ?? []).map(player => ({
          player_id: player.id,
          name: player.name,
          colour: player.colour,
          prediction: predMap[match.id]?.[player.id] ?? null,
        })),
      })),
    }))

  return NextResponse.json({ groups, players })
}
