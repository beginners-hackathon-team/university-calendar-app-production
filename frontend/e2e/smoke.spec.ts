import { test, expect, dismissExtensionModal } from './fixtures/auth'

// スモークテスト: 主要ページが認証バイパス状態で正しく描画されるかを確認する。
// pytest/vitest ではカバーできない「実ブラウザでフロント〜バックエンドが
// 繋がって動くか」を検証するのがこのテストの役割。
// 実行方法: bash scripts/e2e/run.sh

test.describe('スモークテスト', () => {
  test('カレンダーページが表示される', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))

    await page.goto('/calendar')
    await dismissExtensionModal(page)

    await expect(page).toHaveURL(/\/calendar$/)
    await expect(page.locator('.fc')).toBeVisible({ timeout: 15_000 })

    expect(
      pageErrors,
      `ページ内で未捕捉のJSエラーが発生: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toEqual([])
  })

  test('タスクページが表示される', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (err) => pageErrors.push(err))

    await page.goto('/tasks')
    await dismissExtensionModal(page)

    // ログインガードで /login に飛ばされていない（＝認証バイパスが効いている）ことを確認
    await expect(page).toHaveURL(/\/tasks$/)

    expect(
      pageErrors,
      `ページ内で未捕捉のJSエラーが発生: ${pageErrors.map((e) => e.message).join(', ')}`
    ).toEqual([])
  })
})
