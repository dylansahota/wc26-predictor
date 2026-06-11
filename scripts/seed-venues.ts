import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// home_team, away_team, venue — exact names as stored by football-data.org
const FIXTURES: Array<[string, string, string]> = [
  // GROUP A
  ['Mexico', 'South Africa', 'Estadio Azteca'],
  ['South Korea', 'Czechia', 'Estadio Akron'],
  ['Czechia', 'South Africa', 'Mercedes-Benz Stadium'],
  ['Mexico', 'South Korea', 'Estadio Akron'],
  ['Czechia', 'Mexico', 'Estadio Azteca'],
  ['South Africa', 'South Korea', 'Estadio BBVA'],
  // GROUP B
  ['Canada', 'Bosnia-Herzegovina', 'BMO Field'],
  ['Qatar', 'Switzerland', "Levi's Stadium"],
  ['Switzerland', 'Bosnia-Herzegovina', 'SoFi Stadium'],
  ['Canada', 'Qatar', 'BC Place'],
  ['Switzerland', 'Canada', 'BC Place'],
  ['Bosnia-Herzegovina', 'Qatar', 'Lumen Field'],
  // GROUP C
  ['Haiti', 'Scotland', 'Gillette Stadium'],
  ['Brazil', 'Morocco', 'MetLife Stadium'],
  ['Brazil', 'Haiti', 'Lincoln Financial Field'],
  ['Scotland', 'Morocco', 'Gillette Stadium'],
  ['Scotland', 'Brazil', 'Hard Rock Stadium'],
  ['Morocco', 'Haiti', 'Mercedes-Benz Stadium'],
  // GROUP D
  ['United States', 'Paraguay', 'SoFi Stadium'],
  ['Australia', 'Turkey', 'BC Place'],
  ['Turkey', 'Paraguay', "Levi's Stadium"],
  ['United States', 'Australia', 'Lumen Field'],
  ['Turkey', 'United States', 'SoFi Stadium'],
  ['Paraguay', 'Australia', "Levi's Stadium"],
  // GROUP E
  ['Ivory Coast', 'Ecuador', 'Lincoln Financial Field'],
  ['Germany', 'Curaçao', 'NRG Stadium'],
  ['Germany', 'Ivory Coast', 'BMO Field'],
  ['Ecuador', 'Curaçao', 'Arrowhead Stadium'],
  ['Curaçao', 'Ivory Coast', 'Lincoln Financial Field'],
  ['Ecuador', 'Germany', 'MetLife Stadium'],
  // GROUP F
  ['Netherlands', 'Japan', 'AT&T Stadium'],
  ['Sweden', 'Tunisia', 'Estadio BBVA'],
  ['Netherlands', 'Sweden', 'NRG Stadium'],
  ['Tunisia', 'Japan', 'Estadio BBVA'],
  ['Japan', 'Sweden', 'AT&T Stadium'],
  ['Tunisia', 'Netherlands', 'Arrowhead Stadium'],
  // GROUP G
  ['Iran', 'New Zealand', 'SoFi Stadium'],
  ['Belgium', 'Egypt', 'Lumen Field'],
  ['Belgium', 'Iran', 'SoFi Stadium'],
  ['New Zealand', 'Egypt', 'BC Place'],
  ['Egypt', 'Iran', 'Lumen Field'],
  ['New Zealand', 'Belgium', 'BC Place'],
  // GROUP H
  ['Saudi Arabia', 'Uruguay', 'Hard Rock Stadium'],
  ['Spain', 'Cape Verde Islands', 'Mercedes-Benz Stadium'],
  ['Uruguay', 'Cape Verde Islands', 'Hard Rock Stadium'],
  ['Spain', 'Saudi Arabia', 'Mercedes-Benz Stadium'],
  ['Cape Verde Islands', 'Saudi Arabia', 'NRG Stadium'],
  ['Uruguay', 'Spain', 'Estadio Akron'],
  // GROUP I
  ['France', 'Senegal', 'MetLife Stadium'],
  ['Iraq', 'Norway', 'Gillette Stadium'],
  ['Norway', 'Senegal', 'MetLife Stadium'],
  ['France', 'Iraq', 'Lincoln Financial Field'],
  ['Norway', 'France', 'Gillette Stadium'],
  ['Senegal', 'Iraq', 'BMO Field'],
  // GROUP J
  ['Argentina', 'Algeria', 'Arrowhead Stadium'],
  ['Austria', 'Jordan', "Levi's Stadium"],
  ['Argentina', 'Austria', 'AT&T Stadium'],
  ['Jordan', 'Algeria', "Levi's Stadium"],
  ['Algeria', 'Austria', 'Arrowhead Stadium'],
  ['Jordan', 'Argentina', 'AT&T Stadium'],
  // GROUP K
  ['Portugal', 'Congo DR', 'NRG Stadium'],
  ['Uzbekistan', 'Colombia', 'Estadio Azteca'],
  ['Portugal', 'Uzbekistan', 'NRG Stadium'],
  ['Colombia', 'Congo DR', 'Estadio Akron'],
  ['Colombia', 'Portugal', 'Hard Rock Stadium'],
  ['Congo DR', 'Uzbekistan', 'Mercedes-Benz Stadium'],
  // GROUP L
  ['Ghana', 'Panama', 'BMO Field'],
  ['England', 'Croatia', 'AT&T Stadium'],
  ['England', 'Ghana', 'Gillette Stadium'],
  ['Panama', 'Croatia', 'BMO Field'],
  ['Panama', 'England', 'MetLife Stadium'],
  ['Croatia', 'Ghana', 'Lincoln Financial Field'],
]

async function main() {
  let updated = 0
  let notFound = 0

  for (const [home, away, venue] of FIXTURES) {
    const { data, error } = await supabase
      .from('matches')
      .update({ venue })
      .eq('home_team', home)
      .eq('away_team', away)
      .select('id')

    if (error) {
      console.error(`Error for ${home} v ${away}:`, error.message)
    } else if (!data || data.length === 0) {
      console.warn(`Not found: ${home} v ${away}`)
      notFound++
    } else {
      console.log(`✓ ${home} v ${away} → ${venue}`)
      updated++
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found`)
}

main().catch(console.error)
