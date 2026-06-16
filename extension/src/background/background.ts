import type {
  Message,
  FetchUrlResponse,
  PostResponse,
  ImportCoursesResponse,
  ImportAssignmentsResponse,
  ImportLmsTasksResponse,
  OpenLmsTabResponse,
  OpenPortalTabResponse,
  ReturnToAppResponse,
  RefreshTokenResponse,
  GetSyncModeResponse,
  FetchAppApiResponse,
} from '../shared/messages'
import { postToBackend, importCourses, importAssignments, importLmsTasks } from '../shared/api'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const APP_URL = import.meta.env.VITE_APP_URL as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !APP_URL) {
  throw new Error('[extension] Required env vars missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL')
}

type AnyResponse =
  | FetchUrlResponse
  | PostResponse
  | ImportCoursesResponse
  | ImportAssignmentsResponse
  | ImportLmsTasksResponse
  | OpenLmsTabResponse
  | OpenPortalTabResponse
  | ReturnToAppResponse
  | FetchAppApiResponse
  | RefreshTokenResponse
  | GetSyncModeResponse

// Supabase refresh token → 新しい access_token を返す（失敗時は null）
async function refreshAccessToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get(['refresh_token'], result => {
      const refreshToken = result['refresh_token'] as string | undefined
      if (!refreshToken) { resolve(null); return }

      fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
        .then(res => res.ok
          ? res.json() as Promise<{ access_token: string; refresh_token: string }>
          : Promise.reject(new Error(`supabase refresh failed: ${res.status}`))
        )
        .then(data => {
          chrome.storage.local.set({ access_token: data.access_token, refresh_token: data.refresh_token })
          resolve(data.access_token)
        })
        .catch(() => resolve(null))
    })
  })
}

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (r: AnyResponse) => void) => {
    if (message.type === 'FETCH_URL') {
      fetch(message.url)
        .then(res => res.text())
        .then(html => sendResponse({ success: true, html }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'POST_TO_BACKEND') {
      postToBackend({ type: message.syncType, url: message.url, html: message.html })
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_COURSES') {
      const syncYear = message.syncYear
      const syncQuarters = message.syncQuarters
      importCourses(message.courses, syncYear, syncQuarters)
        .then(async count => {
          // インポート成功後、該当学期のキャッシュを即時更新（再フェッチ）
          const QUARTER_KEY: Record<number, string> = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' }
          try {
            const stored = await chrome.storage.local.get(['access_token', 'cachedCoursesByQuarter'])
            const token = stored['access_token'] as string | undefined
            const existing = (stored['cachedCoursesByQuarter'] ?? {}) as Record<string, unknown[]>

            if (token) {
              const fetched = await Promise.all(
                syncQuarters.map(async q => {
                  const key = QUARTER_KEY[q]
                  if (!key) return null
                  const res = await fetch(`${APP_URL}/api/courses/${syncYear}-${q}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!res.ok) return null
                  return [key, await res.json()] as [string, unknown[]]
                })
              )
              const newCache = { ...existing }
              for (const entry of fetched) {
                if (entry) newCache[entry[0]] = entry[1]
              }
              chrome.storage.local.set({
                cachedCoursesByQuarter: newCache,
                cachedCoursesUpdatedAt: new Date().toISOString(),
              })
            } else {
              chrome.storage.local.remove(['cachedCoursesByQuarter', 'cachedCoursesUpdatedAt'])
            }
          } catch {
            chrome.storage.local.remove(['cachedCoursesByQuarter', 'cachedCoursesUpdatedAt'])
          }

          sendResponse({ success: true, count })
        })
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_ASSIGNMENTS') {
      importAssignments(message.assignments)
        .then(count => sendResponse({ success: true, count }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_LMS_TASKS') {
      importLmsTasks(message.tasks)
        .then(count => sendResponse({ success: true, count }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'OPEN_LMS_TAB') {
      const tabId = sender.tab?.id ?? null
      const appUrl = sender.tab?.url ?? APP_URL
      chrome.storage.session.set({ appTabId: tabId, appUrl }, () => {
        chrome.tabs.create({ url: message.url })
        sendResponse({ success: true })
      })
      return true
    }

    if (message.type === 'OPEN_PORTAL_TAB') {
      const tabId = sender.tab?.id ?? null
      const appUrl = sender.tab?.url ?? APP_URL
      chrome.storage.session.set({ appTabId: tabId, appUrl }, () => {
        chrome.tabs.create({ url: message.url })
        sendResponse({ success: true })
      })
      return true
    }

    if (message.type === 'REFRESH_TOKEN') {
      refreshAccessToken()
        .then(token => {
          if (token) sendResponse({ success: true, access_token: token })
          else sendResponse({ success: false, error: 'refresh failed' })
        })
      return true
    }

    if (message.type === 'GET_SYNC_MODE') {
      ;(async () => {
        // トークン取得（なければ refresh を試みる）
        let token = ((await chrome.storage.local.get(['access_token']))['access_token'] as string | undefined) ?? null
        console.log('[background] GET_SYNC_MODE: token exists=', !!token)
        if (!token) {
          token = await refreshAccessToken()
          console.log('[background] GET_SYNC_MODE: after refresh, token exists=', !!token)
          if (!token) { sendResponse({ success: false, auth_required: true }); return }
        }

        const fetchMode = async (t: string): Promise<'auto' | 'manual'> => {
          const res = await fetch(`${APP_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${t}` },
          })
          console.log('[background] GET_SYNC_MODE: /api/me status=', res.status)
          if (res.status === 401 || res.status === 403) {
            throw Object.assign(new Error('auth'), { isAuth: true })
          }
          if (!res.ok) throw new Error(`/api/me failed: ${res.status}`)
          const data = await res.json() as { assignment_sync_mode?: string }
          console.log('[background] GET_SYNC_MODE: assignment_sync_mode=', data.assignment_sync_mode)
          return data.assignment_sync_mode === 'manual' ? 'manual' : 'auto'
        }

        try {
          const mode = await fetchMode(token)
          console.log('[background] GET_SYNC_MODE: responding mode=', mode)
          sendResponse({ success: true, mode })
        } catch (e: unknown) {
          if (e instanceof Error && (e as Error & { isAuth?: boolean }).isAuth) {
            // 401/403 → refresh して1回だけリトライ
            const newToken = await refreshAccessToken()
            if (!newToken) { sendResponse({ success: false, auth_required: true }); return }
            try {
              const mode = await fetchMode(newToken)
              console.log('[background] GET_SYNC_MODE: retry responding mode=', mode)
              sendResponse({ success: true, mode })
            } catch {
              sendResponse({ success: false, auth_required: true })
            }
          } else {
            // ネットワークエラー等: デフォルト 'auto' を返す
            console.warn('[background] GET_SYNC_MODE: network error, defaulting to auto', e)
            sendResponse({ success: true, mode: 'auto' })
          }
        }
      })()
      return true
    }

    if (message.type === 'FETCH_APP_API') {
      ;(async () => {
        const stored = await chrome.storage.local.get(['access_token'])
        const token = (stored['access_token'] as string | undefined) ?? null
        if (!token) { sendResponse({ success: false, status: 401, error: 'no token' }); return }
        try {
          const res = await fetch(`${APP_URL}${message.path}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) { sendResponse({ success: false, status: res.status, error: `${res.status}` }); return }
          const data = await res.json()
          sendResponse({ success: true, data })
        } catch (e) {
          sendResponse({ success: false, error: String(e) })
        }
      })()
      return true
    }

    if (message.type === 'RETURN_TO_APP') {
      const portalTabId = sender.tab?.id ?? null

      chrome.storage.session.get(['appTabId', 'appUrl'], result => {
        const savedAppTabId = (result['appTabId'] as number | undefined) ?? null
        const savedAppUrl = (result['appUrl'] as string | undefined) || APP_URL

        const returnUrl = message.path
          ? (() => { const u = new URL(savedAppUrl); u.pathname = message.path!; return u.toString() })()
          : (() => {
              const u = new URL(savedAppUrl)
              u.pathname = '/courses'
              if (message.quarter != null) u.searchParams.set('returnQuarter', String(message.quarter))
              return u.toString()
            })()

        const closePortal = () => {
          if (portalTabId !== null) chrome.tabs.remove(portalTabId)
          sendResponse({ success: true })
        }

        if (savedAppTabId !== null) {
          chrome.tabs.get(savedAppTabId, tab => {
            if (chrome.runtime.lastError || !tab) {
              chrome.tabs.create({ url: returnUrl })
            } else {
              chrome.tabs.update(savedAppTabId, { url: returnUrl, active: true }, t => {
                if (t?.windowId != null) {
                  chrome.windows.update(t.windowId, { focused: true })
                }
              })
            }
            closePortal()
          })
        } else {
          chrome.tabs.create({ url: returnUrl })
          closePortal()
        }
      })
      return true
    }
  }
)
