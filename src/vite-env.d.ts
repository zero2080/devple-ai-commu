/// <reference types="vite/client" />

// .env.example과 1:1. VITE_ 변수는 모두 공개 값 (CONVENTIONS 8장)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MOCK?: string;
  /** Mock DM 봇 지연(ms). 0이면 끔 */
  /** Mock 가짜 상대 봇 지연 ms (DM·그룹 공통, 0이면 끔) */
  readonly VITE_MOCK_BOT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
