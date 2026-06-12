import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { recalcDailyScores } from '../sync/route'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.name !== 'Dyl') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all distinct et_dates that have finished matches
  const { data: dates, error } = await supabaseAdmin
    .from('matches')
    .select('et_date')
    .eq('status', 'finished')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uniqueDates = [...new Set((dates ?? []).map(d => d.et_date))]

  for (const etDate of uniqueDates) {
    await recalcDailyScores(etDate)
  }

  return NextResponse.json({ recalculated: uniqueDates.length, dates: uniqueDates })
}
