import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const players = [
  { name: 'Damien', colour: '#60a5fa' },
  { name: 'Tunde',  colour: '#4ade80' },
  { name: 'Gowth',  colour: '#c084fc' },
  { name: 'Dyl',    colour: '#f97316' },
]

async function seed() {
  const pin_hash = await bcrypt.hash('1234', 10)
  const rows = players.map(p => ({ ...p, pin_hash }))
  const { error } = await supabase.from('players').insert(rows)
  if (error) { console.error('Seed failed:', error.message); process.exit(1) }
  console.log('Players seeded successfully')
}

seed()
