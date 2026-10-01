import { createClient } from '@supabase/supabase-js'
import { createApi } from './api'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 沒設定 .env.local 時為 null，畫面會提示設定方式 */
export const api =
  url && key
    ? createApi(
        createClient(url, key, {
          // 不做帳號登入，不需要保存 session
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      )
    : null
