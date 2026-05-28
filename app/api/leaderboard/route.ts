import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch all players
  const { data: players, error: playersError } = await supabaseAdmin
    .from('players')
    .select('id, name, colour')
    .order('name', { ascending: true })

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 })
  }

  // Fetch all daily_scores
  const { data: dailyScores, error: scoresError } = await supabaseAdmin
    .from('daily_scores')
    .select('player_id, et_date, points')
    .order('et_date', { ascending: true })

  if (scoresError) {
    return NextResponse.json({ error: scoresError.message }, { status: 500 })
  }

  // Build per-player totals and daily breakdowns
  const playerMap = new Map(players.map(p => [p.id, { ...p, total: 0, daily: {} as Record<string, number> }]))

  for (const row of dailyScores ?? []) {
    const player = playerMap.get(row.player_id)
    if (!player) continue
    player.total += row.points
    player.daily[row.et_date] = (player.daily[row.et_date] ?? 0) + row.points
  }

  // Collect all dates with scores and sort
  const allDates = [...new Set((dailyScores ?? []).map(r => r.et_date))].sort()

  // Build cumulative series per player for chart
  const standings = [...playerMap.values()]
    .map(p => {
      let cumulative = 0
      const series = allDates.map(date => {
        cumulative += p.daily[date] ?? 0
        return { date, points: cumulative }
      })
      return { id: p.id, name: p.name, colour: p.colour, total: p.total, series }
    })
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ standings, allDates })
}
