import { defineConfig, devices } from '@playwright/test'

// scripts/e2e/run.sh がバックエンド(8000)・フロントエンド(5173)を起動してから
// このconfigでのテスト実行を呼び出す想定。webServerは使わない
// （バックエンドはDocker内で認証バイパス版を起動する必要があるため、
//   起動ロジックはシェルスクリプト側に集約している）。
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
