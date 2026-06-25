import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { populateGroupQualifiers } from '@/lib/bracket-slots'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (session.name !== 'Dyl') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const diag = await populateGroupQualifiers()
  return NextResponse.json(diag)
}
