import { REGIST_LIST_URL, PORTAL_TOP_URL, PORTAL_BLANK_URL, buildSyllabusUrl, buildActingListUrl } from '../shared/urls'

import type {
  FetchUrlMessage,
  ImportCoursesMessage,
  ImportLmsTasksMessage,
  ImportLmsTaskItem,
  OpenLmsTabMessage,
  ReturnToAppMessage,
  FetchUrlResponse,
  ImportCoursesResponse,
  ImportLmsTasksResponse,
  ReturnToAppResponse,
  CourseImportItem,
} from '../shared/messages'
import { parseRegisteredCourses, type ParsedCourse } from '../parsers/registParser'
import { parseSyllabusDetail } from '../parsers/syllabusParser'
import { parseActingList } from '../parsers/actingListParser'
import { parseLmsCoursePage } from '../parsers/lmsCourseParser'

// document_start で即オーバーレイを作成し、Q切り替えリロード後の点滅を最小化する
// body がまだ存在しないため documentElement に append する
;(function () {
  const raw = sessionStorage.getItem('allQImport')
  if (!raw) return
  try {
    const s: { quarters: string[]; nextIndex: number } = JSON.parse(raw)
    const el = document.createElement('div')
    el.id = '__extAllQOverlay'
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:rgba(15,23,42,0.93);color:#f8fafc;padding:28px 44px;border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,0.6);pointer-events:all'
    el.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:12px">全Q取得中... Q${s.nextIndex + 1}/${s.quarters.length}</div><div style="font-size:12px;color:#fbbf24">⚠ ページを閉じずにお待ちください</div>`
    ;(document.body || document.documentElement).appendChild(el)
  } catch { /* ignore */ }
})()

const QUARTER_MAP: Record<number, number> = { 11: 1, 12: 2, 21: 3, 22: 4 }
const DAY_STR_MAP: Record<number, string> = { 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' }

function sendMessage<T>(message: FetchUrlMessage | ImportCoursesMessage | ImportLmsTasksMessage | OpenLmsTabMessage | ReturnToAppMessage): Promise<T> {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve))
}

function fetchUrl(url: string): Promise<FetchUrlResponse> {
  return sendMessage<FetchUrlResponse>({ type: 'FETCH_URL', url })
}

function importCourses(courses: CourseImportItem[], syncYear: number, syncQuarters: number[]): Promise<ImportCoursesResponse> {
  return sendMessage<ImportCoursesResponse>({ type: 'IMPORT_COURSES', courses, syncYear, syncQuarters })
}

function importLmsTasks(tasks: ImportLmsTaskItem[]): Promise<ImportLmsTasksResponse> {
  return sendMessage<ImportLmsTasksResponse>({ type: 'IMPORT_LMS_TASKS', tasks })
}

function formatUnixTs(ts: number): string | null {
  if (!ts) return null
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const LMS_TASK_KINDS = new Set(['レポート', '試験', '自習', '一問一答'])

const CONSENT_KEY = 'consentGranted'
const CONSENT_TEXT = 'この拡張機能は、金沢大学ポータルおよびWebClass LMSから履修情報・課題情報を読み取り、KU Calendarのサーバーに送信してカレンダーに同期します。\nパスワード、成績、学籍番号、上記以外のブラウジング履歴は取得しません。\n同意して続行しますか？'

class ConsentDeniedError extends Error {}

function checkConsent(): Promise<boolean> {
  return new Promise(resolve => {
    chrome.storage.local.get(CONSENT_KEY, result => {
      if (result[CONSENT_KEY] === true) { resolve(true); return }
      const agreed = window.confirm(CONSENT_TEXT)
      if (agreed) chrome.storage.local.set({ [CONSENT_KEY]: true })
      resolve(agreed)
    })
  })
}

function withConsent(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    if (!await checkConsent()) throw new ConsentDeniedError()
    await fn()
  }
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
      if (e instanceof ConsentDeniedError) {
        btn.textContent = original
        btn.disabled = false
        return
      }
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

// パース済みコースをCourseImportItem[]に変換（syllabus・actingList のfetch込み）
// liveAppQuarter を省略すると ParsedCourse.quarter から自動変換する（全Q取得時に使用）
// onProgress を渡すと順次処理になりコールバックで進捗を受け取れる
async function buildCourseItems(
  parsed: ParsedCourse[],
  liveYear: number,
  liveAppQuarter?: number,
  onProgress?: (current: number, total: number) => void,
): Promise<CourseImportItem[]> {
  async function buildOne(c: ParsedCourse): Promise<CourseImportItem> {
    const appQuarter = liveAppQuarter ?? (QUARTER_MAP[c.quarter] ?? 1)
    const isIntensive = c.dayOfWeek === 0 || c.period === 0
    let room = ''
    let lmsCourseId: string | null = null
    let lmsSystemType: string | null = null

    if (c.lctCd) {
      const lctYear = c.lctYear || String(liveYear || c.year)
      // c.lctTerm が空の場合は quarter 値 (11/12/21/22) をフォールバックとして使う
      const lctTermEffective = c.lctTerm || String(c.quarter)
      const [syllabusRes, actingRes] = await Promise.all([
        fetchUrl(buildSyllabusUrl(lctYear, c.lctCd)).catch(() => ({ success: false as const })),
        fetchUrl(buildActingListUrl(lctYear, lctTermEffective, c.lctCd)).catch(() => ({ success: false as const })),
      ])
      if (syllabusRes.success && syllabusRes.html) room = parseSyllabusDetail(syllabusRes.html)
      if (actingRes.success && actingRes.html) {
        const lmsInfo = parseActingList(actingRes.html)
        if (lmsInfo) { lmsCourseId = lmsInfo.courseId; lmsSystemType = lmsInfo.systemType }
        console.log(`[LMS] ${c.name} q=${c.quarter} lctTerm=${c.lctTerm}→${lctTermEffective} courseId=${lmsInfo?.courseId ?? null}`)
      } else {
        console.warn(`[LMS] ${c.name} q=${c.quarter} lctTerm=${c.lctTerm}→${lctTermEffective} acting fetch failed`)
      }
    }

    return {
      name: c.name,
      teacher: c.teacher,
      room,
      year: liveYear || c.year,
      quarter: appQuarter,
      day_of_week: isIntensive ? null : (DAY_STR_MAP[c.dayOfWeek] ?? null),
      period: c.period,
      is_intensive_lct: isIntensive,
      lms_course_id: lmsCourseId,
      lms_system_type: lmsSystemType,
    }
  }

  if (!onProgress) {
    return Promise.all(parsed.map(buildOne))
  }

  const result: CourseImportItem[] = []
  for (let i = 0; i < parsed.length; i++) {
    onProgress(i + 1, parsed.length)
    result.push(await buildOne(parsed[i]))
  }
  return result
}

// ---- 全Q取得: sessionStorage で状態を持ちページリロードをまたいで処理 ----

const ALL_Q_IMPORT_KEY = 'allQImport'
const PENDING_ACTION_KEY = 'ku-extension-pending-action'
const QUARTER_SWITCH_KEY = 'ku-extension-quarter-switch'
const ALL_PORTAL_QUARTERS = ['11', '12', '21', '22']

function getOrCreateOverlay(): HTMLElement {
  let el = document.getElementById('__extAllQOverlay') as HTMLElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = '__extAllQOverlay'
    el.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:2147483647',
      'background:rgba(15,23,42,0.93)',
      'color:#f8fafc', 'padding:28px 44px', 'border-radius:14px',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'text-align:center', 'min-width:280px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)', 'pointer-events:none',
    ].join(';')
    document.body.appendChild(el)
  }
  return el
}

function showAllQOverlay(message: string): void {
  const el = getOrCreateOverlay()
  el.innerHTML = [
    `<div style="font-size:18px;font-weight:700;margin-bottom:12px">${message}</div>`,
    '<div style="font-size:12px;color:#fbbf24">⚠ ページを閉じずにお待ちください</div>',
  ].join('')
}

function showAllQOverlayError(): void {
  const el = getOrCreateOverlay()
  el.innerHTML = '<div style="font-size:16px;font-weight:700;color:#f87171">取得に失敗しました。<br>コンソールを確認してください。</div>'
  setTimeout(() => el.remove(), 5000)
}

function hideAllQOverlay(): void {
  document.getElementById('__extAllQOverlay')?.remove()
}

interface AllQImportState {
  quarters: string[]
  nextIndex: number
  liveYear: number
  collectedParsed: ParsedCourse[]
}

async function continueAllQImport(): Promise<void> {
  const raw = sessionStorage.getItem(ALL_Q_IMPORT_KEY)
  if (!raw) return

  let state: AllQImportState
  try {
    state = JSON.parse(raw)
  } catch {
    sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
    return
  }

  const { quarters, nextIndex, liveYear, collectedParsed } = state
  const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
  const expectedQuarter = quarters[nextIndex]
  const actualSelectValue = termSelect?.value ?? ''

  if (actualSelectValue !== expectedQuarter) {
    console.warn(`[AllQ] quarter mismatch – expected=${expectedQuarter} actual=${actualSelectValue} – abort`)
    hideAllQOverlay()
    sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
    return
  }

  // フェーズ1オーバーレイ: Q巡回中
  showAllQOverlay(`全Q取得中... Q${nextIndex + 1}/${quarters.length}`)

  const parsed = parseRegisteredCourses(document.documentElement.outerHTML)
  console.log(`[AllQ] quarter=${expectedQuarter} parsed=${parsed.length}`)

  const nextCollected = [...collectedParsed, ...parsed]
  const nextIdx = nextIndex + 1

  if (nextIdx < quarters.length) {
    // 次のQに切り替え → Full Page Reload が発生する（オーバーレイはリロードで消える）
    sessionStorage.setItem(ALL_Q_IMPORT_KEY, JSON.stringify({
      quarters, nextIndex: nextIdx, liveYear, collectedParsed: nextCollected,
    } satisfies AllQImportState))

    const liveTermSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    if (!liveTermSelect) { sessionStorage.removeItem(ALL_Q_IMPORT_KEY); return }
    sessionStorage.setItem(QUARTER_SWITCH_KEY, '1')
    liveTermSelect.value = quarters[nextIdx]
    liveTermSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  } else {
    // 全Q処理完了 → 重複除去 → 授業詳細fetch → importCourses
    sessionStorage.removeItem(ALL_Q_IMPORT_KEY)

    console.log(`[AllQ] total before dedup=${nextCollected.length}`)

    const seen = new Set<string>()
    const deduped = nextCollected.filter(c => {
      const key = `${c.name}|${c.year}|${c.quarter}|${c.dayOfWeek}|${c.period}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`[AllQ] total after dedup=${deduped.length}`)

    // フェーズ2: 授業詳細を順次 fetch（進捗コールバックでオーバーレイを更新）
    const allCourseItems = await buildCourseItems(deduped, liveYear, undefined, (current, total) => {
      showAllQOverlay(`授業詳細を取得中... ${current}/${total}`)
    })

    const res = await importCourses(allCourseItems, liveYear, [1, 2, 3, 4])
    if (!res.success) throw new Error(res.error)
    console.log(`[AllQ] import completed – ${res.count} courses`)

    hideAllQOverlay()

    const finalTermSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    const finalAppQuarter = finalTermSelect ? (QUARTER_MAP[parseInt(finalTermSelect.value)] ?? 4) : 4
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter: finalAppQuarter })
  }
}

function initOnDomReady() {
  const currentUrl = window.location.href
  const TERM_VALUE_MAP: Record<string, string> = { Q1: '11', Q2: '12', Q3: '21', Q4: '22' }
  const TERM_QUARTER_MAP: Record<string, number> = { '11': 1, '12': 2, '21': 3, '22': 4 }

  // 履修登録一覧ページ
  if (currentUrl.startsWith(REGIST_LIST_URL)) {
    // クォーター切り替えリロードで到着したのでフラグを消去
    sessionStorage.removeItem(QUARTER_SWITCH_KEY)

    const allQRaw = sessionStorage.getItem(ALL_Q_IMPORT_KEY)
    const isAllQActive = allQRaw !== null

    if (isAllQActive) {
      // 別ページへの離脱を検知してallQImportを破棄
      window.addEventListener('pagehide', () => {
        if (!sessionStorage.getItem(QUARTER_SWITCH_KEY)) {
          sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
        }
      })
      // allQ 取得中: ボタンは挿入せず、オーバーレイだけ即表示して処理を再開する
      try {
        const s: AllQImportState = JSON.parse(allQRaw!)
        showAllQOverlay(`全Q取得中... Q${s.nextIndex + 1}/${s.quarters.length}`)
      } catch { /* state が壊れていても continueAllQImport 内で検知する */ }

      ;(async () => {
        try {
          await continueAllQImport()
        } catch (e) {
          console.error('[AllQ] error:', e)
          sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
          showAllQOverlayError()
        }
      })()
    } else {
      // 通常モード: targetTerm 処理（初回のみ）→ ボタン挿入
      const params = new URLSearchParams(location.search)
      const targetTerm = params.get('targetTerm')

      if (targetTerm) {
        console.log('[targetTerm] found', targetTerm)

        if (sessionStorage.getItem('ku-extension-target-term-handled') === targetTerm) {
          // 同じ targetTerm を処理済み → ユーザーの手動操作を尊重してスキップ
          console.log('[targetTerm] already handled, skip')
        } else {
          // URL から targetTerm を削除（postback 後のループを防ぐ）
          const url = new URL(location.href)
          url.searchParams.delete('targetTerm')
          history.replaceState(null, '', url.toString())
          console.log('[targetTerm] removed from URL')

          // 処理済みフラグを保存
          sessionStorage.setItem('ku-extension-target-term-handled', targetTerm)

          const termValue = TERM_VALUE_MAP[targetTerm]
          if (termValue) {
            const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
            if (!termSelect) {
              console.warn('[extension] Term select not found')
            } else if (termSelect.value !== termValue) {
              console.log('[targetTerm] switching to', termValue)
              termSelect.value = termValue
              termSelect.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }
        }
      }

      const btn = createButton('履修情報を取得', withConsent(async () => {
        const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
        const yearSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlYear_ddl')
        const livePortalQuarter = termSelect ? parseInt(termSelect.value) : 0
        const liveYear = yearSelect ? parseInt(yearSelect.value) : 0
        const liveAppQuarter = QUARTER_MAP[livePortalQuarter] ?? 1

        const parsed = parseRegisteredCourses(document.documentElement.outerHTML)
        const courses = await buildCourseItems(parsed, liveYear, liveAppQuarter)

        const res = await importCourses(courses, liveYear, [liveAppQuarter])
        if (!res.success) throw new Error(res.error)
        console.log(`[extension] ${res.count} courses imported`)

        await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter: liveAppQuarter })
      }))
      document.body.appendChild(btn)

      const returnBtn = createButton('アプリに戻る', async () => {
        const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
        const quarter = termSelect ? (TERM_QUARTER_MAP[termSelect.value] ?? 1) : 1
        await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter })
      })
      returnBtn.style.top = '70px'
      document.body.appendChild(returnBtn)

      const allQBtn = createButton('全Qを取得', withConsent(async () => {
        const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
        const yearSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlYear_ddl')
        if (!termSelect) throw new Error('[AllQ] Term select not found')

        const liveYear = yearSelect ? parseInt(yearSelect.value) : 0

        // URL に targetTerm が残っていたら削除して競合を防ぐ
        const startUrl = new URL(location.href)
        if (startUrl.searchParams.has('targetTerm')) {
          startUrl.searchParams.delete('targetTerm')
          history.replaceState(null, '', startUrl.toString())
        }
        sessionStorage.removeItem('targetTerm')

        sessionStorage.setItem(ALL_Q_IMPORT_KEY, JSON.stringify({
          quarters: ALL_PORTAL_QUARTERS,
          nextIndex: 0,
          liveYear,
          collectedParsed: [],
        } satisfies AllQImportState))

        sessionStorage.setItem(QUARTER_SWITCH_KEY, '1')
        termSelect.value = ALL_PORTAL_QUARTERS[0]
        termSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

        // ページリロードが発生するまで待機（リロードでこの関数は破棄される）
        await new Promise((_, reject) => setTimeout(() => reject(new Error('[AllQ] Quarter switch did not reload page')), 15000))
      }))
      allQBtn.style.top = '124px'
      document.body.appendChild(allQBtn)

      // ポータルバグページからのリダイレクト後に保存されたアクションを自動実行
      const pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY)
      if (pendingAction) {
        sessionStorage.removeItem(PENDING_ACTION_KEY)
        if (pendingAction === 'import') btn.click()
        else if (pendingAction === 'return') returnBtn.click()
        else if (pendingAction === 'all-q') allQBtn.click()
      }
    }
  }

  // ポータルのバグでTop.aspxまたはBlank.aspxに飛んだ場合も同じボタンを表示
  const isBuggyPortalPage = currentUrl.startsWith(PORTAL_TOP_URL) || currentUrl.startsWith(PORTAL_BLANK_URL)
  if (isBuggyPortalPage) {
    const btn = createButton('履修情報を取得', withConsent(async () => {
      sessionStorage.setItem(PENDING_ACTION_KEY, 'import')
      window.location.href = REGIST_LIST_URL
    }))
    document.body.appendChild(btn)

    const returnBtn = createButton('アプリに戻る', async () => {
      sessionStorage.setItem(PENDING_ACTION_KEY, 'return')
      window.location.href = REGIST_LIST_URL
    })
    returnBtn.style.top = '70px'
    document.body.appendChild(returnBtn)

    const allQBtn = createButton('全Qを取得', withConsent(async () => {
      sessionStorage.setItem(PENDING_ACTION_KEY, 'all-q')
      window.location.href = REGIST_LIST_URL
    }))
    allQBtn.style.top = '124px'
    document.body.appendChild(allQBtn)
  }

  // LMS全コースページ → 「時間割へ」「タスクへ」ボタン
  if (currentUrl.includes('lms-wc.el.kanazawa-u.ac.jp/webclass/course.php')) {
    const coursesBtn = createButton('時間割へ', async () => {
      await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', path: '/courses' })
    })
    coursesBtn.style.top = '70px'
    document.body.appendChild(coursesBtn)

    const tasksBtn = createButton('タスクへ', async () => {
      await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', path: '/tasks' })
    })
    tasksBtn.style.top = '124px'
    document.body.appendChild(tasksBtn)
  }

  // LMS教材ページ（my-reportsページは除外）
  const lmsCourseMatch = currentUrl.match(/\/course\.php\/([^/?#]+)\/?\?.*acs_=([^&#]+)/)
  if (lmsCourseMatch && !currentUrl.includes('/my-reports')) {
    const btn = createButton('LMS情報を取得', withConsent(async () => {
      const html = document.documentElement.outerHTML
      const courseInfo = parseLmsCoursePage(html)
      if (!courseInfo) throw new Error('コース情報が見つかりませんでした')

      const tasks: ImportLmsTaskItem[] = courseInfo.contents
        .filter(c => LMS_TASK_KINDS.has(c.kind) && c.id)
        .map(c => ({
          lms_contents_id: c.id,
          title: c.name,
          kind: c.kind,
          course_name: courseInfo.courseName,
          lms_course_id: courseInfo.courseId,
          available_from: formatUnixTs(c.startDate),
          available_until: formatUnixTs(c.endDate),
        }))

      console.log(`[extension] LMS tasks: ${tasks.length}`, tasks)

      const res = await importLmsTasks(tasks)
      if (!res.success) throw new Error(res.error)
      console.log(`[extension] ${res.count} tasks imported`)
    }))
    document.body.appendChild(btn)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnDomReady)
} else {
  initOnDomReady()
}
