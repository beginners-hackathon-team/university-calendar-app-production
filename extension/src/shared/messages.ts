export type SyncType = 'regist-list' | 'lecture-detail' | 'lms-course' | 'my-reports'

export interface ImportAssignmentItem {
  task_name: string
  task_contents_id: string
  course_name: string | null
  submitted_at: string | null
  result: string
  score: string | null
}

export interface ImportAssignmentsMessage {
  type: 'IMPORT_ASSIGNMENTS'
  assignments: ImportAssignmentItem[]
}

export interface ImportLmsTaskItem {
  content_id: string | null
  source_url: string | null
  title: string
  kind: string | null
  course_id: string | null
  course_name: string | null
  available_from: string | null  // "2026/06/29 20:01"
  available_until: string | null // "2026/07/06 20:00"
  raw_text: string | null
  is_active_url: boolean
}

export interface ImportLmsTasksMessage {
  type: 'IMPORT_LMS_TASKS'
  tasks: ImportLmsTaskItem[]
}

export interface ImportLmsTasksResponse {
  success: boolean
  count?: number
  error?: string
}

export interface FetchUrlMessage {
  type: 'FETCH_URL'
  url: string
}

export interface PostToBackendMessage {
  type: 'POST_TO_BACKEND'
  syncType: SyncType
  url: string
  html: string
}

export interface CourseImportItem {
  name: string
  teacher: string
  room: string
  year: number
  quarter: number
  day_of_week: string | null
  period: number
  is_intensive_lct: boolean
  lms_course_id: string | null
  lms_system_type: string | null
}

export interface ImportCoursesMessage {
  type: 'IMPORT_COURSES'
  courses: CourseImportItem[]
  syncYear: number
  syncQuarters: number[]
}

export interface OpenLmsTabMessage {
  type: 'OPEN_LMS_TAB'
  url: string
}

export interface OpenPortalTabMessage {
  type: 'OPEN_PORTAL_TAB'
  url: string
  quarter: number
}

export interface ReturnToAppMessage {
  type: 'RETURN_TO_APP'
  quarter?: number
  path?: string  // '/tasks' | '/courses' etc.
}

export interface RefreshTokenMessage {
  type: 'REFRESH_TOKEN'
}

export interface RefreshTokenResponse {
  success: boolean
  access_token?: string
  error?: string
}

export interface GetSyncModeMessage {
  type: 'GET_SYNC_MODE'
}

export interface GetSyncModeResponse {
  success: boolean
  mode?: 'auto' | 'manual'
  auth_required?: boolean
  error?: string
}

export interface FetchAppApiMessage {
  type: 'FETCH_APP_API'
  path: string
}

export interface FetchAppApiResponse {
  success: boolean
  data?: unknown
  status?: number
  error?: string
}

export type Message =
  | FetchUrlMessage
  | PostToBackendMessage
  | ImportCoursesMessage
  | ImportAssignmentsMessage
  | ImportLmsTasksMessage
  | OpenLmsTabMessage
  | OpenPortalTabMessage
  | ReturnToAppMessage
  | RefreshTokenMessage
  | GetSyncModeMessage
  | FetchAppApiMessage

export interface FetchUrlResponse {
  success: boolean
  html?: string
  error?: string
}

export interface PostResponse {
  success: boolean
  error?: string
}

export interface ImportCoursesResponse {
  success: boolean
  count?: number
  error?: string
}

export interface ImportAssignmentsResponse {
  success: boolean
  count?: number
  error?: string
}

export interface OpenLmsTabResponse {
  success: boolean
}

export interface OpenPortalTabResponse {
  success: boolean
}

export interface ReturnToAppResponse {
  success: boolean
}
