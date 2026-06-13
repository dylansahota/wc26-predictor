import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const now = new Date()

  // Game-day boundary: UTC-6 fixed offset (no DST).
  // Keeps late-night games (e.g. 04:00 UTC = 5am BST) on the same day as the earlier
  // games they're scheduled alongside, rather than rolling over to the next calendar day.
  const gameDayStr = now.toLocaleDateString('en-US', {
    timeZone: 'Etc/GMT+6', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const [em, ed, ey] = gameDayStr.split('/')
  let date = `${ey}-${em}-${ed}`

  // Fetch today's scheduled matches to check deadline
  const { data: todayMatches } = await supabaseAdmin
    .from('matches')
    .select('kickoff_utc')
    .eq('et_date', date)
    .eq('status', 'scheduled')
    .order('kickoff_utc', { ascending: true })
    .limit(1)

  const todayDeadline = todayMatches && todayMatches.length > 0
    ? new Date(new Date(todayMatches[0].kickoff_utc).getTime() - 60 * 60 * 1000)
    : null
  const todayLocked = !todayDeadline || now > todayDeadline

  // If today is locked (or has no scheduled matches), advance to the next day with scheduled matches
  if (todayLocked) {
    const { data: next } = await supabaseAdmin
      .from('matches')
      .select('et_date')
      .eq('status', 'scheduled')
      .gt('et_date', date)
      .order('et_date', { ascending: true })
      .limit(1)
      .single()
    if (next) date = next.et_date
  }

  // Fetch all matches for the active date (any status, so finished ones show scores)
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('et_date', date)
    .order('kickoff_utc', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Deadline = 1 hour before first kickoff of the day
  const deadline = matches.length > 0
    ? new Date(new Date(matches[0].kickoff_utc).getTime() - 60 * 60 * 1000).toISOString()
    : null
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

  // Build team form from all finished WC26 matches
  const todayTeams = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]))]
  const teamForms: Record<string, Array<{
    opponent: string; opponentFlag: string
    goalsFor: number; goalsAgainst: number
    result: 'W' | 'D' | 'L'
  }>> = {}

  if (todayTeams.length > 0) {
    const { data: finished } = await supabaseAdmin
      .from('matches')
      .select('home_team, away_team, home_flag, away_flag, home_score, away_score')
      .eq('status', 'finished')
      .order('kickoff_utc', { ascending: true })

    for (const m of finished ?? []) {
      const processTeam = (team: string, gf: number, ga: number, oppTeam: string, oppFlag: string) => {
        if (!todayTeams.includes(team)) return
        if (!teamForms[team]) teamForms[team] = []
        teamForms[team].push({
          opponent: oppTeam, opponentFlag: oppFlag, goalsFor: gf, goalsAgainst: ga,
          result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
        })
      }
      processTeam(m.home_team, m.home_score, m.away_score, m.away_team, m.away_flag)
      processTeam(m.away_team, m.away_score, m.home_score, m.home_team, m.home_flag)
    }
  }

  return NextResponse.json({
    matches,
    deadline,
    deadlinePassed,
    activeDate: date,
    myPredictions: myPredictions ?? [],
    otherPredictions,
    teamForms,
  })
}
