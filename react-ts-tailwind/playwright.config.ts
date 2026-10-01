import { defineConfig, devices } from '@playwright/test'
import { FAKE_URL } from './e2e/fakeSupabase'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    ...devices['Pixel 7'],
    // 使用系統內建的 Edge，不需要另外下載瀏覽器
    channel: 'msedge',
  },
  webServer: {
    command: 'pnpm dev --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    // 已存在的環境變數優先於 .env.local，測試只會連到假的 Supabase
    env: {
      VITE_SUPABASE_URL: FAKE_URL,
      VITE_SUPABASE_ANON_KEY: 'test-key',
    },
  },
})
