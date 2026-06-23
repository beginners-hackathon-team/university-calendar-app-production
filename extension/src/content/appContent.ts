// 自作アプリ上の LMS リンクをインターセプトし、
// Background 経由でタブを開いてアプリのタブIDを保存する

import { ACANTHUS_HOST, LMS_HOST } from '../shared/urls'

// インストール済みであることを Web アプリに通知
console.log('[ku-calendar-extension] appContent injected, sending EXTENSION_INSTALLED')
window.postMessage({ source: 'ku-calendar-extension', type: 'EXTENSION_INSTALLED' }, '*')

const QUARTER_MAP: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }

const LMS_ANCHOR_SELECTOR = `a[href*="${ACANTHUS_HOST}"], a[href*="${LMS_HOST}"]`

function saveSupabaseToken(): void {
  // localStorage から Supabase のセッショントークンを取得して chrome.storage.local に保存
  const authKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!authKey) return

  try {
    const raw = localStorage.getItem(authKey)
    const session = raw ? JSON.parse(raw) : null
    const access_token = session?.access_token ?? null
    const refresh_token = session?.refresh_token ?? null
    chrome.storage.local.set({ access_token, refresh_token })
  } catch {
    // JSON parse 失敗時は無視
  }
}

// ページ読み込み時にトークンを保存
saveSupabaseToken()

// localStorage の変化（トークン更新）を監視
window.addEventListener('storage', e => {
  if (e.key?.startsWith('sb-') && e.key.endsWith('-auth-token')) {
    saveSupabaseToken()
  }
})

document.addEventListener('click', e => {
  const target = e.target as HTMLElement

  // LMS リンク（Acanthus SSO または WebClass 直リンク）
  const lmsAnchor = target.closest(LMS_ANCHOR_SELECTOR) as HTMLAnchorElement | null
  if (lmsAnchor) {
    e.preventDefault()
    e.stopPropagation()
    chrome.runtime.sendMessage({ type: 'OPEN_LMS_TAB', url: lmsAnchor.href })
    return
  }

  // ポータル履修一覧リンク
  const portalAnchor = target.closest('a[href*="RegistList.aspx"]') as HTMLAnchorElement | null
  if (portalAnchor) {
    e.preventDefault()
    e.stopPropagation()
    const params = new URLSearchParams(new URL(portalAnchor.href).search)
    const targetTerm = params.get('targetTerm') ?? 'Q1'
    const quarter = QUARTER_MAP[targetTerm] ?? 1
    chrome.runtime.sendMessage({ type: 'OPEN_PORTAL_TAB', url: portalAnchor.href, quarter })
  }
}, true)
