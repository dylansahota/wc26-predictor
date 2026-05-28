import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = 'wc26_session'

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash)
}

export async function createSession(player: { id: number; name: string }) {
  const token = await new SignJWT({ id: player.id, name: player.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { id: number; name: string }
  } catch {
    return null
  }
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
