import { REGIST_LIST_URL, buildMyReportsUrl, buildSyllabusUrl, buildActingListUrl } from '../shared/urls'

import type {
  FetchUrlMessage,
  PostToBackendMessage,
  ImportCoursesMessage,
  ImportAssignmentsMessage,
  OpenLmsTabMessage,
  ReturnToAppMessage,
  FetchUrlResponse,
  PostResponse,
  ImportCoursesResponse,
  ImportAssignmentsResponse,
  ReturnToAppResponse,
  SyncType,
  CourseImportItem,
  ImportAssignmentItem,
} from '../shared/messages'
import { parseRegisteredCourses } from '../parsers/registParser'
import { parseSyllabusDetail } from '../parsers/syllabusParser'
import { parseActingList } from '../parsers/actingListParser'
import { parseMyReports } from '../parsers/myReportsParser'
import { parseLmsCoursePage } from '../parsers/lmsCourseParser'

const QUARTER_MAP: Record<number, number> = { 11: 1, 12: 2, 21: 3, 22: 4 }
const DAY_STR_MAP: Record<number, string> = { 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' }

function sendMessage<T>(message: FetchUrlMessage | PostToBackendMessage | ImportCoursesMessage | ImportAssignmentsMessage | OpenLmsTabMessage | ReturnToAppMessage): Promise<T> {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve))
}

function fetchUrl(url: string): Promise<FetchUrlResponse> {
  return sendMessage<FetchUrlResponse>({ type: 'FETCH_URL', url })
}

function postToBackend(syncType: SyncType, url: string, html: string): Promise<PostResponse> {
  return sendMessage<PostResponse>({ type: 'POST_TO_BACKEND', syncType, url, html })
}

function importCourses(courses: CourseImportItem[]): Promise<ImportCoursesResponse> {
  return sendMessage<ImportCoursesResponse>({ type: 'IMPORT_COURSES', courses })
}

function importAssignments(assignments: ImportAssignmentItem[]): Promise<ImportAssignmentsResponse> {
  return sendMessage<ImportAssignmentsResponse>({ type: 'IMPORT_ASSIGNMENTS', assignments })
}

function createButton(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'z-index:2147483647',
    'padding:10px 20px',
    'background:#1a56db',
    'color:#fff',
    'border:none',
    'border-radius:6px',
    'cursor:pointer',
    'font-size:14px',
    'font-weight:bold',
    'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
  ].join(';')

  btn.addEventListener('click', async () => {
    btn.disabled = true
    const original = btn.textContent ?? label
    btn.textContent = '送信中...'
    try {
      await onClick()
      btn.textContent = '送信完了!'
    } catch (e) {
      btn.textContent = 'エラー発生'
      console.error('[extension]', e)
    } finally {
      setTimeout(() => {
        btn.textContent = original
        btn.disabled = false
      }, 3000)
    }
  })
  return btn
}

const currentUrl = window.location.href

const TERM_VALUE_MAP: Record<string, string> = { Q1: '11', Q2: '12', Q3: '21', Q4: '22' }
const TERM_QUARTER_MAP: Record<string, number> = { '11': 1, '12': 2, '21': 3, '22': 4 }

// 履修登録一覧ページ
if (currentUrl.startsWith(REGIST_LIST_URL)) {
  // targetTerm を URL から読み取り、sessionStorage に保存してURLから削除
  const params = new URLSearchParams(location.search)
  const targetTerm = params.get('targetTerm')
  if (targetTerm) {
    sessionStorage.setItem('targetTerm', targetTerm)
    history.replaceState(null, '', location.pathname)
  }

  // sessionStorage の targetTerm に応じて select を切り替え
  const savedTerm = sessionStorage.getItem('targetTerm')
  const termValue = savedTerm ? TERM_VALUE_MAP[savedTerm] : undefined
  if (termValue) {
    const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    if (!termSelect) {
      console.warn('[extension] Term select not found')
      sessionStorage.removeItem('targetTerm')
    } else if (termSelect.value !== termValue) {
      sessionStorage.removeItem('targetTerm')
      termSelect.value = termValue
      termSelect.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      sessionStorage.removeItem('targetTerm')
    }
  }

  const btn = createButton('履修情報を取得', async () => {
    const html = document.documentElement.outerHTML
    const parsed = parseRegisteredCourses(html)

    const courses: CourseImportItem[] = await Promise.all(
      parsed.map(async c => {
        const isIntensive = c.dayOfWeek === 0 || c.period === 0

        let room = ''
        let lmsCourseId: string | null = null
        let lmsSystemType: string | null = null

        if (c.lctCd) {
          const lctYear = c.lctYear || String(c.year)
          const [syllabusRes, actingRes] = await Promise.all([
            fetchUrl(buildSyllabusUrl(lctYear, c.lctCd)).catch(() => ({ success: false as const })),
            fetchUrl(buildActingListUrl(lctYear, c.lctTerm, c.lctCd)).catch(() => ({ success: false as const })),
          ])

          if (syllabusRes.success && syllabusRes.html) {
            room = parseSyllabusDetail(syllabusRes.html)
          }
          if (actingRes.success && actingRes.html) {
            const lmsInfo = parseActingList(actingRes.html)
            if (lmsInfo) {
              lmsCourseId = lmsInfo.courseId
              lmsSystemType = lmsInfo.systemType
            }
          }
        }

        return {
          name: c.name,
          teacher: c.teacher,
          room,
          year: c.year,
          quarter: QUARTER_MAP[c.quarter] ?? 1,
          day_of_week: isIntensive ? null : (DAY_STR_MAP[c.dayOfWeek] ?? null),
          period: c.period,
          is_intensive_lct: isIntensive,
          lms_course_id: lmsCourseId,
          lms_system_type: lmsSystemType,
        }
      })
    )

    const res = await importCourses(courses)
    if (!res.success) throw new Error(res.error)
    console.log(`[extension] ${res.count} courses imported`)

    const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    const quarter = termSelect ? (TERM_QUARTER_MAP[termSelect.value] ?? 1) : 1
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter })
  })
  document.body.appendChild(btn)

  const returnBtn = createButton('アプリに戻る', async () => {
    const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    const quarter = termSelect ? (TERM_QUARTER_MAP[termSelect.value] ?? 1) : 1
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter })
  })
  returnBtn.style.top = '70px'
  document.body.appendChild(returnBtn)
}

// LMS全コースページ → 「アプリに戻る」ボタン
if (currentUrl.includes('lms-wc.el.kanazawa-u.ac.jp/webclass/course.php')) {
  const returnBtn = createButton('アプリに戻る', async () => {
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP' })
  })
  returnBtn.style.top = '70px'
  document.body.appendChild(returnBtn)
}

// LMS教材ページ（my-reportsページは除外）
const lmsCourseMatch = currentUrl.match(/\/course\.php\/([^/?#]+)\/?\?.*acs_=([^&#]+)/)
if (lmsCourseMatch && !currentUrl.includes('/my-reports')) {
  const courseId = lmsCourseMatch[1]
  const token = lmsCourseMatch[2]

  const btn = createButton('LMS情報を取得', async () => {
    // 教材ページのHTMLからコース名を取得
    const html = document.documentElement.outerHTML
    const courseInfo = parseLmsCoursePage(html)
    const courseName = courseInfo?.courseName ?? null

    // my-reportsをコンテンツスクリプトから直接fetch（Cookieが自動付与される）
    const myReportsUrl = buildMyReportsUrl(courseId, token)
    const myReportsRes = await fetch(myReportsUrl, { credentials: 'include' })
    if (!myReportsRes.ok) throw new Error(`my-reports fetch failed: ${myReportsRes.status}`)
    const myReportsHtml = await myReportsRes.text()

    console.log('[extension] my-reports html length:', myReportsHtml.length)

    const parsed = parseMyReports(myReportsHtml)
    console.log('[extension] parsed reports:', parsed.length, parsed)

    if (parsed.length === 0) {
      console.warn('[extension] No reports parsed. The page structure may not match the expected format.')
      return
    }

    const assignments: ImportAssignmentItem[] = parsed.map((r, index) => ({
      task_name: r.taskName,
      // taskContentsId が空の場合はコース名+インデックスでフォールバック
      task_contents_id: r.taskContentsId || `${courseId}-${index}`,
      course_name: courseName,
      submitted_at: r.submittedAt ?? null,
      result: r.result,
      score: r.score ?? null,
    }))

    const res = await importAssignments(assignments)
    if (!res.success) throw new Error(res.error)
    console.log(`[extension] ${res.count} assignments imported`)
  })
  document.body.appendChild(btn)
}
