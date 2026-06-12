export interface ParsedReport {
  taskName: string
  taskContentsId: string   // href から抽出したコンテンツID
  questionNo: string
  fileName?: string
  fileDownloadPath?: string
  submittedAt?: string     // "2026-06-08 04:05:43"
  result: string           // "○" | "未" など
  score?: string           // "10/10"
}

export function parseMyReports(html: string): ParsedReport[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const reports: ParsedReport[] = []

  // .table-striped を優先して探し、なければ tbody を持つテーブル全般を探す
  const table = doc.querySelector('.table-striped') ?? doc.querySelector('table tbody')?.closest('table')
  if (!table) {
    console.warn('[myReportsParser] No table found. page title:', doc.title)
    return reports
  }

  table.querySelectorAll('tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td')
    if (cells.length < 6) return

    const taskLink = cells[0]?.querySelector('a') as HTMLAnchorElement | null
    const taskName = taskLink?.textContent?.trim() ?? cells[0]?.textContent?.trim() ?? ''
    const taskContentsId = taskLink?.getAttribute('href')?.match(/contents\/([^/?#]+)/)?.[1] ?? ''

    const questionNo = cells[1]?.textContent?.trim() ?? ''

    const fileLink = cells[2]?.querySelector('a') as HTMLAnchorElement | null
    const fileName = fileLink?.textContent?.trim() || undefined
    const fileDownloadPath = fileLink?.getAttribute('href') ?? undefined

    const rawDate = cells[3]?.textContent?.trim()
    const submittedAt = rawDate || undefined

    const result = cells[4]?.textContent?.trim() ?? ''

    const scoreLink = cells[5]?.querySelector('a') as HTMLAnchorElement | null
    const score = (scoreLink?.textContent?.trim() ?? cells[5]?.textContent?.trim()) || undefined

    reports.push({ taskName, taskContentsId, questionNo, fileName, fileDownloadPath, submittedAt, result, score })
  })

  return reports
}
