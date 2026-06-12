export function parseSyllabusDetail(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const el = doc.getElementById('ctl00_phContents_Detail_lbl_lecture_room_infomation')
  return el?.textContent?.trim() ?? ''
}
