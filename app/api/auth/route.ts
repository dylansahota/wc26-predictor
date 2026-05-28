import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyPin, createSession, clearSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { name, pin } = await req.json()

  if (!name || !pin) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  // Find player by name
  const { data: player, error } = await supabaseAdmin
    .from('players')
    .select('id, name, pin_hash')
    .eq('name', name)
    .single()

  if (error || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  // Check PIN
  const valid = await verifyPin(pin, player.pin_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  // Create session cookie
  await createSession({ id: player.id, name: player.name })

  return NextResponse.json({ name: player.name, id: player.id })
}

export async function DELETE() {
  await clearSession()
  return NextResponse.json({ success: true })
}
