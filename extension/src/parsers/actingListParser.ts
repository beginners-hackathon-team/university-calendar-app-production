export interface LmsLinkInfo {
  courseId: string
  systemType: string
}

export function parseActingList(html: string): LmsLinkInfo | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  for (const anchor of doc.querySelectorAll('a')) {
    const text = anchor.textContent ?? ''
    const href = anchor.getAttribute('href') ?? ''
    const onclick = anchor.getAttribute('onclick') ?? ''

    const source = text.includes('LMS') ? href || onclick : ''
    const searchTarget = source || (href.includes('courseId=') ? href : '') || (onclick.includes('courseId=') ? onclick : '')
    if (!searchTarget) continue

    const match = searchTarget.match(/courseId=([0-9]+)/)
    if (!match) continue

    const systemTypeMatch = searchTarget.match(/systemType=([^&'")]+)/)
    return { courseId: match[1], systemType: systemTypeMatch?.[1] ?? '' }
  }

  return null
}
