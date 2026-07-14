import { test as base, expect, type Page } from '@playwright/test'

// backend/app/core/e2e.py の E2E_USER_ID と必ず合わせること
export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'

// frontend/.env.development の VITE_SUPABASE_URL (https://<ref>.supabase.co) から
// 決まる、supabase-jsのデフォルトlocalStorageキー名。プロジェクトを切り替えた場合は
// ここも合わせて変更すること。
const SUPABASE_PROJECT_REF = 'lzpofmjgptzfjhkiqbqp'
const STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`

function buildFakeSession() {
  const nowSec = Math.floor(Date.now() / 1000)
  return {
    access_token: 'e2e-fake-access-token',
    refresh_token: 'e2e-fake-refresh-token',
    // 十分先の未来にしておき、supabase-jsが自動リフレッシュ（＝実サーバーへの通信）を
    // 試みないようにする。バックエンドはe2e_server.pyでJWT検証自体をスキップするので
    // トークンの中身は見られない。
    expires_at: nowSec + 60 * 60 * 24,
    expires_in: 60 * 60 * 24,
    token_type: 'bearer',
    user: {
      id: E2E_USER_ID,
      aud: 'authenticated',
      email: 'e2e@example.com',
      app_metadata: {},
      user_metadata: { full_name: 'E2E Test User' },
      created_at: new Date().toISOString(),
    },
  }
}

/**
 * ログイン済み状態でページを開けるtestフィクスチャ。
 * addInitScriptでSupabaseセッションをlocalStorageに注入することで
 * ログイン画面をスキップする（.claude/skills/verify/SKILL.md の手動手順を自動化）。
 */
export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    const session = buildFakeSession()
    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value))
      },
      { key: STORAGE_KEY, value: session }
    )
    await use(page)
  },
})

export { expect }

/**
 * 初回表示時に出る拡張機能案内モーダルを閉じる。
 * リロードのたびに再表示される仕様なので、ページ遷移後は毎回呼ぶこと。
 * (.claude/skills/verify/SKILL.md 参照)
 */
export async function dismissExtensionModal(page: Page): Promise<void> {
  const modal = page.locator('[aria-labelledby="ext-modal-title"]')
  const visible = await modal.isVisible({ timeout: 2_000 }).catch(() => false)
  if (visible) {
    await page.keyboard.press('Escape')
    await modal.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {})
  }
}
