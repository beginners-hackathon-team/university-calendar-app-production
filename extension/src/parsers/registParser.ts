export interface ParsedCourse {
  lctCd: string      // "15-13403"
  lctYear: string    // "2026"
  lctTerm: string    // "00"
  facCd: string      // "15"
  courseCode: string // "13403"
  name: string       // "データマイニング論Ａ"
  teacher: string    // "南保　英孝"
  dayOfWeek: number  // 1=月 2=火 3=水 4=木 5=金 6=土 0=集中等
  period: number     // 1-8, 0=集中等
  year: number       // 2026
  quarter: number    // portal value: 11=Q1 12=Q2 21=Q3 22=Q4
  credits: string    // "1単位"
  sbjDiv: string     // "[選択１]"
}

const DAY_MAP: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const LOTTERY_LOST_KEYWORDS = ['抽選漏れ', '落選', '不許可']

// lctCdEl から staffNameEl への最小共通祖先を返す（= その授業ブロック）
// root まで到達しても見つからなければ root を返す
function findCourseBlock(lctCdEl: Element, staffNameEl: Element | null, root: Element): Element {
  if (!staffNameEl) return lctCdEl.parentElement ?? root
  let el: Element | null = lctCdEl.parentElement
  while (el && el !== root) {
    if (el.contains(staffNameEl)) return el
    el = el.parentElement
  }
  return root
}

function parseCoursesFromCell(
  cell: Element,
  dayOfWeek: number,
  period: number,
  year: number,
  quarter: number,
): ParsedCourse[] {
  const lctCdEls = Array.from(cell.querySelectorAll<Element>('[id$="_lblLctCd"]'))
  if (lctCdEls.length === 0) return []

  const results: ParsedCourse[] = []

  for (const lctCdEl of lctCdEls) {
    if (!lctCdEl.textContent?.trim()) continue

    // IDプレフィックスで同一授業の他要素を特定
    const prefix = lctCdEl.id.replace(/_lblLctCd$/, '')
    const staffNameEl = cell.querySelector<Element>(`[id="${prefix}_lblStaffName"]`)
    const staffLink = staffNameEl?.querySelector<HTMLAnchorElement>('a') ?? null

    // この授業だけのブロック（最小共通祖先）で抽選漏れを判定
    const courseBlock = findCourseBlock(lctCdEl, staffNameEl, cell)
    if (LOTTERY_LOST_KEYWORDS.some(kw => (courseBlock.textContent ?? '').includes(kw))) {
      console.log('[parseRegisteredCourses] skip lottery-lost:', lctCdEl.textContent.trim())
      continue
    }

    const href = staffLink?.getAttribute('href') ?? ''
    const parts = (staffLink?.innerHTML ?? '').split(/<br\s*\/?>/i)
    const name = parts[0]?.trim() ?? ''
    const teacher = (parts[1] ?? '').replace(/[()（）]/g, '').trim()

    if (!name) continue

    const lctCd = href.match(/lct_cd=([^&]+)/)?.[1] ?? lctCdEl.textContent.trim()
    const lctYear = href.match(/lct_year=(\d+)/)?.[1] ?? ''
    const lctTerm = href.match(/lct_term=([^&]+)/)?.[1] ?? ''
    const dashIdx = lctCd.indexOf('-')
    const facCd = dashIdx >= 0 ? lctCd.slice(0, dashIdx) : ''
    const courseCode = dashIdx >= 0 ? lctCd.slice(dashIdx + 1) : lctCd

    const credits = cell.querySelector(`[id="${prefix}_lblCredit"]`)?.textContent?.trim() ?? ''
    const sbjDiv = cell.querySelector(`[id="${prefix}_lblSbjDivName"]`)?.textContent?.trim() ?? ''

    results.push({ lctCd, lctYear, lctTerm, facCd, courseCode, name, teacher, credits, sbjDiv, dayOfWeek, period, year, quarter })
  }

  return results
}

export function parseRegisteredCourses(html: string): ParsedCourse[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const courses: ParsedCourse[] = []

  const year = parseInt(
    doc.querySelector('#ctl00_phContents_ucRegistSearchList_ddlYear_ddl option[selected]')
      ?.getAttribute('value') ?? '0'
  )
  const quarter = parseInt(
    doc.querySelector('#ctl00_phContents_ucRegistSearchList_ddlTerm option[selected]')
      ?.getAttribute('value') ?? '0'
  )

  // 通常コマ（月〜土、1〜8限）
  for (let period = 1; period <= 8; period++) {
    for (const [dayKey, dayNum] of Object.entries(DAY_MAP)) {
      const cell = doc.getElementById(`ctl00_phContents_rrMain_ttTable_td${dayKey}${period}`)
      if (!cell) continue
      courses.push(...parseCoursesFromCell(cell, dayNum, period, year, quarter))
    }
  }

  // 集中講義（tdOth系）- 存在するセルをすべて動的に取得
  const othCells = Array.from(
    doc.querySelectorAll('[id^="ctl00_phContents_rrMain_ttTable_tdOth"]')
  )
  for (const cell of othCells) {
    courses.push(...parseCoursesFromCell(cell, 0, 0, year, quarter))
  }

  return courses
}
