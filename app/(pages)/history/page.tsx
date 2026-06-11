'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

interface PlayerSlot {
  player_id: number
  name: string
  colour: string
  prediction: { home_score: number; away_score: number; points: number | null } | null
}

interface Match {
  id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  home_score: number | null
  away_score: number | null
  kickoff_utc: string
  et_date: string
  stage: string
  status: string
  predictions: PlayerSlot[]
}

interface Group {
  et_date: string
  matches: Match[]
}

export default function HistoryPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/'); return }
      const session = await sessionRes.json()
      setPlayerName(session.name)

      const res = await fetch('/api/history')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setGroups(data.groups)
      setLoading(false)
    }
    load()
  }, [router])

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split('-')
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    })
  }

  function formatKickoff(utcStr: string) {
    return new Date(utcStr).toLocaleTimeString('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
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

        {groups.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
            No results yet
          </div>
        ) : (
          groups.map(group => (
            <div key={group.et_date} style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px', color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                marginBottom: '10px', fontWeight: 500,
              }}>
                {formatDate(group.et_date)}
              </div>

              {group.matches.map(match => {
                const finished = match.status === 'finished'
                return (
                  <div key={match.id} style={{
                    background: '#181c24',
                    border: '0.5px solid #2a2f3d',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '10px',
                  }}>
                    {/* Teams + result */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '20px', display: 'block' }}>{match.home_flag}</span>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{match.home_team}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0 12px' }}>
                        {finished ? (
                          <div style={{ fontSize: '20px', fontWeight: 600, color: '#4ade80', letterSpacing: '2px' }}>
                            {match.home_score} – {match.away_score}
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', letterSpacing: '1px' }}>
                            TBC
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '2px' }}>
                          {formatKickoff(match.kickoff_utc)}
                        </div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <span style={{ fontSize: '20px', display: 'block', textAlign: 'right' }}>{match.away_flag}</span>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', textAlign: 'right' }}>{match.away_team}</div>
                      </div>
                    </div>

                    {/* Predictions grid — all 4 players always shown */}
                    <div style={{
                      background: '#0f1117',
                      border: '0.5px solid #2a2f3d',
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Predictions
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {match.predictions.map(slot => {
                          const correct = finished && slot.prediction?.points === 1
                          return (
                            <div key={slot.player_id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#181c24',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              border: `0.5px solid ${correct ? '#4ade8033' : 'transparent'}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                  width: '6px', height: '6px',
                                  borderRadius: '50%',
                                  background: slot.colour,
                                  flexShrink: 0,
                                }} />
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{slot.name}</span>
                              </div>
                              {slot.prediction ? (
                                <span style={{
                                  fontSize: '13px', fontWeight: 500,
                                  color: correct ? '#4ade80' : '#6b7280',
                                }}>
                                  {slot.prediction.home_score}–{slot.prediction.away_score}
                                </span>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>
                                  N/A
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </main>
  )
}
