console.log('[extension/page-bridge] loaded')

// ページコンテキストで __doPostBack を実行するブリッジ。
// Content Script の isolated world からは window.__doPostBack を直接呼べないため、
// postMessage で受け取って実行する。
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (!event.data || event.data.type !== 'KU_TASKS_RUN_POSTBACK') return

  console.log('[extension/page-bridge] message受信:', event.data)

  const { eventTarget, eventArgument } = event.data

  try {
    if (typeof window.__doPostBack === 'function') {
      console.log('[extension/page-bridge] __doPostBack 実行:', eventTarget, eventArgument)
      window.__doPostBack(eventTarget, eventArgument || '')
    } else {
      console.error('[extension/page-bridge] __doPostBack is not available')
    }
  } catch (error) {
    console.error('[extension/page-bridge] __doPostBack failed', error)
  }
})
