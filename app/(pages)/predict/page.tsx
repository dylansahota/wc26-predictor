'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

interface Match {
  id: number
  home_team: string
  away_team: string
  home_flag: string
  away_flag: string
  kickoff_utc: string
  home_score: number | null
  away_score: number | null
  status: string
}

interface Prediction {
  match_id: number
  home_score: number
  away_score: number
  points: number | null
}

interface OtherPrediction {
  match_id: number
  home_score: number
  away_score: number
  player_id: number
  players: { name: string; colour: string }
}

export default function PredictPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [myPredictions, setMyPredictions] = useState<Record<number, { home: string; away: string }>>({})
  const [otherPredictions, setOtherPredictions] = useState<OtherPrediction[]>([])
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      // Get session
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/'); return }
      const session = await sessionRes.json()
      setPlayerName(session.name)

      // Get today's ET date
      const etDate = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const [month, day, year] = etDate.split('/')
      const dateStr = `${year}-${month}-${day}`

      const res = await fetch(`/api/matches?date=${dateStr}`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()

      setMatches(data.matches)
      setDeadline(data.deadline ? new Date(data.deadline) : null)
      setDeadlinePassed(data.deadlinePassed)
      setOtherPredictions(data.otherPredictions)

      // Pre-fill my predictions
      const preds: Record<number, { home: string; away: string }> = {}
      data.myPredictions.forEach((p: Prediction) => {
        preds[p.match_id] = {
          home: p.home_score.toString(),
          away: p.away_score.toString(),
        }
      })
      setMyPredictions(preds)
      if (data.myPredictions.length > 0) setSubmitted(true)
      setLoading(false)
    }
    load()
  }, [router])

  function updateScore(matchId: number, side: 'home' | 'away', value: string) {
    const clean = value.replace(/\D/g, '').slice(0, 2)
    setMyPredictions(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: clean },
    }))
  }

  async function handleSubmit() {
    const predictions = matches.map(m => ({
      match_id: m.id,
      home_score: parseInt(myPredictions[m.id]?.home ?? ''),
      away_score: parseInt(myPredictions[m.id]?.away ?? ''),
    }))

    if (predictions.some(p => isNaN(p.home_score) || isNaN(p.away_score))) {
      setError('Fill in all scores before submitting')
      return
    }

    setSubmitting(true)
    setError('')

    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictions }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  function getOthersForMatch(matchId: number) {
    return otherPredictions.filter(p => p.match_id === matchId)
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

        {deadline && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: '#1a1f2e', border: '0.5px solid #2a2f3d',
              borderRadius: '6px', padding: '3px 8px', fontSize: '11px',
              color: deadlinePassed ? '#ef4444' : '#f59e0b',
            }}>
              {deadlinePassed ? 'Deadline passed' : `Locks at ${deadline.toLocaleTimeString('en-GB', {
                timeZone: 'Europe/London',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}`}
            </div>
          </div>
        )}

        {matches.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
            No matches today
          </div>
        )}

        {matches.map(match => {
          const others = getOthersForMatch(match.id)
          return (
            <div key={match.id} style={{
              background: '#181c24',
              border: '0.5px solid #2a2f3d',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '10px',
              opacity: deadlinePassed ? 0.8 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '22px', display: 'block' }}>{match.home_flag}</span>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{match.home_team}</div>
                </div>
                <div style={{ fontSize: '11px', color: '#4b5563', padding: '0 8px' }}>vs</div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <span style={{ fontSize: '22px', display: 'block', textAlign: 'right' }}>{match.away_flag}</span>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{match.away_team}</div>
                </div>
              </div>

              {match.status === 'finished' ? (
                <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 500, color: '#4ade80' }}>
                  {match.home_score} – {match.away_score}
                </div>
              ) : deadlinePassed ? (
                <div style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                  {myPredictions[match.id]
                    ? `Your pick: ${myPredictions[match.id].home} – ${myPredictions[match.id].away}`
                    : 'No pick submitted'}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={0} max={20}
                    value={myPredictions[match.id]?.home ?? ''}
                    onChange={e => updateScore(match.id, 'home', e.target.value)}
                    placeholder="0"
                    style={{
                      width: '44px', height: '44px',
                      background: '#0f1117', border: '0.5px solid #374151',
                      borderRadius: '8px', color: '#fff', fontSize: '20px',
                      fontWeight: 500, textAlign: 'center', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '18px', color: '#4b5563' }}>–</span>
                  <input
                    type="number"
                    min={0} max={20}
                    value={myPredictions[match.id]?.away ?? ''}
                    onChange={e => updateScore(match.id, 'away', e.target.value)}
                    placeholder="0"
                    style={{
                      width: '44px', height: '44px',
                      background: '#0f1117', border: '0.5px solid #374151',
                      borderRadius: '8px', color: '#fff', fontSize: '20px',
                      fontWeight: 500, textAlign: 'center', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              )}

              {deadlinePassed && others.length > 0 && (
                <div style={{
                  background: '#0f1117', border: '0.5px solid #2a2f3d',
                  borderRadius: '8px', padding: '10px 14px', marginTop: '10px',
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Others predicted
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {others.map((o, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: '#181c24', borderRadius: '6px', padding: '5px 10px',
                      }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{o.players.name}</span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: o.players.colour }}>
                          {o.home_score}–{o.away_score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!deadlinePassed && matches.length > 0 && (
          <>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
                {error}
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px',
                background: submitted ? '#14532d' : '#4ade80',
                border: submitted ? '0.5px solid #4ade80' : 'none',
                borderRadius: '10px',
                color: submitted ? '#4ade80' : '#0f1117',
                fontSize: '15px', fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Submitting...' : submitted ? 'Predictions saved — update?' : 'Submit predictions'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
