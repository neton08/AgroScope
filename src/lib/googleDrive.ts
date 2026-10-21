export interface GoogleSession {
  accessToken: string
  email: string
  expiresAt: number
}

export interface PickedSpreadsheet {
  id: string
  name: string
}

interface TokenResponse {
  access_token?: string
  expires_in?: string | number
  error?: string
  error_description?: string
}

interface GoogleProfile {
  email?: string
}

interface GoogleRuntime {
  accounts?: {
    oauth2?: {
      initTokenClient: (options: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: { type?: string; message?: string }) => void
      }) => { requestAccessToken: (options?: { prompt?: string }) => void }
    }
  }
  picker?: Record<string, unknown>
}

interface GapiRuntime {
  load: (name: string, options: {
    callback: () => void
    onerror?: () => void
    ontimeout?: () => void
    timeout?: number
  }) => void
}

declare global {
  interface Window {
    google?: GoogleRuntime
    gapi?: GapiRuntime
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const GOOGLE_PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY?.trim() ?? ''
const GOOGLE_CLOUD_PROJECT_NUMBER = import.meta.env.VITE_GOOGLE_APP_ID?.trim() ?? ''
const GOOGLE_SCOPE = 'openid email https://www.googleapis.com/auth/drive.file'

let identityScript: Promise<void> | null = null
let pickerScript: Promise<void> | null = null
const GOOGLE_SESSION_KEY = 'agroscope.google.session.v1'
const PICKED_SHEET_KEY = 'agroscope.google.picked-sheet.v1'

function readSessionStorage(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key) } catch { return null }
}

function writeSessionStorage(key: string, value: string): void {
  try { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value) } catch { /* A sessão ainda funciona em memória se o navegador bloquear storage. */ }
}

function removeSessionStorage(key: string): void {
  try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key) } catch { /* O navegador pode bloquear storage em modo restrito. */ }
}

function persistGoogleSession(session: GoogleSession): void {
  writeSessionStorage(GOOGLE_SESSION_KEY, JSON.stringify(session))
}

export function clearGoogleSession(): void {
  removeSessionStorage(GOOGLE_SESSION_KEY)
}

export function storePickedSpreadsheet(file: PickedSpreadsheet): void {
  writeSessionStorage(PICKED_SHEET_KEY, JSON.stringify(file))
}

export function getStoredPickedSpreadsheet(): PickedSpreadsheet | null {
  try {
    const stored = readSessionStorage(PICKED_SHEET_KEY)
    if (!stored) return null
    const value = JSON.parse(stored) as Partial<PickedSpreadsheet>
    return typeof value.id === 'string' && value.id && typeof value.name === 'string' ? { id: value.id, name: value.name } : null
  } catch { return null }
}

export function clearPickedSpreadsheet(): void {
  removeSessionStorage(PICKED_SHEET_KEY)
}

export function googleConfiguration(): { clientId: string; pickerKey: string; projectNumber: string } {
  return {
    clientId: GOOGLE_CLIENT_ID,
    pickerKey: GOOGLE_PICKER_API_KEY,
    projectNumber: GOOGLE_CLOUD_PROJECT_NUMBER,
  }
}

export function missingGoogleConfiguration(): string[] {
  const missing: string[] = []
  if (!GOOGLE_CLIENT_ID) missing.push('VITE_GOOGLE_CLIENT_ID')
  if (!GOOGLE_PICKER_API_KEY) missing.push('VITE_GOOGLE_PICKER_API_KEY')
  if (!GOOGLE_CLOUD_PROJECT_NUMBER) missing.push('VITE_GOOGLE_APP_ID')
  return missing
}

function loadScript(src: string, id: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing?.dataset.loaded === 'true') return Promise.resolve()
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar um serviço do Google.')), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('Não foi possível carregar um serviço do Google. Verifique a conexão e tente novamente.'))
    }
    document.head.append(script)
  })
}

async function requestGoogleToken(prompt: string): Promise<TokenResponse> {
  if (!GOOGLE_CLIENT_ID) throw new Error('O Google Sign-In ainda não está configurado para este site.')
  identityScript ??= loadScript('https://accounts.google.com/gsi/client', 'google-identity-services')
  await identityScript

  const tokenClient = window.google?.accounts?.oauth2?.initTokenClient
  if (!tokenClient) throw new Error('O serviço de autenticação Google não ficou disponível.')

  const response = await new Promise<TokenResponse>((resolve, reject) => {
    let settled = false
    let timeout = 0
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      callback()
    }
    timeout = window.setTimeout(() => finish(() => reject(new Error('A autorização Google demorou demais para responder.'))), 12000)
    try {
      const client = tokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: (token) => finish(() => resolve(token)),
        error_callback: (error) => finish(() => reject(new Error(error.message || 'A autorização Google foi interrompida.'))),
      })
      client.requestAccessToken({ prompt })
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error('Não foi possível iniciar a autorização Google.')))
    }
  })

  if (response.error || !response.access_token) {
    throw new Error(response.error_description || 'O Google não concedeu acesso a esta sessão.')
  }
  return response
}

class GoogleProfileError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GoogleProfileError'
  }
}

async function getGoogleEmail(accessToken: string): Promise<string> {
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!profileResponse.ok) throw new GoogleProfileError('Não foi possível confirmar a conta Google desta sessão.', profileResponse.status)
  const profile = await profileResponse.json() as GoogleProfile
  return profile.email || 'Conta Google'
}

function createSession(response: TokenResponse, email: string): GoogleSession {
  const seconds = Number(response.expires_in)
  const duration = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 3600_000
  return { accessToken: response.access_token!, email, expiresAt: Date.now() + duration }
}

export async function signInWithGoogle(): Promise<GoogleSession> {
  const response = await requestGoogleToken('select_account')
  const session = createSession(response, await getGoogleEmail(response.access_token!))
  persistGoogleSession(session)
  return session
}

export async function restoreGoogleSession(): Promise<GoogleSession | null> {
  let saved: GoogleSession | null = null
  try {
    const raw = readSessionStorage(GOOGLE_SESSION_KEY)
    if (raw) {
      const value = JSON.parse(raw) as Partial<GoogleSession>
      if (typeof value.accessToken === 'string' && value.accessToken && typeof value.email === 'string' && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)) {
        saved = { accessToken: value.accessToken, email: value.email, expiresAt: value.expiresAt }
      }
    }
  } catch { saved = null }
  if (!saved) {
    clearGoogleSession()
    clearPickedSpreadsheet()
    return null
  }
  let tokenKnownInvalid = false
  if (saved.expiresAt > Date.now() + 120_000) {
    try {
      const verified = { ...saved, email: await getGoogleEmail(saved.accessToken) }
      persistGoogleSession(verified)
      return verified
    } catch (error) {
      if (!(error instanceof GoogleProfileError) || error.status !== 401) return saved
      tokenKnownInvalid = true
    }
  }

  try {
    const response = await requestGoogleToken('')
    const renewed = createSession(response, await getGoogleEmail(response.access_token!))
    persistGoogleSession(renewed)
    return renewed
  } catch {
    if (!tokenKnownInvalid && saved.expiresAt > Date.now()) return saved
    clearGoogleSession()
    clearPickedSpreadsheet()
    return null
  }
}

export async function chooseSpreadsheet(accessToken: string): Promise<PickedSpreadsheet | null> {
  if (!GOOGLE_PICKER_API_KEY || !GOOGLE_CLOUD_PROJECT_NUMBER) {
    throw new Error('O Google Picker ainda não está configurado para este site.')
  }

  pickerScript ??= loadScript('https://apis.google.com/js/api.js', 'google-api-client')
  await pickerScript
  if (!window.gapi) throw new Error('O seletor de planilhas do Google não ficou disponível.')

  await new Promise<void>((resolve, reject) => {
    window.gapi?.load('picker', {
      callback: resolve,
      onerror: () => reject(new Error('Não foi possível carregar o seletor Google Drive.')),
      ontimeout: () => reject(new Error('O seletor Google Drive demorou demais para carregar.')),
      timeout: 10000,
    })
  })

  const picker = window.google?.picker as Record<string, any> | undefined
  const PickerBuilder = picker?.PickerBuilder as (new () => Record<string, any>) | undefined
  const DocsView = picker?.DocsView as (new (viewId: unknown) => Record<string, any>) | undefined
  const ViewId = picker?.ViewId as Record<string, unknown> | undefined
  const Action = picker?.Action as Record<string, unknown> | undefined
  if (!PickerBuilder || !DocsView || !ViewId || !Action) {
    throw new Error('O seletor de planilhas do Google não ficou disponível.')
  }

  return new Promise((resolve, reject) => {
    try {
      const view = new DocsView(ViewId.SPREADSHEETS)
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
      const builder = new PickerBuilder()
        .setAppId(GOOGLE_CLOUD_PROJECT_NUMBER)
        .setDeveloperKey(GOOGLE_PICKER_API_KEY)
        .setOAuthToken(accessToken)
        .setOrigin(window.location.origin)
        .setTitle('Selecione a base operacional AgroScope')
        .addView(view)
        .setCallback((data: { action?: unknown; docs?: Array<{ id?: string; name?: string }> }) => {
          if (data.action === Action.PICKED) {
            const doc = data.docs?.[0]
            if (!doc?.id) {
              reject(new Error('O Google não retornou uma planilha selecionada.'))
              return
            }
            resolve({ id: doc.id, name: doc.name || 'Planilha selecionada' })
          } else if (data.action === Action.CANCEL) {
            resolve(null)
          }
        })
      builder.build().setVisible(true)
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Não foi possível abrir o seletor de planilhas.'))
    }
  })
}

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

export async function googleFetchJson<T>(url: string, accessToken: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  })
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
  if (!response.ok) {
    throw new GoogleApiError(body.error?.message || 'A solicitação Google não foi concluída.', response.status)
  }
  return body as T
}
