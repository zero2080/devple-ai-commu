/// <reference types="vite/client" />

// .env.example과 1:1. VITE_ 변수는 모두 공개 값 (CONVENTIONS 8장)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
