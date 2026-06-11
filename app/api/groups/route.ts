import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE = 'https://api.football-data.org/v4'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Build flag map from our DB
  const { data: dbMatches } = await supabaseAdmin
    .from('matches')
    .select('home_team, home_flag, away_team, away_flag')

  const flagMap: Record<string, string> = {}
  for (const m of dbMatches ?? []) {
    flagMap[m.home_team] = m.home_flag
    flagMap[m.away_team] = m.away_flag
  }

  // Fetch standings from football-data.org
  const res = await fetch(`${FD_BASE}/competitions/WC/standings?season=2026`, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `football-data.org ${res.status}` }, { status: 500 })
  }

  const data = await res.json()

  // Filter to group stage total standings
  const groupStandings = (data.standings ?? []).filter(
    (s: any) => s.stage === 'GROUP_STAGE' && s.type === 'TOTAL'
  )

  const groups = groupStandings.map((standing: any) => ({
    name: standing.group?.replace('GROUP_', 'Group ') ?? 'Group',
    table: (standing.table ?? []).map((row: any) => ({
      position: row.position,
      team: row.team.name,
      flag: flagMap[row.team.name] ?? '🏳',
      played: row.playedGames,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
    })),
  }))

  // 3rd place standings — best 8 of 12 qualify
  const thirdPlace = groups
    .map((g: any) => g.table[2] ? { ...g.table[2], group: g.name } : null)
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      return b.goalsFor - a.goalsFor
    })

  return NextResponse.json({ groups, thirdPlace })
}
