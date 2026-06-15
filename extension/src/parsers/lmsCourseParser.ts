export interface ParsedLmsContent {
  id: string | null
  name: string
  kind: string | null
  sourceUrl: string | null
  rawText: string | null
  folderId: string
  folderName: string
  startDate: number  // unix timestamp (0 = 未設定)
  endDate: number    // unix timestamp (0 = 未設定)
  execCount: number
}

export interface ParsedLmsCourse {
  courseId: string
  courseName: string | null
  contents: ParsedLmsContent[]
}

export function parseLmsCoursePage(html: string): ParsedLmsCourse | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const courseLink = doc.querySelector('a.course-name') as HTMLAnchorElement | null
  if (!courseLink) return null

  const courseHref = courseLink.getAttribute('href') ?? ''
  const courseId = courseHref.match(/\/course\.php\/([^/?#]+)/)?.[1] ?? ''
  const courseName = courseLink.textContent?.trim() || null

  const contents: ParsedLmsContent[] = []

  doc.querySelectorAll('[data-folder-id]').forEach(folder => {
    const folderId = folder.getAttribute('data-folder-id') ?? ''
    const folderName = folder.querySelector('.panel-title')?.textContent?.trim() ?? ''

    folder.querySelectorAll('[data-contents-id]').forEach(item => {
      const kindText = item.querySelector('.cl-contentsList_categoryLabel')?.textContent?.trim()
      const link = item.querySelector('a') as HTMLAnchorElement | null
      contents.push({
        id: item.getAttribute('data-contents-id') || null,
        name: item.getAttribute('data-contents-name') ?? '',
        kind: kindText || null,
        sourceUrl: link?.getAttribute('href') || null,
        rawText: item.textContent?.trim() || null,
        folderId,
        folderName,
        startDate: parseInt(item.getAttribute('data-start-date') ?? '0'),
        endDate: parseInt(item.getAttribute('data-end-date') ?? '0'),
        execCount: parseInt(item.getAttribute('data-exec-count') ?? '0'),
      })
    })
  })

  return { courseId, courseName, contents }
}
