export const PORTAL_REGIST_LIST_BASE = 'https://eduweb.sta.kanazawa-u.ac.jp/Portal/StudentApp/Regist/RegistList.aspx'
export const ACANTHUS_SSO_BASE = 'https://acanthus.cis.kanazawa-u.ac.jp/base/lms-course/sso-link/'

export function buildPortalRegistListUrl(term: string): string {
  return `${PORTAL_REGIST_LIST_BASE}?targetTerm=${term}`
}

export function buildAcanthusSsoUrl(courseId: string, systemType: string): string {
  return `${ACANTHUS_SSO_BASE}?courseId=${courseId}&systemType=${systemType}`
}
