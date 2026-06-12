import { SYNC_ENDPOINT, IMPORT_COURSES_ENDPOINT } from './urls'
import type { SyncType, CourseImportItem } from './messages'

export interface SyncPayload {
  type: SyncType
  url: string
  html: string
}

function getStoredToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get('access_token', result => {
      resolve((result['access_token'] as string | undefined) ?? null)
    })
  })
}

export async function postToBackend(payload: SyncPayload): Promise<void> {
  const token = await getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
}

export async function importCourses(courses: CourseImportItem[]): Promise<number> {
  const token = await getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(IMPORT_COURSES_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ courses }),
  })
  if (!res.ok) throw new Error(`Import courses failed: ${res.status}`)
  const data = await res.json() as { count: number }
  return data.count
}
