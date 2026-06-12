import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE = 'https://api.football-data.org/v4'

// Rebuild daily_scores for a given et_date from scratch.
// Sums all non-null prediction points across all finished matches that day.
// Safe to call multiple times — always produces the correct result.
export async function recalcDailyScores(etDate: string) {
  const { data: dayMatches } = await supabaseAdmin
    .from('matches')
    .select('id')
    .eq('et_date', etDate)
    .eq('status', 'finished')

  const matchIds = (dayMatches ?? []).map(m => m.id)
  if (matchIds.length === 0) return

  const { data: preds } = await supabaseAdmin
    .from('predictions')
    .select('player_id, points')
    .in('match_id', matchIds)
    .not('points', 'is', null)

  const totals: Record<number, number> = {}
  for (const p of preds ?? []) {
    totals[p.player_id] = (totals[p.player_id] ?? 0) + p.points
  }

  for (const [playerIdStr, points] of Object.entries(totals)) {
    const playerId = Number(playerIdStr)
    const { data: existing } = await supabaseAdmin
      .from('daily_scores')
      .select('id')
      .eq('player_id', playerId)
      .eq('et_date', etDate)
      .single()

    if (existing) {
      await supabaseAdmin.from('daily_scores').update({ points }).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('daily_scores').insert({ player_id: playerId, et_date: etDate, points })
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.name !== 'Dyl') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch scheduled matches + any finished ones with null scores (stuck mid-sync)
  const { data: scheduledMatches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('id, fd_id, home_team, away_team, home_flag, away_flag, home_score, away_score, et_date, stage, group_name, venue, status')
    .or('status.eq.scheduled,home_score.is.null')

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

  // Single API call — all WC2026 matches
  const fdRes = await fetch(`${FD_BASE}/competitions/WC/matches?season=2026`, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })

  if (!fdRes.ok) {
    return NextResponse.json({ error: `football-data.org ${fdRes.status}` }, { status: 500 })
  }

  const fdData = await fdRes.json()
  const fdById = new Map<number, any>((fdData.matches ?? []).map((m: any) => [m.id, m]))

  let scored = 0
  let teamUpdates = 0

  for (const match of scheduledMatches ?? []) {
    const fdMatch = fdById.get(match.fd_id)
    if (!fdMatch) continue

    // Update team names, venue, group_name if changed
    const homeTeam = fdMatch.homeTeam?.name
    const awayTeam = fdMatch.awayTeam?.name
    const venue = fdMatch.venue ?? null
    const groupName = fdMatch.group ?? null
    const updates: Record<string, any> = {}
    if (homeTeam && awayTeam && (homeTeam !== match.home_team || awayTeam !== match.away_team)) {
      updates.home_team = homeTeam
      updates.away_team = awayTeam
    }
    if (venue && venue !== (match as any).venue) updates.venue = venue
    if (groupName && groupName !== match.group_name) updates.group_name = groupName
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('matches').update(updates).eq('id', match.id)
      if (updates.home_team) teamUpdates++
    }

    // Score if finished
    if (fdMatch.status !== 'FINISHED') continue

    const homeScore = fdMatch.score.fullTime.home
    const awayScore = fdMatch.score.fullTime.away

    await supabaseAdmin
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: 'finished' })
      .eq('id', match.id)

    const { data: predictions } = await supabaseAdmin
      .from('predictions')
      .select('id, player_id, home_score, away_score')
      .eq('match_id', match.id)

    for (const pred of predictions ?? []) {
      const newPoints = pred.home_score === homeScore && pred.away_score === awayScore ? 1 : 0
      await supabaseAdmin.from('predictions').update({ points: newPoints }).eq('id', pred.id)
    }

    // Recalculate daily_scores for this date from scratch based on all scored predictions
    await recalcDailyScores(match.et_date)

    scored++
  }

  return NextResponse.json({
    matchesChecked: scheduledMatches?.length ?? 0,
    scored,
    teamUpdates,
  })
}
