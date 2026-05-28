import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  return NextResponse.json({ id: session.id, name: session.name })
}
