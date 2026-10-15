/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORS_API_KEY: string
  readonly VITE_PUBLIC_SHEET_CSV_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_PICKER_API_KEY: string
  readonly VITE_GOOGLE_APP_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
