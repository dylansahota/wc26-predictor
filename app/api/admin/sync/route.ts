import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE = 'https://api.football-data.org/v4'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.name !== 'Dyl') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all scheduled matches from our DB
  const { data: scheduledMatches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('status', 'scheduled')

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

    // Update team names, venue if changed
    const homeTeam = fdMatch.homeTeam?.name
    const awayTeam = fdMatch.awayTeam?.name
    const venue = fdMatch.venue ?? null
    const updates: Record<string, any> = {}
    if (homeTeam && awayTeam && (homeTeam !== match.home_team || awayTeam !== match.away_team)) {
      updates.home_team = homeTeam
      updates.away_team = awayTeam
    }
    if (venue && venue !== (match as any).venue) updates.venue = venue
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
      const points = pred.home_score === homeScore && pred.away_score === awayScore ? 1 : 0
      await supabaseAdmin.from('predictions').update({ points }).eq('id', pred.id)

      // Derive the ET date for this match
      const etDate = match.et_date

      const { data: existing } = await supabaseAdmin
        .from('daily_scores')
        .select('id, points')
        .eq('player_id', pred.player_id)
        .eq('et_date', etDate)
        .single()

      if (existing) {
        await supabaseAdmin
          .from('daily_scores')
          .update({ points: existing.points + points })
          .eq('id', existing.id)
      } else {
        await supabaseAdmin
          .from('daily_scores')
          .insert({ player_id: pred.player_id, et_date: etDate, points })
      }
    }

    scored++
  }

  return NextResponse.json({
    matchesChecked: scheduledMatches?.length ?? 0,
    scored,
    teamUpdates,
  })
}
