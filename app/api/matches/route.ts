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

  // Deadline = 1 hour before first kickoff of the day
  const deadline = matches.length > 0
    ? new Date(new Date(matches[0].kickoff_utc).getTime() - 60 * 60 * 1000).toISOString()
    : null
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
    myPredictions: myPredictions ?? [],
    otherPredictions,
    teamForms,
  })
}
