import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const team = req.nextUrl.searchParams.get('team')
  if (!team) return NextResponse.json({ error: 'team required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('home_team, away_team, home_flag, away_flag, home_score, away_score, kickoff_utc')
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .eq('status', 'finished')
    .order('kickoff_utc', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matches = (data ?? []).map(m => {
    const isHome = m.home_team === team
    const gf = isHome ? m.home_score : m.away_score
    const ga = isHome ? m.away_score : m.home_score
    const result = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
    return {
      opponent: isHome ? m.away_team : m.home_team,
      opponentFlag: isHome ? m.away_flag : m.home_flag,
      goalsFor: gf,
      goalsAgainst: ga,
      result,
      isHome,
      kickoff_utc: m.kickoff_utc,
    }
  })

  return NextResponse.json({ matches })
}
