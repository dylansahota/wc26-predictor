'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

interface TeamRow {
  position: number
  team: string
  flag: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  group?: string
}

interface Group {
  name: string
  table: TeamRow[]
}

export default function GroupsPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [thirdPlace, setThirdPlace] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/'); return }
      const session = await sessionRes.json()
      setPlayerName(session.name)

      const res = await fetch('/api/groups')
      if (!res.ok) {
        setError('Could not load standings')
        setLoading(false)
        return
      }
      const data = await res.json()
      setGroups(data.groups)
      setThirdPlace(data.thirdPlace)
      setLoading(false)
    }
    load()
  }, [router])

  function gdDisplay(gd: number) {
    if (gd > 0) return `+${gd}`
    return `${gd}`
  }

  if (loading) {
    return (
      <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
        <NavBar playerName="" />
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </main>
    )
  }

  if (error || groups.length === 0) {
    return (
      <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
        <NavBar playerName={playerName} />
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>
          {error || 'Standings not available yet'}
        </div>
      </main>
    )
  }

  const headerCell = (label: string, right = false) => (
    <div style={{
      fontSize: '10px', color: '#4b5563', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.4px',
      textAlign: right ? 'right' : 'left',
    }}>{label}</div>
  )

  const col = (val: string | number, highlight = false, right = true) => (
    <div style={{
      fontSize: '12px', textAlign: right ? 'right' : 'left',
      color: highlight ? '#fff' : '#6b7280', fontWeight: highlight ? 600 : 400,
      minWidth: '18px',
    }}>{val}</div>
  )

  return (
    <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
      <NavBar playerName={playerName} />
      <div style={{ padding: '16px' }}>

        {/* Group tables */}
        {groups.map(group => (
          <div key={group.name} style={{
            background: '#181c24', border: '0.5px solid #2a2f3d',
            borderRadius: '12px', marginBottom: '12px', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 14px 8px',
              borderBottom: '0.5px solid #2a2f3d',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>{group.name}</span>
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '20px 1fr 22px 22px 22px 22px 30px 28px',
              gap: '4px', padding: '6px 14px', borderBottom: '0.5px solid #1a1f2e',
            }}>
              {headerCell('#')}
              {headerCell('Team', false)}
              {headerCell('P')}
              {headerCell('W')}
              {headerCell('D')}
              {headerCell('L')}
              {headerCell('GD')}
              {headerCell('Pts')}
            </div>

            {/* Rows */}
            {group.table.map((row, i) => {
              const qualifying = i < 2
              const borderLeft = qualifying
                ? '2px solid #4ade80'
                : i === 2 ? '2px solid #f59e0b' : '2px solid transparent'

              return (
                <div key={row.team} style={{
                  display: 'grid', gridTemplateColumns: '20px 1fr 22px 22px 22px 22px 30px 28px',
                  gap: '4px', padding: '8px 14px',
                  borderBottom: i < group.table.length - 1 ? '0.5px solid #1a1f2e' : 'none',
                  borderLeft,
                  background: qualifying ? '#181c2488' : 'transparent',
                }}>
                  <div style={{ fontSize: '11px', color: '#4b5563' }}>{row.position}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{row.flag}</span>
                    <span style={{
                      fontSize: '12px', color: '#e5e7eb',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{row.team}</span>
                  </div>
                  {col(row.played)}
                  {col(row.won)}
                  {col(row.drawn)}
                  {col(row.lost)}
                  {col(gdDisplay(row.goalDifference), false)}
                  {col(row.points, true)}
                </div>
              )
            })}
          </div>
        ))}

        {/* 3rd place standings */}
        {thirdPlace.length > 0 && (
          <div style={{
            background: '#181c24', border: '0.5px solid #2a2f3d',
            borderRadius: '12px', marginBottom: '12px', overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px 8px', borderBottom: '0.5px solid #2a2f3d' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>3rd Place Standings</span>
              <span style={{ fontSize: '11px', color: '#4b5563', marginLeft: '8px' }}>best 8 of 12 qualify</span>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '20px 80px 1fr 22px 22px 22px 22px 30px 28px',
              gap: '4px', padding: '6px 14px', borderBottom: '0.5px solid #1a1f2e',
            }}>
              {headerCell('#')}
              {headerCell('Grp')}
              {headerCell('Team', false)}
              {headerCell('P')}
              {headerCell('W')}
              {headerCell('D')}
              {headerCell('L')}
              {headerCell('GD')}
              {headerCell('Pts')}
            </div>

            {thirdPlace.map((row, i) => {
              const qualifying = i < 8
              const cutoff = i === 8

              return (
                <div key={row.team}>
                  {cutoff && (
                    <div style={{
                      padding: '4px 14px', fontSize: '10px', color: '#ef4444',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderTop: '0.5px solid #ef444433',
                    }}>
                      Elimination zone
                    </div>
                  )}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '20px 80px 1fr 22px 22px 22px 22px 30px 28px',
                    gap: '4px', padding: '8px 14px',
                    borderBottom: i < thirdPlace.length - 1 ? '0.5px solid #1a1f2e' : 'none',
                    borderLeft: qualifying ? '2px solid #f59e0b' : '2px solid transparent',
                  }}>
                    <div style={{ fontSize: '11px', color: '#4b5563' }}>{i + 1}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563' }}>{row.group}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{row.flag}</span>
                      <span style={{
                        fontSize: '12px', color: qualifying ? '#e5e7eb' : '#6b7280',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{row.team}</span>
                    </div>
                    {col(row.played)}
                    {col(row.won)}
                    {col(row.drawn)}
                    {col(row.lost)}
                    {col(gdDisplay(row.goalDifference))}
                    {col(row.points, qualifying)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#374151', textAlign: 'center', paddingBottom: '8px' }}>
          Green border = qualified · Amber border = 3rd place contender
        </div>
      </div>
    </main>
  )
}
