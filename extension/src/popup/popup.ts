const tokenInput = document.getElementById('token') as HTMLInputElement
const saveBtn = document.getElementById('save') as HTMLButtonElement
const statusEl = document.getElementById('status') as HTMLDivElement

chrome.storage.local.get('access_token', result => {
  const stored = result['access_token'] as string | undefined
  if (stored) {
    tokenInput.value = stored
    statusEl.textContent = '保存済み'
  }
})

saveBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim()
  if (!token) {
    statusEl.textContent = 'トークンを入力してください'
    return
  }
  chrome.storage.local.set({ access_token: token }, () => {
    statusEl.textContent = '保存しました'
  })
})
