'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/components/NavBar'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface PlayerStanding {
  id: number
  name: string
  colour: string
  total: number
  series: { date: string; points: number }[]
}


export default function LeaderboardPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [standings, setStandings] = useState<PlayerStanding[]>([])
  const [allDates, setAllDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<ChartJS<'line'>>(null)

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/'); return }
      const session = await sessionRes.json()
      setPlayerName(session.name)

      const res = await fetch('/api/leaderboard')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setStandings(data.standings)
      setAllDates(data.allDates)
      setLoading(false)
    }
    load()
  }, [router])

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split('-')
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    })
  }

  const chartData = {
    labels: allDates.map(formatDate),
    datasets: standings.map((player, i) => ({
      label: player.name,
      data: player.series.map(s => s.points),
      borderColor: player.colour,
      backgroundColor: player.colour + '22',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.2,
    })),
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#181c24',
        borderColor: '#2a2f3d',
        borderWidth: 1,
        titleColor: '#9ca3af',
        bodyColor: '#fff',
      },
    },
    scales: {
      x: {
        grid: { color: '#2a2f3d' },
        ticks: { color: '#6b7280', font: { size: 11 } },
      },
      y: {
        grid: { color: '#2a2f3d' },
        ticks: { color: '#6b7280', font: { size: 11 }, stepSize: 1 },
        beginAtZero: true,
      },
    },
  }

  if (loading) {
    return (
      <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
        <NavBar playerName="" />
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </main>
    )
  }

  const maxPoints = standings.length > 0 ? standings[0].total : 0

  return (
    <main style={{ background: '#0f1117', minHeight: '100svh', fontFamily: 'inherit' }}>
      <NavBar playerName={playerName} />
      <div style={{ padding: '16px' }}>

        {standings.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
            No results yet
          </div>
        ) : (
          <>
            {/* Rankings */}
            <div style={{
              background: '#181c24',
              border: '0.5px solid #2a2f3d',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}>
              {standings.map((player, i) => (
                <div key={player.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: i < standings.length - 1 ? '0.5px solid #2a2f3d' : 'none',
                }}>
                  <div style={{
                    width: '24px',
                    fontSize: '13px',
                    color: i === 0 ? '#f59e0b' : '#6b7280',
                    fontWeight: i === 0 ? 600 : 400,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: player.colour,
                    flexShrink: 0,
                    marginRight: '12px',
                  }} />
                  <div style={{ flex: 1, fontSize: '15px', fontWeight: 500 }}>{player.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {maxPoints > 0 && (
                      <div style={{
                        height: '4px',
                        width: '80px',
                        background: '#0f1117',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(player.total / maxPoints) * 100}%`,
                          background: player.colour,
                          borderRadius: '2px',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: 600, color: player.colour, minWidth: '24px', textAlign: 'right' }}>
                      {player.total}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              {standings.map((player, i) => (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="20" height="10">
                    <line x1="0" y1="5" x2="20" y2="5" stroke={player.colour} strokeWidth="2" />
                  </svg>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{player.name}</span>
                </div>
              ))}
            </div>

            {/* Cumulative chart */}
            {allDates.length > 0 && (
              <div style={{
                background: '#181c24',
                border: '0.5px solid #2a2f3d',
                borderRadius: '12px',
                padding: '16px',
                height: '220px',
              }}>
                <Line ref={chartRef} data={chartData} options={chartOptions as any} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
