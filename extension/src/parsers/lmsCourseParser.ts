export interface ParsedLmsContent {
  id: string
  name: string
  kind: string       // "資料" | "レポート" | etc.
  folderId: string
  folderName: string
  endDate: number    // unix timestamp (0 = 未設定)
  execCount: number
}

export interface ParsedLmsCourse {
  courseId: string
  courseName: string
  contents: ParsedLmsContent[]
}

export function parseLmsCoursePage(html: string): ParsedLmsCourse | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const courseLink = doc.querySelector('a.course-name') as HTMLAnchorElement | null
  if (!courseLink) return null

  const courseHref = courseLink.getAttribute('href') ?? ''
  const courseId = courseHref.match(/\/course\.php\/([^/?#]+)/)?.[1] ?? ''
  const courseName = courseLink.textContent?.trim() ?? doc.title

  const contents: ParsedLmsContent[] = []

  doc.querySelectorAll('[data-folder-id]').forEach(folder => {
    const folderId = folder.getAttribute('data-folder-id') ?? ''
    const folderName = folder.querySelector('.panel-title')?.textContent?.trim() ?? ''

    folder.querySelectorAll('[data-contents-id]').forEach(item => {
      contents.push({
        id: item.getAttribute('data-contents-id') ?? '',
        name: item.getAttribute('data-contents-name') ?? '',
        kind: item.querySelector('.cl-contentsList_categoryLabel')?.textContent?.trim() ?? '',
        folderId,
        folderName,
        endDate: parseInt(item.getAttribute('data-end-date') ?? '0'),
        execCount: parseInt(item.getAttribute('data-exec-count') ?? '0'),
      })
    })
  })

  return { courseId, courseName, contents }
}
