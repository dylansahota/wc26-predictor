import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { BRACKET_ROUTES } from '@/lib/bracket-routes'

export const dynamic = 'force-dynamic'

// Maps football-data.org stage values to our BRACKET_ROUTES keys
const STAGE_MAP: Record<string, string> = {
  LAST_32: 'R32',
  LAST_16: 'R16',
  QUARTER_FINALS: 'QF',
  SEMI_FINALS: 'SF',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const [{ data: matches, error }, { data: allMatches }] = await Promise.all([
    supabaseAdmin
      .from('matches')
      .select('id, stage, kickoff_utc, home_team, away_team, home_flag, away_flag, home_score, away_score, status, venue')
      .neq('stage', 'GROUP_STAGE')
      .order('kickoff_utc', { ascending: true }),
    // Build a flag lookup from all matches in the DB (group stage has confirmed flags)
    supabaseAdmin
      .from('matches')
      .select('home_team, home_flag, away_team, away_flag'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // team name → emoji flag (sourced from group stage matches that are already seeded)
  const flagMap: Record<string, string> = {}
  for (const m of allMatches ?? []) {
    if (m.home_team && m.home_flag) flagMap[m.home_team] = m.home_flag
    if (m.away_team && m.away_flag) flagMap[m.away_team] = m.away_flag
  }

  // Group matches by stage key (kickoff order preserved by the .order() above)
  const byStage = new Map<string, NonNullable<typeof matches>>()
  for (const match of matches ?? []) {
    const key = STAGE_MAP[match.stage] ?? match.stage
    if (!byStage.has(key)) byStage.set(key, [])
    byStage.get(key)!.push(match)
  }

  const bracket = (matches ?? []).map((match) => {
    const key = STAGE_MAP[match.stage] ?? match.stage
    const idx = (byStage.get(key) ?? []).indexOf(match)
    const route = (BRACKET_ROUTES[key] ?? [])[idx] ?? null

    // Use stored flag first, fall back to global flag lookup once team is confirmed
    const homeFlag = match.home_flag || (match.home_team ? (flagMap[match.home_team] ?? null) : null)
    const awayFlag = match.away_flag || (match.away_team ? (flagMap[match.away_team] ?? null) : null)

    return {
      id: match.id,
      stage: key,
      kickoff_utc: match.kickoff_utc,
      home_team: match.home_team || null,
      away_team: match.away_team || null,
      home_flag: homeFlag || null,
      away_flag: awayFlag || null,
      home_score: match.home_score,
      away_score: match.away_score,
      status: match.status,
      venue: match.venue || null,
      matchLabel: route?.matchLabel ?? null,
      homeRoute: route?.homeRoute ?? null,
      awayRoute: route?.awayRoute ?? null,
    }
  })

  return NextResponse.json({ bracket })
}
