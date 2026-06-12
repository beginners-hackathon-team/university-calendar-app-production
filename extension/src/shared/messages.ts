export type SyncType = 'regist-list' | 'lecture-detail' | 'lms-course' | 'my-reports'

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
}

export type Message =
  | FetchUrlMessage
  | PostToBackendMessage
  | ImportCoursesMessage
  | OpenLmsTabMessage
  | OpenPortalTabMessage
  | ReturnToAppMessage

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

export interface OpenLmsTabResponse {
  success: boolean
}

export interface OpenPortalTabResponse {
  success: boolean
}

export interface ReturnToAppResponse {
  success: boolean
}
