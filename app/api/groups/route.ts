import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Fetch all group-stage finished matches from DB
  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select('home_team, away_team, home_flag, away_flag, home_score, away_score, status, group_name')
    .eq('stage', 'GROUP_STAGE')
    .order('kickoff_utc', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build per-team stats from finished matches
  type TeamStats = {
    team: string; flag: string; played: number; won: number; drawn: number; lost: number
    goalsFor: number; goalsAgainst: number; goalDifference: number; points: number
    group: string
  }

  const teams = new Map<string, TeamStats>()

  function ensureTeam(name: string, flag: string, group: string) {
    if (!teams.has(name)) {
      teams.set(name, { team: name, flag, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, group })
    }
  }

  for (const m of matches ?? []) {
    const group = m.group_name ?? 'Unknown'
    ensureTeam(m.home_team, m.home_flag, group)
    ensureTeam(m.away_team, m.away_flag, group)

    if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue

    const home = teams.get(m.home_team)!
    const away = teams.get(m.away_team)!
    home.played++; away.played++
    home.goalsFor += m.home_score; home.goalsAgainst += m.away_score
    away.goalsFor += m.away_score; away.goalsAgainst += m.home_score

    if (m.home_score > m.away_score) {
      home.won++; home.points += 3; away.lost++
    } else if (m.home_score < m.away_score) {
      away.won++; away.points += 3; home.lost++
    } else {
      home.drawn++; home.points++; away.drawn++; away.points++
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst
    away.goalDifference = away.goalsFor - away.goalsAgainst
  }

  // Group by group_name, sort each table
  const groupMap = new Map<string, TeamStats[]>()
  for (const t of teams.values()) {
    const arr = groupMap.get(t.group) ?? []
    arr.push(t)
    groupMap.set(t.group, arr)
  }

  function sortTable(table: TeamStats[]) {
    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      return a.team.localeCompare(b.team)
    })
  }

  const groups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, table]) => ({
      name: name.replace('GROUP_', 'Group '),
      table: sortTable(table).map((t, i) => ({ position: i + 1, ...t })),
    }))

  // 3rd place: one per group, best 8 of 12 qualify
  const thirdPlace = groups
    .map(g => g.table[2] ? { ...g.table[2], group: g.name } : null)
    .filter(Boolean)
    .sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
      return b.goalsFor - a.goalsFor
    })

  return NextResponse.json({ groups, thirdPlace })
}
