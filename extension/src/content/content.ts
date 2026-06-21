import { REGIST_LIST_URL, PORTAL_TOP_URL, PORTAL_BLANK_URL, LMS_COURSE_BASE, ACANTHUS_SSO_BASE, buildSyllabusUrl, buildActingListUrl } from '../shared/urls'

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
  RefreshTokenMessage,
  RefreshTokenResponse,
  GetSyncModeMessage,
  GetSyncModeResponse,
  FetchAppApiMessage,
  FetchAppApiResponse,
} from '../shared/messages'
import { parseRegisteredCourses, type ParsedCourse } from '../parsers/registParser'
import { parseSyllabusDetail } from '../parsers/syllabusParser'
import { parseActingList } from '../parsers/actingListParser'
import { parseLmsCoursePage } from '../parsers/lmsCourseParser'

/* ── 定数 ───────────────────────────────────────────────── */

const APP_URL = import.meta.env.VITE_APP_URL as string
if (!APP_URL) {
  throw new Error('[extension] Required env var missing: VITE_APP_URL')
}
const OVERLAY_ID = '__extOverlay'
const OVERLAY_BASE_STYLE = [
  'position:fixed', 'top:50%', 'left:50%',
  'transform:translate(-50%,-50%)',
  'z-index:2147483647',
  'background:rgba(15,23,42,0.93)',
  'color:#f8fafc', 'padding:28px 44px', 'border-radius:14px',
  'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
  'text-align:center', 'min-width:280px',
  'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
].join(';')

/* ── document_start: 全Q取得リロード後にオーバーレイを即復元 ── */

;(function () {
  const raw = sessionStorage.getItem('allQImport')
  if (!raw) return
  try {
    const s: { quarters: string[]; nextIndex: number } = JSON.parse(raw)
    const el = document.createElement('div')
    el.id = OVERLAY_ID
    el.style.cssText = OVERLAY_BASE_STYLE + ';pointer-events:none'
    el.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:12px">全Q取得中... Q${s.nextIndex + 1}/${s.quarters.length}</div><div style="font-size:12px;color:#fbbf24">⚠ ページを閉じずにお待ちください</div>`
    ;(document.body || document.documentElement).appendChild(el)
  } catch { /* ignore */ }
})()

/* ── ユーティリティ ─────────────────────────────────────── */

const QUARTER_MAP: Record<number, number> = { 11: 1, 12: 2, 21: 3, 22: 4 }
const DAY_STR_MAP: Record<number, string> = { 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' }

function sendMessage<T>(message: FetchUrlMessage | ImportCoursesMessage | ImportLmsTasksMessage | OpenLmsTabMessage | ReturnToAppMessage | RefreshTokenMessage | GetSyncModeMessage | FetchAppApiMessage): Promise<T> {
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


/* ── 認証 ───────────────────────────────────────────────── */

class AuthRequiredError extends Error {
  constructor(msg = 'auth required') { super(msg) }
}

function getStoredToken(): Promise<string | null> {
  return new Promise(resolve =>
    chrome.storage.local.get('access_token', r => resolve((r['access_token'] as string | undefined) ?? null))
  )
}

async function tryRefreshToken(): Promise<string | null> {
  const result = await sendMessage<RefreshTokenResponse>({ type: 'REFRESH_TOKEN' })
  return result.success && result.access_token ? result.access_token : null
}

// アクセストークンが storage になければ refresh を試みる。両方なければ AuthRequiredError をスロー
async function ensureToken(): Promise<void> {
  const token = await getStoredToken()
  if (token) return
  const newToken = await tryRefreshToken()
  if (!newToken) throw new AuthRequiredError()
}

function isAuthError(error?: string): boolean {
  return !!error && (error.includes('401') || error.includes('403'))
}

// importCourses + 401/403 時に refresh して1回リトライ
async function importCoursesWithAuth(courses: CourseImportItem[], syncYear: number, syncQuarters: number[]): Promise<number> {
  let res = await importCourses(courses, syncYear, syncQuarters)
  if (!res.success && isAuthError(res.error)) {
    const newToken = await tryRefreshToken()
    if (!newToken) throw new AuthRequiredError()
    res = await importCourses(courses, syncYear, syncQuarters)
  }
  if (!res.success) throw new Error(res.error)
  return res.count ?? 0
}

// importLmsTasks + 401/403 時に refresh して1回リトライ
async function importLmsTasksWithAuth(tasks: ImportLmsTaskItem[]): Promise<number> {
  let res = await importLmsTasks(tasks)
  if (!res.success && isAuthError(res.error)) {
    const newToken = await tryRefreshToken()
    if (!newToken) throw new AuthRequiredError()
    res = await importLmsTasks(tasks)
  }
  if (!res.success) throw new Error(res.error)
  return res.count ?? 0
}

/* ── オーバーレイ ───────────────────────────────────────── */

function getOrCreateOverlay(): HTMLElement {
  let el = document.getElementById(OVERLAY_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = OVERLAY_ID
    el.style.cssText = OVERLAY_BASE_STYLE + ';pointer-events:none'
    document.body.appendChild(el)
  }
  return el
}

function showOverlay(message: string): void {
  const el = getOrCreateOverlay()
  el.style.pointerEvents = 'none'
  el.innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:12px">${message}</div>`
}

function showOverlayWithHint(message: string, hint: string): void {
  const el = getOrCreateOverlay()
  el.style.pointerEvents = 'none'
  el.innerHTML = [
    `<div style="font-size:18px;font-weight:700;margin-bottom:12px">${message}</div>`,
    `<div style="font-size:12px;color:#fbbf24">${hint}</div>`,
  ].join('')
}

function showOverlayError(): void {
  const el = getOrCreateOverlay()
  el.style.pointerEvents = 'none'
  el.innerHTML = '<div style="font-size:16px;font-weight:700;color:#f87171">取得に失敗しました。<br>コンソールを確認してください。</div>'
  setTimeout(() => el.remove(), 5000)
}

function showLoginRequired(): void {
  const el = getOrCreateOverlay()
  el.style.pointerEvents = 'all'
  el.innerHTML = [
    '<div style="font-size:18px;font-weight:700;margin-bottom:10px">ログインが必要です</div>',
    '<div style="font-size:13px;color:#94a3b8;margin-bottom:20px">アプリにログインしてから再度お試しください。</div>',
    '<div style="display:flex;gap:10px;justify-content:center">',
    `  <button id="__extOpenApp" style="padding:8px 20px;background:#1a56db;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold">アプリを開く</button>`,
    `  <button id="__extCloseOverlay" style="padding:8px 16px;background:#334155;color:#cbd5e1;border:none;border-radius:6px;cursor:pointer;font-size:13px">閉じる</button>`,
    '</div>',
  ].join('')
  document.getElementById('__extOpenApp')?.addEventListener('click', () => {
    window.open(`${APP_URL}/login`, '_blank')
  })
  document.getElementById('__extCloseOverlay')?.addEventListener('click', () => {
    document.getElementById(OVERLAY_ID)?.remove()
  })
}

function hideOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove()
}

/* ── ボタン生成 ─────────────────────────────────────────── */

/* ── コースアイテム構築 ─────────────────────────────────── */

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

/* ── 全Q取得 ────────────────────────────────────────────── */

const ALL_Q_IMPORT_KEY = 'allQImport'
const PENDING_ACTION_KEY = 'ku-extension-pending-action'
const PENDING_NAV_STAGE_KEY = 'ku-extension-nav-stage'
const QUARTER_SWITCH_KEY = 'ku-extension-quarter-switch'
const ALL_PORTAL_QUARTERS = ['11', '12', '21', '22']

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
    hideOverlay()
    sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
    return
  }

  showOverlayWithHint(`全Q取得中... Q${nextIndex + 1}/${quarters.length}`, '⚠ ページを閉じずにお待ちください')

  const parsed = parseRegisteredCourses(document.documentElement.outerHTML)
  console.log(`[AllQ] quarter=${expectedQuarter} parsed=${parsed.length}`)

  const nextCollected = [...collectedParsed, ...parsed]
  const nextIdx = nextIndex + 1

  if (nextIdx < quarters.length) {
    sessionStorage.setItem(ALL_Q_IMPORT_KEY, JSON.stringify({
      quarters, nextIndex: nextIdx, liveYear, collectedParsed: nextCollected,
    } satisfies AllQImportState))

    const liveTermSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    if (!liveTermSelect) { sessionStorage.removeItem(ALL_Q_IMPORT_KEY); return }
    sessionStorage.setItem(QUARTER_SWITCH_KEY, '1')
    liveTermSelect.value = quarters[nextIdx]
    liveTermSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  } else {
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

    const allCourseItems = await buildCourseItems(deduped, liveYear, undefined, (current, total) => {
      showOverlayWithHint(`授業詳細を取得中... ${current}/${total}`, '⚠ ページを閉じずにお待ちください')
    })

    const count = await importCoursesWithAuth(allCourseItems, liveYear, [1, 2, 3, 4])
    console.log(`[AllQ] import completed – ${count} courses`)

    hideOverlay()

    const finalTermSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
    const finalAppQuarter = finalTermSelect ? (QUARTER_MAP[parseInt(finalTermSelect.value)] ?? 4) : 4
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter: finalAppQuarter })
  }
}

/* ── 授業一覧コンポーネント ─────────────────────────────── */

async function appendCourseList(panel: HTMLElement): Promise<void> {
  const toggleBtn = document.createElement('button')
  toggleBtn.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'width:100%', 'padding:7px 12px',
    'background:rgba(255,255,255,0.04)', 'color:#94a3b8',
    'border:none', 'border-top:1px solid rgba(255,255,255,0.1)',
    'cursor:pointer', 'font-size:11px', 'font-weight:600',
    'box-sizing:border-box',
  ].join(';')
  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = '授業一覧'
  const arrowSpan = document.createElement('span')
  panel.appendChild(toggleBtn)
  toggleBtn.appendChild(toggleLabel)
  toggleBtn.appendChild(arrowSpan)

  const courseBody = document.createElement('div')
  courseBody.style.cssText = 'padding:6px 10px 16px'
  panel.appendChild(courseBody)

  const qRow = document.createElement('div')
  qRow.style.cssText = [
    'display:flex', 'gap:3px',
    'background:rgba(255,255,255,0.08)', 'border-radius:6px',
    'padding:3px', 'margin-bottom:8px',
  ].join(';')
  const qBtns = {} as Record<QKey, HTMLButtonElement>
  for (const q of QUARTERS_LIST) {
    const b = document.createElement('button')
    b.textContent = q
    b.style.cssText = 'flex:1;padding:3px 0;border:none;border-radius:4px;cursor:pointer;font-size:11px'
    qBtns[q] = b
    qRow.appendChild(b)
  }
  courseBody.appendChild(qRow)

  const listEl = document.createElement('div')
  courseBody.appendChild(listEl)

  let currentQ: QKey = getPanelCurrentQuarter()
  let expanded = true
  let courseCache: Partial<Record<QKey, PanelCourse[]>> = {}

  function applyQStyles() {
    for (const q of QUARTERS_LIST) {
      const b = qBtns[q]
      if (q === currentQ) {
        b.style.background = 'white'
        b.style.color = '#1d4ed8'
        b.style.fontWeight = '600'
        b.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)'
      } else {
        b.style.background = 'transparent'
        b.style.color = '#94a3b8'
        b.style.fontWeight = '400'
        b.style.boxShadow = 'none'
      }
    }
  }

  function applyExpanded(val: boolean) {
    courseBody.style.display = val ? 'block' : 'none'
    arrowSpan.textContent = val ? '▲' : '▼'
  }

  function renderList(courses: PanelCourse[] | null, loading: boolean) {
    listEl.innerHTML = ''
    if (loading && !courses) {
      const el = document.createElement('div')
      el.style.cssText = 'font-size:11px;color:#64748b;text-align:center;padding:6px 0'
      el.textContent = '読み込み中...'
      listEl.appendChild(el)
      return
    }
    if (!courses || courses.length === 0) {
      const el = document.createElement('div')
      el.style.cssText = 'font-size:11px;color:#64748b;padding:4px 0'
      el.textContent = '授業がありません'
      listEl.appendChild(el)
      return
    }
    const sorted = courses
      .filter(c => !c.is_intensive_lct && c.day_of_week)
      .sort((a, b) => {
        const da = PANEL_DAY_ORDER.indexOf(a.day_of_week!)
        const db = PANEL_DAY_ORDER.indexOf(b.day_of_week!)
        return da !== db ? da - db : a.period - b.period
      })
    const intensive = courses.filter(c => c.is_intensive_lct)
    for (const c of [...sorted, ...intensive]) {
      const lmsUrl = c.lms_course_id
        ? `${ACANTHUS_SSO_BASE}?courseId=${c.lms_course_id}&systemType=${c.lms_system_type ?? ''}`
        : null
      const row = document.createElement('div')
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:5px',
        'padding:4px 2px', 'border-bottom:1px solid rgba(255,255,255,0.06)',
        `font-size:11px;${lmsUrl ? 'cursor:pointer;color:#93c5fd' : 'color:#475569'}`,
      ].join(';')
      if (lmsUrl) {
        const url = lmsUrl
        row.addEventListener('click', () => { window.location.href = url })
        row.addEventListener('mouseenter', () => { row.style.color = '#bfdbfe' })
        row.addEventListener('mouseleave', () => { row.style.color = '#93c5fd' })
      }
      const labelEl = document.createElement('span')
      labelEl.style.cssText = 'flex-shrink:0;min-width:22px;font-size:10px;opacity:0.65'
      labelEl.textContent = c.is_intensive_lct ? '集中' : `${c.day_of_week}${c.period}`
      const nameEl = document.createElement('span')
      nameEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      nameEl.textContent = c.name
      row.appendChild(labelEl)
      row.appendChild(nameEl)
      listEl.appendChild(row)
    }
  }

  async function loadQ(q: QKey) {
    const cached = courseCache[q] ?? null
    renderList(cached, !cached)

    try {
      const courses = await fetchPanelCourses(q)
      courseCache[q] = courses
      const s = await chrome.storage.local.get(['cachedCoursesByQuarter'])
      const existing = (s['cachedCoursesByQuarter'] ?? {}) as Record<string, unknown>
      chrome.storage.local.set({
        cachedCoursesByQuarter: { ...existing, [q]: courses },
        cachedCoursesUpdatedAt: new Date().toISOString(),
      })
      if (currentQ === q) renderList(courses, false)
    } catch {
      if (!cached && currentQ === q) renderList(null, false)
    }
  }

  toggleBtn.addEventListener('click', () => {
    expanded = !expanded
    applyExpanded(expanded)
    chrome.storage.local.set({ courseListExpanded: expanded })
  })

  for (const q of QUARTERS_LIST) {
    qBtns[q].addEventListener('click', async () => {
      currentQ = q
      chrome.storage.local.set({ selectedQuarter: q })
      applyQStyles()
      await loadQ(q)
    })
  }

  const stored = await chrome.storage.local.get([
    'selectedQuarter', 'courseListExpanded', 'cachedCoursesByQuarter',
  ])
  const storedQ = stored['selectedQuarter'] as QKey | undefined
  if (storedQ && (QUARTERS_LIST as string[]).includes(storedQ)) currentQ = storedQ
  if (typeof stored['courseListExpanded'] === 'boolean') expanded = stored['courseListExpanded'] as boolean
  courseCache = (stored['cachedCoursesByQuarter'] as Partial<Record<QKey, PanelCourse[]>>) ?? {}

  applyQStyles()
  applyExpanded(expanded)
  await loadQ(currentQ)
}

/* ── LMSコンテンツ描画待ち ──────────────────────────────── */

function waitForCourseContent(timeout = 15000): Promise<boolean> {
  if (document.querySelector('[data-folder-id]')) return Promise.resolve(true)
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-folder-id]')) {
        observer.disconnect()
        resolve(true)
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(false)
    }, timeout)
  })
}

/* ── LMS サイドパネル ────────────────────────────────────── */

const LMS_PANEL_ID = '__extSidePanel'
const LMS_PANEL_EXTRAS_ID = '__extSidePanelExtras'
const PANEL_CURRENT_YEAR = 2026
type QKey = 'Q1' | 'Q2' | 'Q3' | 'Q4'
const QUARTERS_LIST: QKey[] = ['Q1', 'Q2', 'Q3', 'Q4']
const PANEL_QUARTER_NUM: Record<QKey, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
const PANEL_DAY_ORDER = ['月', '火', '水', '木', '金', '土']

interface PanelCourse {
  id: string
  name: string
  day_of_week: string | null
  period: number
  lms_course_id: string | null
  lms_system_type: string | null
  is_intensive_lct: boolean
}

function getPanelCurrentQuarter(): QKey {
  const today = new Date()
  const mmdd = (today.getMonth() + 1) * 100 + today.getDate()
  if (mmdd < 406) return 'Q4'
  if (mmdd < 611) return 'Q1'
  if (mmdd < 1001) return 'Q2'
  if (mmdd < 1209) return 'Q3'
  return 'Q4'
}

async function fetchPanelCourses(q: QKey): Promise<PanelCourse[]> {
  const res = await sendMessage<FetchAppApiResponse>({
    type: 'FETCH_APP_API',
    path: `/api/courses/${PANEL_CURRENT_YEAR}-${PANEL_QUARTER_NUM[q]}`,
  })
  if (!res.success) throw new Error(res.error ?? String(res.status))
  return res.data as PanelCourse[]
}

function makePanelNavBtn(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'display:block', 'width:calc(100% - 12px)', 'padding:8px 12px',
    'margin:4px 6px',
    'background:rgba(255,255,255,0.05)', 'color:#f8fafc',
    'border:1px solid rgba(255,255,255,0.2)', 'border-radius:6px',
    'cursor:pointer', 'font-size:13px', 'font-weight:bold', 'text-align:left',
    'box-sizing:border-box',
  ].join(';')
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.12)'
    btn.style.borderColor = 'rgba(255,255,255,0.35)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(255,255,255,0.05)'
    btn.style.borderColor = 'rgba(255,255,255,0.2)'
  })
  btn.addEventListener('click', async () => {
    try { await onClick() } catch (e) { console.error('[panel]', e) }
  })
  return btn
}

function createSidePanelShell(): HTMLDivElement {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
    'width:210px', 'background:rgba(15,23,42,0.95)', 'border-radius:10px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'overflow:hidden',
  ].join(';')
  document.body.appendChild(panel)

  const dragHandle = document.createElement('div')
  dragHandle.title = 'ドラッグして移動'
  dragHandle.style.cssText = [
    'padding:5px 0', 'text-align:center', 'cursor:grab',
    'color:rgba(255,255,255,0.2)', 'font-size:11px', 'letter-spacing:4px',
    'border-bottom:1px solid rgba(255,255,255,0.07)', 'user-select:none',
  ].join(';')
  dragHandle.textContent = '⠿ ⠿ ⠿'
  panel.appendChild(dragHandle)

  let dragging = false, ox = 0, oy = 0
  dragHandle.addEventListener('mousedown', e => {
    dragging = true
    dragHandle.style.cursor = 'grabbing'
    const rect = panel.getBoundingClientRect()
    ox = e.clientX - rect.left
    oy = e.clientY - rect.top
    panel.style.right = 'auto'
    panel.style.left = `${rect.left}px`
    e.preventDefault()
  })
  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - panel.offsetWidth))
    const y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - panel.offsetHeight))
    panel.style.left = `${x}px`
    panel.style.top = `${y}px`
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    dragHandle.style.cursor = 'grab'
    chrome.storage.local.set({ panelPosition: { left: panel.style.left, top: panel.style.top } })
  })

  chrome.storage.local.get(['panelPosition'], result => {
    const pos = result['panelPosition'] as { left: string; top: string } | undefined
    if (pos?.left && pos?.top) {
      panel.style.right = 'auto'
      panel.style.left = pos.left
      panel.style.top = pos.top
    }
  })

  return panel
}

function makePanelActionBtn(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'display:block', 'width:calc(100% - 12px)', 'padding:8px 12px',
    'margin:4px 6px',
    'background:rgba(255,255,255,0.05)', 'color:#f8fafc',
    'border:1px solid rgba(255,255,255,0.2)', 'border-radius:6px',
    'cursor:pointer', 'font-size:13px', 'font-weight:bold', 'text-align:left',
    'box-sizing:border-box',
  ].join(';')
  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) {
      btn.style.background = 'rgba(255,255,255,0.12)'
      btn.style.borderColor = 'rgba(255,255,255,0.35)'
    }
  })
  btn.addEventListener('mouseleave', () => {
    if (!btn.disabled) {
      btn.style.background = 'rgba(255,255,255,0.05)'
      btn.style.borderColor = 'rgba(255,255,255,0.2)'
    }
  })
  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    btn.disabled = true
    btn.style.opacity = '0.6'
    const original = label
    btn.textContent = '処理中...'
    try {
      await onClick()
      btn.textContent = '完了 ✓'
      btn.style.borderColor = 'rgba(74,222,128,0.6)'
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        showLoginRequired()
      } else {
        btn.textContent = 'エラー'
        console.error('[panel]', e)
      }
    } finally {
      setTimeout(() => {
        btn.textContent = original
        btn.disabled = false
        btn.style.opacity = '1'
        btn.style.borderColor = 'rgba(255,255,255,0.2)'
      }, 2500)
    }
  })
  return btn
}

async function initLmsSidePanel(): Promise<void> {
  if (document.getElementById(LMS_PANEL_ID)) return

  const panel = document.createElement('div')
  panel.id = LMS_PANEL_ID
  panel.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
    'width:210px', 'background:rgba(15,23,42,0.95)', 'border-radius:10px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif', 'overflow:hidden',
  ].join(';')
  document.body.appendChild(panel)

  // ドラッグハンドル
  const dragHandle = document.createElement('div')
  dragHandle.title = 'ドラッグして移動'
  dragHandle.style.cssText = [
    'padding:5px 0', 'text-align:center', 'cursor:grab',
    'color:rgba(255,255,255,0.2)', 'font-size:11px', 'letter-spacing:4px',
    'border-bottom:1px solid rgba(255,255,255,0.07)', 'user-select:none',
  ].join(';')
  dragHandle.textContent = '⠿ ⠿ ⠿'
  panel.appendChild(dragHandle)

  // ドラッグロジック
  let dragging = false
  let ox = 0, oy = 0
  dragHandle.addEventListener('mousedown', e => {
    dragging = true
    dragHandle.style.cursor = 'grabbing'
    const rect = panel.getBoundingClientRect()
    ox = e.clientX - rect.left
    oy = e.clientY - rect.top
    panel.style.right = 'auto'
    panel.style.left = `${rect.left}px`
    e.preventDefault()
  })
  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - panel.offsetWidth))
    const y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - panel.offsetHeight))
    panel.style.left = `${x}px`
    panel.style.top = `${y}px`
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    dragHandle.style.cursor = 'grab'
    chrome.storage.local.set({ panelPosition: { left: panel.style.left, top: panel.style.top } })
  })

  // 「課題を追加」などをここに差し込む
  const extrasArea = document.createElement('div')
  extrasArea.id = LMS_PANEL_EXTRAS_ID
  panel.appendChild(extrasArea)

  panel.appendChild(makePanelNavBtn('時間割へ', async () => {
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', path: '/courses' })
  }))
  panel.appendChild(makePanelNavBtn('タスクへ', async () => {
    await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', path: '/tasks' })
  }))

  await appendCourseList(panel)

  const storedPos = await chrome.storage.local.get(['panelPosition'])
  const pos = storedPos['panelPosition'] as { left: string; top: string } | undefined
  if (pos?.left && pos?.top) {
    panel.style.right = 'auto'
    panel.style.left = pos.left
    panel.style.top = pos.top
  }
}

/* ── ポータル __doPostBack ヘルパー ─────────────────────── */

function parsePostBack(rawHref: string): { target: string; argument: string } | null {
  const m = rawHref.match(/javascript:.*__doPostBack\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/)
  if (!m) return null
  return { target: m[1], argument: m[2] }
}

// Content Script は isolated world なので window.__doPostBack を直接呼べない。
// web_accessible_resources の page-bridge.js をページに注入し、
// onload 完了後に postMessage でページコンテキストへ指示を送る。
let bridgeReadyPromise: Promise<void> | null = null

function ensurePageBridgeInjected(): Promise<void> {
  if (bridgeReadyPromise) return bridgeReadyPromise
  bridgeReadyPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'ku-calendar-page-bridge'
    script.src = chrome.runtime.getURL('page-bridge.js')
    console.log('[extension] page-bridge: script要素を注入, src=', script.src)
    script.onload = () => {
      console.log('[extension] page-bridge: onload fired')
      resolve()
    }
    script.onerror = (e) => {
      console.error('[extension] page-bridge: onerror', e)
      reject(new Error('page-bridge.js load failed'))
    }
    ;(document.head || document.documentElement).appendChild(script)
  })
  return bridgeReadyPromise
}

function runPostBackInPage(eventTarget: string, eventArgument = ''): void {
  void ensurePageBridgeInjected().then(() => {
    console.log('[extension] postMessage送信: target=', eventTarget, 'argument=', eventArgument)
    window.postMessage({ type: 'KU_CALENDAR_RUN_POSTBACK', eventTarget, eventArgument }, '*')
  }).catch(e => {
    console.error('[extension] page-bridge 読み込みエラー:', e)
  })
}

function invokePortalLink(link: HTMLAnchorElement, label: string): void {
  const rawHref = link.getAttribute('href') ?? ''
  const postback = rawHref.startsWith('javascript:') ? parsePostBack(rawHref) : null
  if (postback) {
    console.log(`[extension] ${label}: __doPostBack検出 href=${rawHref} target=${postback.target} argument=${postback.argument}`)
    runPostBackInPage(postback.target, postback.argument)
  } else {
    console.log(`[extension] ${label}: 通常リンク href=${rawHref} → link.click()`)
    link.click()
  }
}

/* ── メイン処理 ─────────────────────────────────────────── */

function initOnDomReady() {
  const currentUrl = window.location.href
  const TERM_VALUE_MAP: Record<string, string> = { Q1: '11', Q2: '12', Q3: '21', Q4: '22' }
  const TERM_QUARTER_MAP: Record<string, number> = { '11': 1, '12': 2, '21': 3, '22': 4 }

  // 履修登録一覧ページ
  if (currentUrl.startsWith(REGIST_LIST_URL)) {
    sessionStorage.removeItem(QUARTER_SWITCH_KEY)

    const allQRaw = sessionStorage.getItem(ALL_Q_IMPORT_KEY)
    const isAllQActive = allQRaw !== null

    if (isAllQActive) {
      window.addEventListener('pagehide', () => {
        if (!sessionStorage.getItem(QUARTER_SWITCH_KEY)) {
          sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
        }
      })
      try {
        const s: AllQImportState = JSON.parse(allQRaw!)
        showOverlayWithHint(`全Q取得中... Q${s.nextIndex + 1}/${s.quarters.length}`, '⚠ ページを閉じずにお待ちください')
      } catch { /* ignore */ }

      ;(async () => {
        try {
          await continueAllQImport()
        } catch (e) {
          console.error('[AllQ] error:', e)
          sessionStorage.removeItem(ALL_Q_IMPORT_KEY)
          if (e instanceof AuthRequiredError) {
            showLoginRequired()
          } else {
            showOverlayError()
          }
        }
      })()
    } else {
      // 通常モード: targetTerm 処理（初回のみ）→ ボタン挿入
      const params = new URLSearchParams(location.search)
      const targetTerm = params.get('targetTerm')

      if (targetTerm) {
        console.log('[targetTerm] found', targetTerm)

        if (sessionStorage.getItem('ku-extension-target-term-handled') === targetTerm) {
          console.log('[targetTerm] already handled, skip')
        } else {
          const url = new URL(location.href)
          url.searchParams.delete('targetTerm')
          history.replaceState(null, '', url.toString())
          console.log('[targetTerm] removed from URL')

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

      // ポータルパネル
      const portalPanel = createSidePanelShell()

      const btn = makePanelActionBtn('今学期の時間割を登録', async () => {
        await ensureToken()
        showOverlayWithHint('時間割を取得中...', '⚠ ページを閉じずにお待ちください')
        portalPanel.style.display = 'none'
        try {
          const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
          const yearSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlYear_ddl')
          const livePortalQuarter = termSelect ? parseInt(termSelect.value) : 0
          const liveYear = yearSelect ? parseInt(yearSelect.value) : 0
          const liveAppQuarter = QUARTER_MAP[livePortalQuarter] ?? 1

          const parsed = parseRegisteredCourses(document.documentElement.outerHTML)
          const courses = await buildCourseItems(parsed, liveYear, liveAppQuarter, (current, total) => {
            showOverlayWithHint(`授業詳細を取得中... ${current}/${total}`, '⚠ ページを閉じずにお待ちください')
          })

          showOverlay('アプリに同期中...')
          const count = await importCoursesWithAuth(courses, liveYear, [liveAppQuarter])
          console.log(`[extension] ${count} courses imported`)

          showOverlay('今学期の時間割を登録しました')
          await new Promise(r => setTimeout(r, 1500))
          hideOverlay()

          await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter: liveAppQuarter })
        } catch (e) {
          portalPanel.style.display = ''
          hideOverlay()
          throw e
        }
      })
      portalPanel.appendChild(btn)

      const allQBtn = makePanelActionBtn('全学期の時間割を登録', async () => {
        await ensureToken()
        const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
        const yearSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlYear_ddl')
        if (!termSelect) throw new Error('[AllQ] Term select not found')

        const liveYear = yearSelect ? parseInt(yearSelect.value) : 0

        const startUrl = new URL(location.href)
        if (startUrl.searchParams.has('targetTerm')) {
          startUrl.searchParams.delete('targetTerm')
          history.replaceState(null, '', startUrl.toString())
        }
        sessionStorage.removeItem('ku-extension-target-term-handled')

        sessionStorage.setItem(ALL_Q_IMPORT_KEY, JSON.stringify({
          quarters: ALL_PORTAL_QUARTERS,
          nextIndex: 0,
          liveYear,
          collectedParsed: [],
        } satisfies AllQImportState))

        sessionStorage.setItem(QUARTER_SWITCH_KEY, '1')
        termSelect.value = ALL_PORTAL_QUARTERS[0]
        termSelect.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

        await new Promise((_, reject) => setTimeout(() => reject(new Error('[AllQ] Quarter switch did not reload page')), 15000))
      })
      portalPanel.appendChild(allQBtn)

      const returnBtn = makePanelNavBtn('時間割へ', async () => {
        const termSelect = document.querySelector<HTMLSelectElement>('#ctl00_phContents_ucRegistSearchList_ddlTerm')
        const quarter = termSelect ? (TERM_QUARTER_MAP[termSelect.value] ?? 1) : 1
        await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter })
      })
      portalPanel.appendChild(returnBtn)

      void appendCourseList(portalPanel)

      // ポータルバグページからのリダイレクト後に保存されたアクションを自動実行
      const pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY)
      if (pendingAction) {
        sessionStorage.removeItem(PENDING_ACTION_KEY)
        sessionStorage.removeItem(PENDING_NAV_STAGE_KEY)
        if (pendingAction === 'import') btn.click()
        else if (pendingAction === 'return') returnBtn.click()
        else if (pendingAction === 'all-q') allQBtn.click()
      }
    }
  }

  // ポータルのバグでTop.aspxまたはBlank.aspxに飛んだ場合も同じパネルを表示
  const isTopPage = currentUrl.startsWith(PORTAL_TOP_URL)
  const isBlankPage = currentUrl.startsWith(PORTAL_BLANK_URL)
  const isBuggyPortalPage = isTopPage || isBlankPage
  if (isBuggyPortalPage) {
    const bugPanel = createSidePanelShell()

    if (isBlankPage) {
      // Blank.aspx到達時: Top.aspxから pendingAction が来ている場合に「履修時間割表」へ中継する
      const pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY)
      const navStage = sessionStorage.getItem(PENDING_NAV_STAGE_KEY)
      console.log('[extension] Blank.aspx到達: url=', currentUrl, 'pendingAction=', pendingAction, 'navStage=', navStage)

      if (pendingAction && navStage === 'top') {
        // 段階1完了（Top.aspx→Blank.aspx）: 「履修時間割表」を探してクリック
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
        const registLink = links.find(a => a.textContent?.trim() === '履修時間割表') ?? null
        const regRawHref = registLink?.getAttribute('href') ?? '未検出'
        console.log('[extension] Blank.aspx: 履修時間割表リンク=', regRawHref)
        if (registLink) {
          sessionStorage.setItem(PENDING_NAV_STAGE_KEY, 'blank')
          invokePortalLink(registLink, 'Blank.aspx 履修時間割表(自動)')
        } else {
          sessionStorage.removeItem(PENDING_ACTION_KEY)
          sessionStorage.removeItem(PENDING_NAV_STAGE_KEY)
          console.error('[extension] Blank.aspx: 履修時間割表リンク未検出 → 中断')
          showOverlayError()
        }
      } else if (pendingAction && navStage === 'blank') {
        // Blank.aspx を2回踏んだ → ループ検出、中断
        sessionStorage.removeItem(PENDING_ACTION_KEY)
        sessionStorage.removeItem(PENDING_NAV_STAGE_KEY)
        console.error('[extension] Blank.aspx: ループ検出（navStage=blank で再到達）→ 中断')
        showOverlayError()
      }
    }

    if (isTopPage) {
      // Top.aspx: 「履修・成績情報」タブをクリックして Blank.aspx へ遷移する（2段階遷移の第1段階）
      const navigateViaTab = async (): Promise<void> => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
        const tabLink = links.find(a => a.textContent?.trim().includes('履修・成績情報')) ?? null
        const tabRawHref = tabLink?.getAttribute('href') ?? '未検出'
        console.log('[extension] Top.aspx: url=', currentUrl, '履修・成績情報タブ=', tabRawHref)
        if (tabLink) {
          sessionStorage.setItem(PENDING_NAV_STAGE_KEY, 'top')
          invokePortalLink(tabLink, 'Top.aspx 履修・成績情報タブ')
        } else {
          sessionStorage.removeItem(PENDING_ACTION_KEY)
          sessionStorage.removeItem(PENDING_NAV_STAGE_KEY)
          console.error('[extension] Top.aspx: 履修・成績情報タブ未検出 → 中断')
          showOverlayError()
        }
        // 遷移が開始されるため、完了表示を出さずに待機する
        await new Promise<never>(() => {})
      }

      bugPanel.appendChild(makePanelActionBtn('今学期の時間割を登録', async () => {
        await ensureToken()
        sessionStorage.setItem(PENDING_ACTION_KEY, 'import')
        console.log('[extension] pendingAction=import 保存、Top.aspx: 履修・成績情報タブ経由で遷移開始')
        await navigateViaTab()
      }))
      bugPanel.appendChild(makePanelActionBtn('全学期の時間割を登録', async () => {
        await ensureToken()
        sessionStorage.setItem(PENDING_ACTION_KEY, 'all-q')
        console.log('[extension] pendingAction=all-q 保存、Top.aspx: 履修・成績情報タブ経由で遷移開始')
        await navigateViaTab()
      }))
    } else {
      // Blank.aspx: 「履修時間割表」を直接探してクリック（Blank.aspx上でボタンを押した場合）
      const navigateViaRegistLink = async (): Promise<void> => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
        const registLink = links.find(a => a.textContent?.trim() === '履修時間割表') ?? null
        const regRawHref = registLink?.getAttribute('href') ?? '未検出'
        console.log('[extension] Blank.aspx(ボタン): url=', currentUrl, '履修時間割表リンク=', regRawHref)
        if (registLink) {
          invokePortalLink(registLink, 'Blank.aspx(ボタン) 履修時間割表')
        } else {
          sessionStorage.removeItem(PENDING_ACTION_KEY)
          sessionStorage.removeItem(PENDING_NAV_STAGE_KEY)
          console.error('[extension] Blank.aspx(ボタン): 履修時間割表リンク未検出 → 中断')
          showOverlayError()
        }
        await new Promise<never>(() => {})
      }

      bugPanel.appendChild(makePanelActionBtn('今学期の時間割を登録', async () => {
        await ensureToken()
        sessionStorage.setItem(PENDING_ACTION_KEY, 'import')
        sessionStorage.setItem(PENDING_NAV_STAGE_KEY, 'blank')
        console.log('[extension] pendingAction=import 保存、Blank.aspx: 履修時間割表リンク経由で遷移開始')
        await navigateViaRegistLink()
      }))
      bugPanel.appendChild(makePanelActionBtn('全学期の時間割を登録', async () => {
        await ensureToken()
        sessionStorage.setItem(PENDING_ACTION_KEY, 'all-q')
        sessionStorage.setItem(PENDING_NAV_STAGE_KEY, 'blank')
        console.log('[extension] pendingAction=all-q 保存、Blank.aspx: 履修時間割表リンク経由で遷移開始')
        await navigateViaRegistLink()
      }))
    }

    bugPanel.appendChild(makePanelNavBtn('時間割へ', async () => {
      const quarter = PANEL_QUARTER_NUM[getPanelCurrentQuarter()]
      await sendMessage<ReturnToAppResponse>({ type: 'RETURN_TO_APP', quarter })
    }))

    void appendCourseList(bugPanel)
  }

  // LMS ページ → サイドパネル（時間割へ / タスクへ / 授業一覧）
  if (currentUrl.includes(LMS_COURSE_BASE)) {
    void initLmsSidePanel()
  }

  // LMS教材ページ（my-reportsページは除外）
  const lmsCourseMatch = currentUrl.match(/\/course\.php\/([^/?#]+)/)
  if (lmsCourseMatch && !currentUrl.includes('/my-reports')) {
    ;(async () => {
      const syncModeResult = await sendMessage<GetSyncModeResponse>({ type: 'GET_SYNC_MODE' })
      console.log('[extension] GET_SYNC_MODE:', JSON.stringify(syncModeResult))

      // 未ログイン / refresh失敗 → 課題同期しない（ボタンも出さない）
      if (!syncModeResult.success && syncModeResult.auth_required) {
        console.log('[extension] auth required, skipping task sync')
        return
      }

      const mode = syncModeResult.mode ?? 'auto'
      console.log('[extension] sync mode:', mode)

      const buildTasks = (): ImportLmsTaskItem[] | null => {
        const html = document.documentElement.outerHTML
        const courseInfo = parseLmsCoursePage(html)
        if (!courseInfo) return null
        return courseInfo.contents
          .filter(c => c.id || c.sourceUrl)
          .map(c => ({
            content_id: c.id,
            source_url: c.sourceUrl,
            title: c.name,
            kind: c.kind,
            course_id: courseInfo.courseId || null,
            course_name: courseInfo.courseName,
            available_from: formatUnixTs(c.startDate),
            available_until: formatUnixTs(c.endDate),
            raw_text: c.rawText,
          }))
      }

      if (mode === 'auto') {
        // 自動モード: ページ読み込み時に自動同期（5分以内の重複送信を防ぐ）
        const courseId = lmsCourseMatch[1]
        if (!courseId) return

        const CACHE_KEY = 'autoSyncedCourses'
        const TTL = 5 * 60 * 1000

        const cacheResult = await chrome.storage.local.get([CACHE_KEY])
        const cache = (cacheResult[CACHE_KEY] ?? {}) as Record<string, number>
        const lastSync = cache[courseId]
        if (lastSync && Date.now() - lastSync < TTL) {
          console.log(`[extension] auto-sync skipped (TTL): courseId=${courseId} lastSync=${new Date(lastSync).toISOString()}`)
          return
        }

        try {
          await ensureToken()
          const contentReady = await waitForCourseContent()
          console.log(`[extension] auto-sync: content ready=${contentReady} courseId=${courseId}`)
          if (!contentReady) {
            console.warn('[extension] auto-sync: course content did not appear within timeout, skipping')
            return
          }
          const tasks = buildTasks()
          console.log(`[extension] auto-sync buildTasks: courseId=${courseId} tasks=${tasks?.length ?? 'null'}`)
          if (!tasks || tasks.length === 0) {
            console.log('[extension] auto-sync: no tasks found, skipping')
            return
          }

          await importLmsTasksWithAuth(tasks)

          cache[courseId] = Date.now()
          chrome.storage.local.set({ [CACHE_KEY]: cache })
          console.log(`[extension] auto-synced ${tasks.length} tasks for courseId=${courseId}`)
        } catch (e) {
          if (e instanceof AuthRequiredError) {
            console.log('[extension] auto-sync: auth required, skipping')
            return
          }
          console.error('[extension] auto-sync error:', e)
        }
      } else {
        // ボタン式モード: パネルの先頭エリアに「課題を追加」を追加
        console.log('[extension] manual mode: creating 課題を追加 button')
        const addTaskBtn = makePanelActionBtn('課題を追加', async () => {
          await ensureToken()
          const tasks = buildTasks()
          if (!tasks) throw new Error('コース情報が見つかりませんでした')
          console.log(`[extension] LMS tasks: ${tasks.length}`, tasks)
          const count = await importLmsTasksWithAuth(tasks)
          console.log(`[extension] ${count} tasks imported`)
        })
        const extrasArea = document.getElementById(LMS_PANEL_EXTRAS_ID)
        console.log('[extension] extrasArea found:', !!extrasArea)
        if (extrasArea) {
          extrasArea.appendChild(addTaskBtn)
        } else {
          // extrasArea が見つからない場合はパネル直下の先頭に挿入
          const fallbackPanel = document.getElementById(LMS_PANEL_ID)
          console.log('[extension] fallbackPanel found:', !!fallbackPanel)
          if (fallbackPanel) {
            // ドラッグハンドルの直後（index 1）に挿入
            fallbackPanel.insertBefore(addTaskBtn, fallbackPanel.children[1] ?? null)
          } else {
            // 最終手段: body に直接 fixed ボタンを追加
            console.warn('[extension] panel not found, appending to body')
            addTaskBtn.style.position = 'fixed'
            addTaskBtn.style.top = '16px'
            addTaskBtn.style.right = '16px'
            addTaskBtn.style.width = 'auto'
            addTaskBtn.style.margin = '0'
            document.body.appendChild(addTaskBtn)
          }
        }
      }
    })()
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnDomReady)
} else {
  initOnDomReady()
}
