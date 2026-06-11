import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const PROTECTED = ['/predict', '/leaderboard', '/history', '/admin']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!PROTECTED.some(p => pathname.startsWith(p))) return NextResponse.next()
  const token = req.cookies.get('wc26_session')?.value
  if (!token) return NextResponse.redirect(new URL('/', req.url))
  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/', req.url))
  }
}

export const config = {
  matcher: ['/predict', '/leaderboard', '/history', '/admin'],
}
