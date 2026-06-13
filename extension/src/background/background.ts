import type {
  Message,
  FetchUrlResponse,
  PostResponse,
  ImportCoursesResponse,
  ImportAssignmentsResponse,
  ImportLmsTasksResponse,
  OpenLmsTabResponse,
  OpenPortalTabResponse,
  ReturnToAppResponse,
} from '../shared/messages'
import { postToBackend, importCourses, importAssignments, importLmsTasks } from '../shared/api'

type AnyResponse = FetchUrlResponse | PostResponse | ImportCoursesResponse | ImportAssignmentsResponse | ImportLmsTasksResponse | OpenLmsTabResponse | OpenPortalTabResponse | ReturnToAppResponse

const APP_URL_FALLBACK = 'https://ku-calendar-app.onrender.com'

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (r: AnyResponse) => void) => {
    if (message.type === 'FETCH_URL') {
      fetch(message.url)
        .then(res => res.text())
        .then(html => sendResponse({ success: true, html }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'POST_TO_BACKEND') {
      postToBackend({ type: message.syncType, url: message.url, html: message.html })
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_COURSES') {
      importCourses(message.courses, message.syncYear, message.syncQuarters)
        .then(count => sendResponse({ success: true, count }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_ASSIGNMENTS') {
      importAssignments(message.assignments)
        .then(count => sendResponse({ success: true, count }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'IMPORT_LMS_TASKS') {
      importLmsTasks(message.tasks)
        .then(count => sendResponse({ success: true, count }))
        .catch(err => sendResponse({ success: false, error: String(err) }))
      return true
    }

    if (message.type === 'OPEN_LMS_TAB') {
      const tabId = sender.tab?.id ?? null
      const appUrl = sender.tab?.url ?? APP_URL_FALLBACK
      // chrome.storage.session はService Worker 再起動後も値を保持する
      chrome.storage.session.set({ appTabId: tabId, appUrl }, () => {
        chrome.tabs.create({ url: message.url })
        sendResponse({ success: true })
      })
      return true
    }

    if (message.type === 'OPEN_PORTAL_TAB') {
      const tabId = sender.tab?.id ?? null
      const appUrl = sender.tab?.url ?? APP_URL_FALLBACK
      chrome.storage.session.set({ appTabId: tabId, appUrl }, () => {
        chrome.tabs.create({ url: message.url })
        sendResponse({ success: true })
      })
      return true
    }

    if (message.type === 'RETURN_TO_APP') {
      const portalTabId = sender.tab?.id ?? null
      const quarter = message.quarter

      chrome.storage.session.get(['appTabId', 'appUrl'], result => {
        const savedAppTabId = (result['appTabId'] as number | undefined) ?? null
        const savedAppUrl = (result['appUrl'] as string | undefined) || APP_URL_FALLBACK

        const returnUrl = message.path
          ? (() => { const u = new URL(savedAppUrl); u.pathname = message.path!; return u.toString() })()
          : quarter
            ? (() => { const u = new URL(savedAppUrl); u.pathname = '/courses'; u.searchParams.set('returnQuarter', String(quarter)); return u.toString() })()
            : savedAppUrl

        const closePortal = () => {
          if (portalTabId !== null) chrome.tabs.remove(portalTabId)
          sendResponse({ success: true })
        }

        if (savedAppTabId !== null) {
          chrome.tabs.get(savedAppTabId, tab => {
            if (chrome.runtime.lastError || !tab) {
              chrome.tabs.create({ url: returnUrl })
            } else {
              chrome.tabs.update(savedAppTabId, { url: returnUrl, active: true }, t => {
                if (t?.windowId != null) {
                  chrome.windows.update(t.windowId, { focused: true })
                }
              })
            }
            closePortal()
          })
        } else {
          chrome.tabs.create({ url: returnUrl })
          closePortal()
        }
      })
      return true
    }
  }
)
