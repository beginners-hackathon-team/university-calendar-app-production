export const REGIST_LIST_URL = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Regist/RegistList.aspx'
export const PORTAL_TOP_URL = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Top.aspx'
export const PORTAL_BLANK_URL = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Blank.aspx'

export function buildRegistListUrl(term: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string {
  return `${REGIST_LIST_URL}?targetTerm=${term}`
}
export const LMS_COURSE_BASE = 'https://lms-wc.el.kanazawa-u.ac.jp/webclass/course.php'

const backendBase = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000'
export const SYNC_ENDPOINT = `${backendBase}/api/extension/sync`
export const IMPORT_COURSES_ENDPOINT = `${backendBase}/api/extension/import-courses`
export const IMPORT_ASSIGNMENTS_ENDPOINT = `${backendBase}/api/extension/import-assignments`
export const IMPORT_LMS_TASKS_ENDPOINT = `${backendBase}/api/extension/import-lms-tasks`

export function buildLectureDetailUrl(lctYear: string, lctCd: string): string {
  return `https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Regist/LectureList.aspx?lct_year=${lctYear}&lct_cd=${lctCd}`
}

export function buildMyReportsUrl(courseId: string, token: string): string {
  return `${LMS_COURSE_BASE}/${courseId}/my-reports?acs_=${token}`
}

const SYLLABUS_DETAIL_BASE = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/Public/Syllabus/DetailMain.aspx'
export function buildSyllabusUrl(lctYear: string, lctCd: string): string {
  return `${SYLLABUS_DETAIL_BASE}?lct_year=${lctYear}&lct_cd=${lctCd}`
}

const ACTING_LIST_BASE = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Acting/ActingList.aspx'
export function buildActingListUrl(lctYear: string, lctTerm: string, lctCd: string): string {
  return `${ACTING_LIST_BASE}?lct_year=${lctYear}&lct_term=${lctTerm}&lct_cd=${lctCd}`
}
