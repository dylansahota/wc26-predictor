'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

interface SyncResult {
  matchesChecked: number
  scored: number
  teamUpdates: number
  bracketDiag: {
    completedGroups: string[]
    incompleteGroups: string[]
    slotsUpdated: number
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [bracketRefreshing, setBracketRefreshing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [recalcResult, setRecalcResult] = useState<{ recalculated: number; dates: string[] } | null>(null)
  const [bracketResult, setBracketResult] = useState<{
    completedGroups: string[]
    incompleteGroups: string[]
    groupFinishedCounts: Record<string, number>
    slotsUpdated: number
    slots: Array<{ index: number; matchId: number; homeRoute: string; awayRoute: string; curHome: string | null; curAway: string | null; newHome: string | null; newAway: string | null; action: string; errorMsg?: string }>
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/auth/session')
      if (!res.ok) { router.push('/'); return }
      const session = await res.json()
      if (session.name !== 'Dyl') { router.push('/predict'); return }
      setPlayerName(session.name)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSync() {
    setSyncing(true)
    setResult(null)
    setError('')

    const res = await fetch('/api/admin/sync', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Sync failed')
    } else {
      setResult(data)
    }
    setSyncing(false)
  }

  async function handleBracketRefresh() {
    setBracketRefreshing(true)
    setBracketResult(null)
    const res = await fetch('/api/admin/bracket-slots', { method: 'POST' })
    const data = await res.json()
    setBracketResult(res.ok ? data : null)
    setBracketRefreshing(false)
  }

  async function handleRecalc() {
    setRecalcing(true)
    setRecalcResult(null)
    setError('')
    const res = await fetch('/api/admin/recalc', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Recalc failed')
    } else {
      setRecalcResult(data)
    }
    setRecalcing(false)
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
            Admin
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Controls</div>
        </div>

        {/* Force sync card */}
        <div style={{
          background: '#181c24',
          border: '0.5px solid #2a2f3d',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Force results sync</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
            Pulls latest scores from football-data.org, updates match results, scores predictions, and refreshes knockout team names. One API call regardless of how many matches.
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              width: '100%', padding: '12px',
              background: syncing ? '#14532d' : '#4ade80',
              border: syncing ? '0.5px solid #4ade80' : 'none',
              borderRadius: '8px',
              color: syncing ? '#4ade80' : '#0f1117',
              fontSize: '13px', fontWeight: 500,
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {syncing ? 'Syncing...' : 'Sync all scores'}
          </button>

          {result && (
            <div style={{
              marginTop: '12px',
              background: '#0f1117',
              border: '0.5px solid #2a2f3d',
              borderRadius: '8px',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                ✓ Sync complete
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                {[
                  { label: 'Matches checked', value: result.matchesChecked },
                  { label: 'Scored', value: result.scored },
                  { label: 'Team updates', value: result.teamUpdates },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: value > 0 ? '#4ade80' : '#9ca3af' }}>{value}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
                  </div>
                ))}
              </div>
              {result.bracketDiag && (
                <div style={{ borderTop: '0.5px solid #2a2f3d', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                    Bracket slots updated: <span style={{ color: result.bracketDiag.slotsUpdated > 0 ? '#4ade80' : '#9ca3af' }}>{result.bracketDiag.slotsUpdated}</span>
                  </div>
                  {result.bracketDiag.completedGroups.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                      Complete groups: <span style={{ color: '#4ade80' }}>{result.bracketDiag.completedGroups.join(', ')}</span>
                    </div>
                  )}
                  {result.bracketDiag.incompleteGroups.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      In progress: <span style={{ color: '#9ca3af' }}>{result.bracketDiag.incompleteGroups.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#ef4444' }}>{error}</div>
          )}
        </div>

        {/* Recalculate scores card */}
        <div style={{
          background: '#181c24',
          border: '0.5px solid #2a2f3d',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Recalculate leaderboard</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
            Rebuilds daily scores from scratch based on all scored predictions. Use this if the leaderboard looks wrong after a sync.
          </div>

          <button
            onClick={handleRecalc}
            disabled={recalcing}
            style={{
              width: '100%', padding: '12px',
              background: 'none',
              border: `0.5px solid ${recalcing ? '#4ade80' : '#374151'}`,
              borderRadius: '8px',
              color: recalcing ? '#4ade80' : '#9ca3af',
              fontSize: '13px', fontWeight: 500,
              cursor: recalcing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {recalcing ? 'Recalculating...' : 'Recalculate scores'}
          </button>

          {recalcResult && (
            <div style={{
              marginTop: '12px', background: '#0f1117',
              border: '0.5px solid #2a2f3d', borderRadius: '8px', padding: '12px 14px',
            }}>
              <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                ✓ Recalc complete
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                Rebuilt scores for {recalcResult.recalculated} day{recalcResult.recalculated !== 1 ? 's' : ''}: {recalcResult.dates.join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Bracket slots card */}
        <div style={{
          background: '#181c24',
          border: '0.5px solid #2a2f3d',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Refresh bracket slots</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
            Reads group standings from the DB and writes confirmed qualifiers into Round of 32 slots. Clears any premature team names for incomplete groups.
          </div>

          <button
            onClick={handleBracketRefresh}
            disabled={bracketRefreshing}
            style={{
              width: '100%', padding: '12px',
              background: 'none',
              border: `0.5px solid ${bracketRefreshing ? '#4ade80' : '#374151'}`,
              borderRadius: '8px',
              color: bracketRefreshing ? '#4ade80' : '#9ca3af',
              fontSize: '13px', fontWeight: 500,
              cursor: bracketRefreshing ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {bracketRefreshing ? 'Refreshing...' : 'Refresh bracket slots'}
          </button>

          {bracketResult && (
            <div style={{
              marginTop: '12px', background: '#0f1117',
              border: '0.5px solid #2a2f3d', borderRadius: '8px', padding: '12px 14px',
            }}>
              <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                ✓ Bracket refreshed — {bracketResult.slotsUpdated} slot{bracketResult.slotsUpdated !== 1 ? 's' : ''} updated
              </div>
              {bracketResult.completedGroups.length > 0 && (
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                  Complete ({bracketResult.completedGroups.length}): {bracketResult.completedGroups.map(g => `${g}(${bracketResult.groupFinishedCounts[g] ?? 0}/6)`).join(' ')}
                </div>
              )}
              {bracketResult.incompleteGroups.length > 0 && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  In progress: {bracketResult.incompleteGroups.map(g => `${g}(${bracketResult.groupFinishedCounts[g] ?? 0}/6)`).join(' ')}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'monospace', lineHeight: '1.8', overflowX: 'auto' }}>
                {bracketResult.slots.map(s => (
                  <div key={s.index} style={{ color: s.action === 'updated' ? '#4ade80' : s.action === 'error' ? '#ef4444' : '#4b5563' }}>
                    [{s.index}] {s.homeRoute} | {s.curHome ?? 'null'} → {s.newHome ?? 'null'} ({s.action}{s.errorMsg ? `: ${s.errorMsg}` : ''})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
