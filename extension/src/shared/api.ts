import type { SyncType, CourseImportItem, ImportAssignmentItem, ImportLmsTaskItem } from './messages'

const APP_URL = import.meta.env.VITE_APP_URL as string
if (!APP_URL) {
  throw new Error('[extension] Required env var missing: VITE_APP_URL')
}

const SYNC_ENDPOINT = `${APP_URL}/api/extension/sync`
const IMPORT_COURSES_ENDPOINT = `${APP_URL}/api/extension/import-courses`
const IMPORT_ASSIGNMENTS_ENDPOINT = `${APP_URL}/api/extension/import-assignments`
const IMPORT_LMS_TASKS_ENDPOINT = `${APP_URL}/api/extension/import-lms-tasks`

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

export async function importCourses(
  courses: CourseImportItem[],
  syncYear: number,
  syncQuarters: number[],
): Promise<number> {
  const token = await getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(IMPORT_COURSES_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ courses, sync_year: syncYear, sync_quarters: syncQuarters }),
  })
  if (!res.ok) throw new Error(`Import courses failed: ${res.status}`)
  const data = await res.json() as { count: number }
  return data.count
}

export async function importAssignments(assignments: ImportAssignmentItem[]): Promise<number> {
  const token = await getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(IMPORT_ASSIGNMENTS_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ assignments }),
  })
  if (!res.ok) throw new Error(`Import assignments failed: ${res.status}`)
  const data = await res.json() as { count: number }
  return data.count
}

export async function importLmsTasks(tasks: ImportLmsTaskItem[]): Promise<number> {
  const token = await getStoredToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(IMPORT_LMS_TASKS_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tasks }),
  })
  if (!res.ok) throw new Error(`Import LMS tasks failed: ${res.status}`)
  const data = await res.json() as { count: number }
  return data.count
}
