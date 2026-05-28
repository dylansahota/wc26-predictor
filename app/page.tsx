'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PLAYERS = ['Damien', 'Tunde', 'Gowth', 'Dyl']

export default function LoginPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!name || pin.length !== 4) {
      setError('Select your name and enter your 4-digit PIN')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/predict')
  }

  return (
    <main style={{
      background: '#0f1117',
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Manrope, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚽</div>
          <h1 style={{ color: '#4ade80', fontSize: '22px', fontWeight: 500, marginBottom: '6px' }}>
            WC26 Predictor
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Who are you?</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {PLAYERS.map(player => (
            <button
              key={player}
              onClick={() => setName(player)}
              style={{
                padding: '14px',
                background: name === player ? '#14532d' : '#181c24',
                border: `0.5px solid ${name === player ? '#4ade80' : '#2a2f3d'}`,
                borderRadius: '10px',
                color: name === player ? '#4ade80' : '#9ca3af',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {player}
            </button>
          ))}
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="Enter PIN"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          style={{
            width: '100%',
            padding: '14px',
            background: '#181c24',
            border: '0.5px solid #2a2f3d',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '20px',
            textAlign: 'center',
            letterSpacing: '8px',
            fontFamily: 'inherit',
            outline: 'none',
            marginBottom: '16px',
          }}
        />

        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#14532d' : '#4ade80',
            border: 'none',
            borderRadius: '10px',
            color: '#0f1117',
            fontSize: '15px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </main>
  )
}
