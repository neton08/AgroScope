import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const processEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const getEnv = (name: string) => processEnv[name] || fileEnv[name] || ''
  const orsKey = getEnv('OPENROUTESERVICE_API_KEY') || getEnv('VITE_ORS_API_KEY')
  const outputDirectory = getEnv('GITHUB_PAGES_BUILD') === '1' ? 'docs' : 'dist'

  return {
    plugins: [react()],
    base: './',
    server: {
      allowedHosts: [
        '3000-ijhpd91o8q751nw11yk9t-d036f0a.us4.manus.computer',
        '3000-ijhpd91o8q751nw11yk9t-d036f0a5.us4.manus.computer',
        '8328-ijhpd91o8q751nw11yk9t-d036f0a5.us4.manus.computer',
      ],
    },
    define: {
      'import.meta.env.VITE_ORS_API_KEY': JSON.stringify(orsKey),
      'import.meta.env.VITE_PUBLIC_SHEET_CSV_URL': JSON.stringify(getEnv('VITE_PUBLIC_SHEET_CSV_URL')),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(getEnv('VITE_GOOGLE_CLIENT_ID')),
      'import.meta.env.VITE_GOOGLE_PICKER_API_KEY': JSON.stringify(getEnv('VITE_GOOGLE_PICKER_API_KEY')),
      'import.meta.env.VITE_GOOGLE_APP_ID': JSON.stringify(getEnv('VITE_GOOGLE_APP_ID')),
    },
    build: {
      outDir: outputDirectory,
      emptyOutDir: true,
      sourcemap: false,
      assetsDir: 'assets',
    },
  }
})
