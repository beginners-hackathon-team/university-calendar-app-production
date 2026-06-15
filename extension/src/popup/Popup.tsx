/// <reference types="chrome" />
import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './popup.css'

const APP_URL = import.meta.env.VITE_APP_URL as string
if (!APP_URL) throw new Error('[extension] Required env var missing: VITE_APP_URL')

function Popup() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    chrome.storage.local.get('access_token', (result: { [key: string]: unknown }) => {
      setIsLoggedIn(!!(result['access_token'] as string | undefined))
    })
  }, [])

  return (
    <div style={{ width: 280, padding: 16, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isLoggedIn ? '#22c55e' : '#94a3b8',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, color: '#374151' }}>
          {isLoggedIn ? 'ログイン済み' : '未ログイン'}
        </span>
      </div>

      <button
        onClick={() => chrome.tabs.create({ url: APP_URL })}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#1d4ed8',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          marginBottom: 10,
        }}
      >
        アプリを開く
      </button>

      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
        {isLoggedIn
          ? 'ポータルやLMSページで各種ボタンが表示されます。'
          : 'アプリにログインすると拡張機能が利用できます。'}
      </p>
    </div>
  )
}

const root = document.getElementById('root')!
createRoot(root).render(<Popup />)
