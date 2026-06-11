import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE = 'https://api.football-data.org/v4'

// Called by the Vercel cron job daily at 8am UTC (4am ET).
// Uses a single competition-level API call to avoid per-match rate-limit delays
// and stay well within Vercel's 10s function timeout.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get yesterday's ET date
  const now = new Date()
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  etNow.setDate(etNow.getDate() - 1)
  const etDate = etNow.toISOString().split('T')[0]

  // Fetch our DB matches for yesterday
  const { data: dbMatches, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('et_date', etDate)
    .eq('status', 'scheduled')

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  // Also fetch all scheduled matches so we can refresh knockout team names
  const { data: scheduledMatches } = await supabaseAdmin
    .from('matches')
    .select('id, fd_id, home_team, away_team')
    .eq('status', 'scheduled')

  // Single API call — fetch all WC2026 matches at once
  const fdRes = await fetch(`${FD_BASE}/competitions/WC/matches?season=2026`, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })

  if (!fdRes.ok) {
    return NextResponse.json({ error: `football-data.org error: ${fdRes.status}` }, { status: 500 })
  }

  const fdData = await fdRes.json()
  const fdMatches: any[] = fdData.matches ?? []

  // Index API matches by fd_id for O(1) lookup
  const fdById = new Map(fdMatches.map((m: any) => [m.id, m]))

  // Score yesterday's matches
  const scored: number[] = []

  for (const match of dbMatches ?? []) {
    const fdMatch = fdById.get(match.fd_id)
    if (!fdMatch || fdMatch.status !== 'FINISHED') continue

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

    scored.push(match.id)
  }

  // Refresh team names + venue for all scheduled matches
  const teamUpdates: number[] = []
  for (const match of scheduledMatches ?? []) {
    const fdMatch = fdById.get(match.fd_id)
    if (!fdMatch) continue

    const homeTeam = fdMatch.homeTeam?.name
    const awayTeam = fdMatch.awayTeam?.name
    const venue = fdMatch.venue ?? null
    const updates: Record<string, any> = {}

    if (homeTeam && awayTeam && (homeTeam !== match.home_team || awayTeam !== match.away_team)) {
      updates.home_team = homeTeam
      updates.away_team = awayTeam
    }
    if (venue && venue !== (match as any).venue) updates.venue = venue
    if (Object.keys(updates).length === 0) continue

    await supabaseAdmin.from('matches').update(updates).eq('id', match.id)
    if (updates.home_team) teamUpdates.push(match.id)
  }

  return NextResponse.json({ scored, teamUpdates, etDate })
}
