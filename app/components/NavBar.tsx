'use client'

import { useRouter, usePathname } from 'next/navigation'

const BASE_TABS = [
  { label: 'Predict', path: '/predict' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'History', path: '/history' },
]

export default function NavBar({ playerName }: { playerName: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const tabs = playerName === 'Dyl'
    ? [...BASE_TABS, { label: 'Admin', path: '/admin' }]
    : BASE_TABS

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }

  return (
    <>
      <div style={{
        background: '#0f1117',
        borderBottom: '0.5px solid #2a2f3d',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#4ade80', letterSpacing: '-0.3px' }}>
          ⚽ WC26 Predictor
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {playerName} · logout
        </button>
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '0.5px solid #2a2f3d',
        background: '#0f1117',
        position: 'sticky',
        top: '49px',
        zIndex: 9,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            style={{
              flex: 1,
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: '13px',
              color: pathname === tab.path ? '#4ade80' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${pathname === tab.path ? '#4ade80' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  )
}
