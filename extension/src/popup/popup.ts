const APP_URL = import.meta.env.VITE_APP_URL as string
if (!APP_URL) {
  throw new Error('[extension] Required env var missing: VITE_APP_URL')
}

const statusBox  = document.getElementById('status-box')  as HTMLDivElement
const statusText = document.getElementById('status-text') as HTMLSpanElement
const openAppBtn = document.getElementById('open-app-btn') as HTMLButtonElement
const hint       = document.getElementById('hint')        as HTMLParagraphElement

chrome.storage.local.get('access_token', result => {
  const token = result['access_token'] as string | undefined
  if (token) {
    statusBox.classList.remove('logged-out')
    statusBox.classList.add('logged-in')
    statusText.textContent = 'ログイン済み'
    hint.textContent = 'ポータルやLMSページで各種ボタンが表示されます。'
  } else {
    statusText.textContent = '未ログイン'
    hint.textContent = 'アプリにログインすると拡張機能が利用できます。'
  }
})

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: APP_URL })
})
