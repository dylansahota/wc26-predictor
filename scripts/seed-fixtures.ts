import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FD_API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'WC' // World Cup 2026

const FLAG_MAP: Record<string, string> = {
  'United States': '🇺🇸', 'Canada': '🇨🇦', 'Mexico': '🇲🇽',
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Chile': '🇨🇱',
  'Peru': '🇵🇪', 'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴',
  'Paraguay': '🇵🇾', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Italy': '🇮🇹',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Croatia': '🇭🇷', 'Switzerland': '🇨🇭', 'Austria': '🇦🇹',
  'Denmark': '🇩🇰', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
  'Poland': '🇵🇱', 'Czech Republic': '🇨🇿', 'Hungary': '🇭🇺',
  'Slovakia': '🇸🇰', 'Romania': '🇷🇴', 'Serbia': '🇷🇸',
  'Ukraine': '🇺🇦', 'Turkey': '🇹🇷', 'Greece': '🇬🇷',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Ireland': '🇮🇪',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬',
  'Egypt': '🇪🇬', 'South Africa': '🇿🇦', 'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿', 'Cameroon': '🇨🇲', 'Ghana': '🇬🇭',
  'Ivory Coast': '🇨🇮', 'DR Congo': '🇨🇩', 'Mali': '🇲🇱',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺',
  'Iran': '🇮🇷', 'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦',
  'Uzbekistan': '🇺🇿', 'Iraq': '🇮🇶', 'Jordan': '🇯🇴',
  'Indonesia': '🇮🇩', 'New Zealand': '🇳🇿',
}

function getFlag(name: string): string {
  return FLAG_MAP[name] ?? '🏳'
}

function toEt(utcStr: string): { kickoff_et: string; et_date: string } {
  const utcDate = new Date(utcStr)
  const etStr = utcDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(etStr)

  const kickoff_et = etDate.toISOString().slice(0, 16).replace('T', ' ')
  const pad = (n: number) => String(n).padStart(2, '0')
  const et_date = `${etDate.getFullYear()}-${pad(etDate.getMonth() + 1)}-${pad(etDate.getDate())}`

  return { kickoff_et, et_date }
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchMatches() {
  const url = `${FD_BASE}/competitions/${COMPETITION}/matches?season=2026`
  console.log('Fetching matches from:', url)

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': FD_API_KEY },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.matches as any[]
}

async function seed() {
  console.log('Fetching WC2026 fixtures...')

  let matches: any[]
  try {
    matches = await fetchMatches()
  } catch (err) {
    console.error('Failed to fetch fixtures:', err)
    process.exit(1)
  }

  console.log(`Found ${matches.length} matches`)

  let inserted = 0
  let skipped = 0

  for (const m of matches) {
    await delay(7000) // respect 10 req/min limit

    const homeTeam = m.homeTeam?.name ?? 'TBD'
    const awayTeam = m.awayTeam?.name ?? 'TBD'
    const kickoff_utc = m.utcDate
    const { kickoff_et, et_date } = toEt(kickoff_utc)
    const stage = m.stage ?? 'GROUP_STAGE'

    const row = {
      fd_id: m.id,
      home_team: homeTeam,
      away_team: awayTeam,
      home_flag: getFlag(homeTeam),
      away_flag: getFlag(awayTeam),
      kickoff_utc,
      kickoff_et,
      et_date,
      stage,
      status: 'scheduled',
    }

    const { error } = await supabase
      .from('matches')
      .upsert(row, { onConflict: 'fd_id' })

    if (error) {
      console.error(`Failed to upsert match ${m.id} (${homeTeam} vs ${awayTeam}):`, error.message)
      skipped++
    } else {
      console.log(`✓ ${et_date} ${homeTeam} vs ${awayTeam}`)
      inserted++
    }
  }

  console.log(`\nDone: ${inserted} upserted, ${skipped} failed`)
}

seed()
