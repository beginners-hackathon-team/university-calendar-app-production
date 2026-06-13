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

function parseCourseCell(cell: Element): Omit<ParsedCourse, 'dayOfWeek' | 'period' | 'year' | 'quarter'> | null {
  const cellText = cell.textContent ?? ''
  if (LOTTERY_LOST_KEYWORDS.some(kw => cellText.includes(kw))) {
    console.log('[parseRegisteredCourses] skip lottery-lost course:', cellText.replace(/\s+/g, ' ').trim().slice(0, 80))
    return null
  }

  const lctCdEl = cell.querySelector('[id$="_lblLctCd"]')
  if (!lctCdEl?.textContent?.trim()) return null

  const staffLink = cell.querySelector('[id$="_lblStaffName"] a') as HTMLAnchorElement | null
  const parts = (staffLink?.innerHTML ?? '').split(/<br\s*\/?>/i)
  const name = parts[0]?.trim() ?? ''
  const teacher = (parts[1] ?? '').replace(/[()（）]/g, '').trim()

  const href = staffLink?.getAttribute('href') ?? ''
  const lctCd = href.match(/lct_cd=([^&]+)/)?.[1] ?? lctCdEl.textContent.trim()
  const lctYear = href.match(/lct_year=(\d+)/)?.[1] ?? ''
  const lctTerm = href.match(/lct_term=([^&]+)/)?.[1] ?? ''
  const dashIdx = lctCd.indexOf('-')
  const facCd = dashIdx >= 0 ? lctCd.slice(0, dashIdx) : ''
  const courseCode = dashIdx >= 0 ? lctCd.slice(dashIdx + 1) : lctCd

  const credits = cell.querySelector('[id$="_lblCredit"]')?.textContent?.trim() ?? ''
  const sbjDiv = cell.querySelector('[id$="_lblSbjDivName"]')?.textContent?.trim() ?? ''

  return { lctCd, lctYear, lctTerm, facCd, courseCode, name, teacher, credits, sbjDiv }
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

  for (let period = 1; period <= 8; period++) {
    for (const [dayKey, dayNum] of Object.entries(DAY_MAP)) {
      const cell = doc.getElementById(`ctl00_phContents_rrMain_ttTable_td${dayKey}${period}`)
      if (!cell) continue
      const parsed = parseCourseCell(cell)
      if (parsed) courses.push({ ...parsed, dayOfWeek: dayNum, period, year, quarter })
    }
  }

  for (let i = 1; i <= 30; i++) {
    const cell = doc.getElementById(`ctl00_phContents_rrMain_ttTable_tdOth${i}`)
    if (!cell) continue
    const parsed = parseCourseCell(cell)
    if (parsed) courses.push({ ...parsed, dayOfWeek: 0, period: 0, year, quarter })
  }

  return courses
}
