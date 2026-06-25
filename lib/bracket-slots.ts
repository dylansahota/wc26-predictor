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
  finishedCount: number
}

export interface SlotDiag {
  index: number
  matchId: number
  homeRoute: string
  awayRoute: string
  curHome: string | null
  curAway: string | null
  newHome: string | null
  newAway: string | null
  action: 'updated' | 'skipped' | 'no-route' | 'error'
  errorMsg?: string
}

export interface BracketSlotDiagnostics {
  completedGroups: string[]
  incompleteGroups: string[]
  groupFinishedCounts: Record<string, number>
  slotsUpdated: number
  slots: SlotDiag[]
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

// Called by admin sync, cron, and the dedicated bracket-slots endpoint.
// Uses the same completeness logic as the sweepstake: a group is complete when
// all 6 of its GROUP_STAGE matches have status='finished'.
// Clears any premature team names (e.g. from football-data.org pre-population)
// by writing null for slots whose group isn't yet complete.
export async function populateGroupQualifiers(): Promise<BracketSlotDiagnostics> {
  // Fetch all GROUP_STAGE matches with their status and scores
  const { data: groupMatches, error } = await supabaseAdmin
    .from('matches')
    .select('group_name, home_team, away_team, home_flag, away_flag, home_score, away_score, status')
    .eq('stage', 'GROUP_STAGE')
    .not('group_name', 'is', null)

  if (error) throw new Error(error.message)

  // Build per-group standings from finished matches only (sweepstake approach)
  const groupStandings = new Map<string, Map<string, StandingEntry>>()
  const groupFinished = new Map<string, number>()

  for (const match of groupMatches ?? []) {
    const letter = (match.group_name as string).replace('GROUP_', '')

    if (!groupStandings.has(letter)) groupStandings.set(letter, new Map())
    const s = groupStandings.get(letter)!

    // Ensure all team names are registered in the standings table
    for (const [name, flag] of [
      [match.home_team as string, match.home_flag as string],
      [match.away_team as string, match.away_flag as string],
    ] as [string, string][]) {
      if (name && !s.has(name)) {
        s.set(name, { teamName: name, flag, groupLetter: letter, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
      }
    }

    // Only count matches that are genuinely finished (status='finished')
    // This is the same approach used by the sweepstake
    if (match.status !== 'finished' || match.home_score == null || match.away_score == null) continue

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

    // Count finished matches per group (sweepstake uses >= 6 for completeness)
    groupFinished.set(letter, (groupFinished.get(letter) ?? 0) + 1)
  }

  // A 4-team group has 6 fixtures — complete when all 6 are finished
  const resultsByGroup = new Map<string, GroupResult>()
  for (const [letter, standings] of groupStandings) {
    const sorted = Array.from(standings.values()).sort(compareStandings)
    const finishedCount = groupFinished.get(letter) ?? 0
    const complete = finishedCount >= 6

    resultsByGroup.set(letter, {
      winner: complete && sorted[0] ? { name: sorted[0].teamName, flag: sorted[0].flag } : null,
      runnerUp: complete && sorted[1] ? { name: sorted[1].teamName, flag: sorted[1].flag } : null,
      thirdPlace: complete ? (sorted[2] ?? null) : null,
      complete,
      finishedCount,
    })
  }

  const completedGroups = Array.from(resultsByGroup.entries()).filter(([, r]) => r.complete).map(([l]) => l).sort()
  const incompleteGroups = Array.from(resultsByGroup.entries()).filter(([, r]) => !r.complete).map(([l]) => l).sort()
  const groupFinishedCounts: Record<string, number> = {}
  for (const [letter, result] of resultsByGroup) {
    groupFinishedCounts[letter] = result.finishedCount
  }

  // Best-third ranking only valid once ALL 12 groups are complete
  const allGroupsComplete = resultsByGroup.size >= 12 && completedGroups.length >= 12

  const top8BestThird: StandingEntry[] = []
  if (allGroupsComplete) {
    const allThird = Array.from(resultsByGroup.entries())
      .filter(([, r]) => r.thirdPlace !== null)
      .map(([, r]) => r.thirdPlace!)
      .sort((a, b) => compareStandings(a, b) || a.groupLetter.localeCompare(b.groupLetter))
    top8BestThird.push(...allThird.slice(0, 8))
  }

  // Load all LAST_32 matches ordered by kickoff time — must match BRACKET_ROUTES.R32 order
  const { data: r32Matches, error: r32Error } = await supabaseAdmin
    .from('matches')
    .select('id, home_team, away_team, home_flag, away_flag')
    .eq('stage', 'LAST_32')
    .order('kickoff_utc', { ascending: true })

  if (r32Error) throw new Error(r32Error.message)

  const r32Routes = BRACKET_ROUTES.R32 ?? []
  const usedBestThird = new Set<string>()
  let slotsUpdated = 0
  const slots: SlotDiag[] = []

  for (let i = 0; i < (r32Matches ?? []).length; i++) {
    const match = r32Matches![i]
    const route = r32Routes[i]

    // Use actual DB strings for comparison (home_team is NOT NULL, '' means TBD)
    const curHomeActual = (match.home_team as string) ?? ''
    const curAwayActual = (match.away_team as string) ?? ''

    if (!route) {
      slots.push({ index: i, matchId: match.id, homeRoute: '(no route)', awayRoute: '(no route)', curHome: curHomeActual || null, curAway: curAwayActual || null, newHome: null, newAway: null, action: 'no-route' })
      continue
    }

    // Resolve correct team — null means group is not yet complete
    const resolvedHome = resolveRoute(route.homeRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)
    const resolvedAway = resolveRoute(route.awayRoute, resultsByGroup, top8BestThird, usedBestThird, allGroupsComplete)

    // home_team/away_team are NOT NULL in the DB — use '' as TBD placeholder
    const writeHome = resolvedHome?.name ?? ''
    const writeAway = resolvedAway?.name ?? ''

    const diag: SlotDiag = {
      index: i,
      matchId: match.id,
      homeRoute: route.homeRoute,
      awayRoute: route.awayRoute,
      curHome: curHomeActual || null,
      curAway: curAwayActual || null,
      newHome: resolvedHome?.name ?? null,
      newAway: resolvedAway?.name ?? null,
      action: 'skipped',
    }

    const needsHomeUpdate = curHomeActual !== writeHome
    const needsAwayUpdate = curAwayActual !== writeAway

    if (!needsHomeUpdate && !needsAwayUpdate) {
      slots.push(diag)
      continue
    }

    // Only include fields that actually changed
    const updates: Record<string, string> = {}
    if (needsHomeUpdate) {
      updates.home_team = writeHome
      updates.home_flag = resolvedHome?.flag ?? ''
    }
    if (needsAwayUpdate) {
      updates.away_team = writeAway
      updates.away_flag = resolvedAway?.flag ?? ''
    }

    const { error: updateError } = await supabaseAdmin.from('matches').update(updates).eq('id', match.id)
    if (updateError) {
      diag.action = 'error'
      diag.errorMsg = updateError.message
      slots.push(diag)
      continue
    }

    diag.action = 'updated'
    slots.push(diag)
    slotsUpdated++
  }

  return { completedGroups, incompleteGroups, groupFinishedCounts, slotsUpdated, slots }
}
