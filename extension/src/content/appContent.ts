// 自作アプリ上の LMS リンクをインターセプトし、
// Background 経由でタブを開いてアプリのタブIDを保存する

const QUARTER_MAP: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }

function saveSupabaseToken(): void {
  // localStorage から Supabase のセッショントークンを取得して chrome.storage.local に保存
  const authKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (!authKey) return

  try {
    const raw = localStorage.getItem(authKey)
    const session = raw ? JSON.parse(raw) : null
    const token = session?.access_token ?? null
    chrome.storage.local.set({ access_token: token })
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

  // LMS リンク
  const lmsAnchor = target.closest('a[href*="acanthus.cis.kanazawa-u.ac.jp"]') as HTMLAnchorElement | null
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
