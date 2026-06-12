export interface ParsedSession {
  date: string
  period: number
  time: string
  room: string
  teacher: string
  topic: string
}

export interface ParsedLectureDetail {
  lctCd: string
  lctYear: string
  name: string
  term: string
  day: string      // "月1"
  credits: string
  rooms: string[]  // 全授業の教室名（重複除去済み）
  sessions: ParsedSession[]
}

export function parseLectureDetail(html: string): ParsedLectureDetail | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const get = (id: string) => doc.getElementById(id)?.textContent?.trim() ?? ''

  const lctCd = get('ctl00_phContents_ucLctList_lblLctCd')
  if (!lctCd) return null

  const lctYear = get('ctl00_phContents_ucLctList_lblYear')
  const rawName = get('ctl00_phContents_ucLctList_lblLctName')
  const name = rawName.split('\n')[0]?.trim() ?? rawName
  const term = get('ctl00_phContents_ucLctList_lblTerm')
  const day = get('ctl00_phContents_ucLctList_lblDay')
  const credits = get('ctl00_phContents_ucLctList_lblCredits')

  const sessions: ParsedSession[] = []
  const gv = doc.getElementById('ctl00_phContents_ucLctList_gv')
  if (gv) {
    const rows = gv.querySelectorAll('tbody tr')
    rows.forEach((row, idx) => {
      if (idx === 0) return // ヘッダー行をスキップ
      const cells = row.querySelectorAll('td')
      if (cells.length < 6) return
      const date = cells[1]?.textContent?.trim() ?? ''
      if (!date) return
      sessions.push({
        date,
        period: parseInt(cells[2]?.textContent?.trim() ?? '0'),
        time: cells[3]?.textContent?.trim() ?? '',
        room: cells[4]?.textContent?.trim() ?? '',
        teacher: cells[5]?.textContent?.trim() ?? '',
        topic: cells[6]?.textContent?.trim() ?? '',
      })
    })
  }

  const rooms = [...new Set(sessions.map(s => s.room).filter(Boolean))]

  return { lctCd, lctYear, name, term, day, credits, rooms, sessions }
}
