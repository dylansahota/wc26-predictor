import { supabaseAdmin } from './supabase'
import { BRACKET_ROUTES } from './bracket-routes'

interface StandingEntry {
  teamName: string
  flag: string
  groupLetter: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

interface GroupResult {
  winner: { name: string; flag: string } | null
  runnerUp: { name: string; flag: string } | null
  thirdPlace: StandingEntry | null
  complete: boolean
}

const WINNER_RE = /^Winner Group ([A-L])$/
const RUNNER_UP_RE = /^Runner-up Group ([A-L])$/
const BEST_THIRD_RE = /^Best 3rd: ([A-L/]+)$/

function compareStandings(a: StandingEntry, b: StandingEntry): number {
  if (b.points !== a.points) return b.points - a.points
  const gdA = a.goalsFor - a.goalsAgainst
  const gdB = b.goalsFor - b.goalsAgainst
  if (gdB !== gdA) return gdB - gdA
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  return a.teamName.localeCompare(b.teamName)
}

function resolveRoute(
  route: string,
  resultsByGroup: Map<string, GroupResult>,
  top8BestThird: StandingEntry[],
  usedBestThird: Set<string>,
  allGroupsComplete: boolean
): { name: string; flag: string } | null {
  const winnerMatch = WINNER_RE.exec(route)
  if (winnerMatch) return resultsByGroup.get(winnerMatch[1])?.winner ?? null

  const runnerUpMatch = RUNNER_UP_RE.exec(route)
  if (runnerUpMatch) return resultsByGroup.get(runnerUpMatch[1])?.runnerUp ?? null

  const bestThirdMatch = BEST_THIRD_RE.exec(route)
  if (bestThirdMatch && allGroupsComplete) {
    const eligibleGroups = new Set(bestThirdMatch[1].split('/'))
    const pick = top8BestThird.find(e => eligibleGroups.has(e.groupLetter) && !usedBestThird.has(e.teamName))
    if (pick) {
      usedBestThird.add(pick.teamName)
      return { name: pick.teamName, flag: pick.flag }
    }
  }

  return null
}

// Called by admin sync and cron after scoring.
// For each complete group, writes the winner/runner-up team name into the
// corresponding LAST_32 match slots. Only fills empty slots — never overwrites
// a name that's already confirmed.
export async function populateGroupQualifiers(): Promise<void> {
  const { data: groupMatches, error } = await supabaseAdmin
    .from('matches')
    .select('group_name, home_team, away_team, home_flag, away_flag, home_score, away_score, status')
    .eq('stage', 'GROUP_STAGE')
    .not('group_name', 'is', null)

  if (error) throw new Error(error.message)

  // Build per-group standings
  const groupStandings = new Map<string, Map<string, StandingEntry>>()
  const groupFinished = new Map<string, number>()

  for (const match of groupMatches ?? []) {
    // group_name stored as 'GROUP_A' — extract letter 'A'
    const letter = (match.group_name as string).replace('GROUP_', '')

    if (!groupStandings.has(letter)) groupStandings.set(letter, new Map())
    const s = groupStandings.get(letter)!

    for (const [name, flag] of [
      [match.home_team as string, match.home_flag as string],
      [match.away_team as string, match.away_flag as string],
    ] as [string, string][]) {
      if (name && !s.has(name)) {
        s.set(name, { teamName: name, flag, groupLetter: letter, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
      }
    }

    // Count as played if both scores are present — handles stuck matches where
    // status is still 'scheduled' but the game has actually finished
    if (match.home_score == null || match.away_score == null) continue

    const hs = match.home_score as number
    const as_ = match.away_score as number
    const home = s.get(match.home_team as string)
    const away = s.get(match.away_team as string)
    if (!home || !away) continue

    home.played++; away.played++
    home.goalsFor += hs; home.goalsAgainst += as_
    away.goalsFor += as_; away.goalsAgainst += hs

    if (hs > as_) { home.won++; away.lost++ }
    else if (as_ > hs) { away.won++; home.lost++ }
    else { home.drawn++; away.drawn++ }

    home.points = home.won * 3 + home.drawn
    away.points = away.won * 3 + away.drawn

    groupFinished.set(letter, (groupFinished.get(letter) ?? 0) + 1)
  }

  // A 4-team group is complete after 6 finished matches
  const resultsByGroup = new Map<string, GroupResult>()
  for (const [letter, standings] of groupStandings) {
    const sorted = Array.from(standings.values()).sort(compareStandings)
    const complete = (groupFinished.get(letter) ?? 0) >= 6
    resultsByGroup.set(letter, {
      winner: complete && sorted[0] ? { name: sorted[0].teamName, flag: sorted[0].flag } : null,
      runnerUp: complete && sorted[1] ? { name: sorted[1].teamName, flag: sorted[1].flag } : null,
      thirdPlace: complete ? (sorted[2] ?? null) : null,
      complete,
    })
  }

  // Best-third ranking only available once all 12 groups have finished
  const allGroupsComplete = resultsByGroup.size >= 12 && Array.from(resultsByGroup.values()).every(r => r.complete)

  const top8BestThird: StandingEntry[] = []
  if (allGroupsComplete) {
    const allThird = Array.from(resultsByGroup.entries())
      .filter(([, r]) => r.thirdPlace !== null)
      .map(([, r]) => r.thirdPlace!)
      .sort((a, b) => compareStandings(a, b) || a.groupLetter.localeCompare(b.groupLetter))
    top8BestThird.push(...allThird.slice(0, 8))
  }

  // Load LAST_32 matches in kickoff order (must match BRACKET_ROUTES.R32 order)
  const { data: r32Matches, error: r32Error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team')
    .eq('stage', 'LAST_32')
    .order('kickoff_utc', { ascending: true })

  if (r32Error) throw new Error(r32Error.message)
  if (!r32Matches?.length) return

  const r32Routes = BRACKET_ROUTES.R32 ?? []
  const usedBestThird = new Set<string>()

  for (let i = 0; i < r32Matches.length; i++) {
    const match = r32Matches[i]
    const route = r32Routes[i]
    if (!route) continue

    const curHome = match.home_team || null
    const curAway = match.away_team || null

    // Always resolve both slots — resolveRoute returns null if the source group
    // isn't complete yet, which lets us clear any premature API-written values
    const resolvedHome = resolveRoute(route.homeRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)
    const resolvedAway = resolveRoute(route.awayRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)

    const newHome = resolvedHome?.name ?? null
    const newAway = resolvedAway?.name ?? null

    if (newHome === curHome && newAway === curAway) continue

    const updates: Record<string, string | null> = {}
    if (newHome !== curHome) {
      updates.home_team = newHome  // null clears premature football-data.org values
      if (newHome && resolvedHome?.flag) updates.home_flag = resolvedHome.flag
    }
    if (newAway !== curAway) {
      updates.away_team = newAway
      if (newAway && resolvedAway?.flag) updates.away_flag = resolvedAway.flag
    }

    if (Object.keys(updates).length === 0) continue

    await supabaseAdmin.from('matches').update(updates).eq('id', match.id)
  }
}
