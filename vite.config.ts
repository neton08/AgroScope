import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const processEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env ?? {}

const orsKey = processEnv.OPENROUTESERVICE_API_KEY ?? ''
const outputDirectory = processEnv.GITHUB_PAGES_BUILD === '1' ? 'docs' : 'dist'

export default defineConfig({
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
  },
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: 'assets',
  },
})
