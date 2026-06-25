'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

interface BracketMatch {
  id: number
  stage: string
  kickoff_utc: string
  home_team: string | null
  away_team: string | null
  home_flag: string | null
  away_flag: string | null
  home_score: number | null
  away_score: number | null
  status: string
  venue: string | null
  matchLabel: string | null
  homeRoute: string | null
  awayRoute: string | null
}

const STAGE_ORDER = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL']
const STAGE_LABELS: Record<string, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

function formatKickoffBST(utc: string) {
  const date = new Date(utc)
  const day = date.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short',
  })
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
  })
  return `${day} · ${time} BST`
}

function TeamSlot({
  name, flag, route, align,
}: {
  name: string | null
  flag: string | null
  route: string | null
  align: 'left' | 'right'
}) {
  const confirmed = Boolean(name)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'left' ? 'flex-start' : 'flex-end',
      flex: 1,
      minWidth: 0,
    }}>
      {confirmed ? (
        <>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{flag ?? '🏳'}</span>
          <span style={{
            fontSize: '13px', fontWeight: 600, marginTop: '4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}>
            {name}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: '11px', color: '#6b7280', fontStyle: 'italic',
          lineHeight: 1.3, textAlign: align,
        }}>
          {route ?? 'TBD'}
        </span>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: BracketMatch }) {
  const finished = match.status === 'finished'
  const hasScore = match.home_score != null && match.away_score != null

  return (
    <div style={{
      background: '#0f1117',
      border: '0.5px solid #2a2f3d',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '8px',
    }}>
      {/* Top row: match label + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>
          {match.matchLabel ?? ''}
        </span>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {formatKickoffBST(match.kickoff_utc)}
        </span>
      </div>

      {/* Teams + score row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TeamSlot name={match.home_team} flag={match.home_flag} route={match.homeRoute} align="left" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '52px' }}>
          {finished && hasScore ? (
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#f9fafb', letterSpacing: '1px' }}>
              {match.home_score}–{match.away_score}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>vs</span>
          )}
        </div>

        <TeamSlot name={match.away_team} flag={match.away_flag} route={match.awayRoute} align="right" />
      </div>

      {/* Venue */}
      {match.venue && (
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#4b5563', textAlign: 'center' }}>
          {match.venue}
        </div>
      )}
    </div>
  )
}

export default function BracketPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<BracketMatch[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/'); return }
      const session = await sessionRes.json()
      setPlayerName(session.name)

      const res = await fetch('/api/bracket')
      const data = await res.json()
      if (!res.ok || !data.bracket) {
        setError(data.error ?? 'Failed to load bracket')
      } else {
        setMatches(data.bracket)
      }
      setLoading(false)
    }
    load()
  }, [router])

  // Group matches by stage, preserving STAGE_ORDER
  const grouped = new Map<string, BracketMatch[]>()
  for (const stage of STAGE_ORDER) grouped.set(stage, [])
  for (const match of matches) {
    const list = grouped.get(match.stage) ?? []
    list.push(match)
    grouped.set(match.stage, list)
  }

  if (loading) {
    return (
      <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
        <NavBar playerName="" />
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </main>
    )
  }

  return (
    <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
      <NavBar playerName={playerName} />
      <div style={{ padding: '16px' }}>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            WC 2026
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Knockout Bracket</div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Teams fill in as groups complete · refreshed when admin syncs scores
          </div>
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '16px' }}>{error}</div>
        )}

        {STAGE_ORDER.map((stage) => {
          const stageMatches = grouped.get(stage) ?? []
          if (stageMatches.length === 0) return null

          return (
            <div key={stage} style={{ marginBottom: '24px' }}>
              {/* Round header */}
              <div style={{
                background: '#181c24',
                border: '0.5px solid #2a2f3d',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <div style={{
                  fontSize: '11px', color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: '0.8px', marginBottom: '12px', fontWeight: 500,
                }}>
                  {STAGE_LABELS[stage]}
                </div>

                {/* For Round of 32, split into 2-column grid on wider screens */}
                {stage === 'R32' ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '0',
                  }}>
                    {stageMatches.map(m => <MatchCard key={m.id} match={m} />)}
                  </div>
                ) : (
                  stageMatches.map(m => <MatchCard key={m.id} match={m} />)
                )}
              </div>
            </div>
          )
        })}

      </div>
    </main>
  )
}
