export interface GoogleSession {
  accessToken: string
  email: string
}

export interface PickedSpreadsheet {
  id: string
  name: string
}

interface TokenResponse {
  access_token?: string
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

export async function signInWithGoogle(): Promise<GoogleSession> {
  if (!GOOGLE_CLIENT_ID) throw new Error('O Google Sign-In ainda não está configurado para este site.')
  identityScript ??= loadScript('https://accounts.google.com/gsi/client', 'google-identity-services')
  await identityScript

  const tokenClient = window.google?.accounts?.oauth2?.initTokenClient
  if (!tokenClient) throw new Error('O serviço de autenticação Google não ficou disponível.')

  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = tokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: resolve,
      error_callback: (error) => reject(new Error(error.message || 'A autorização Google foi interrompida.')),
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })

  if (response.error || !response.access_token) {
    throw new Error(response.error_description || 'O Google não concedeu acesso a esta sessão.')
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${response.access_token}` },
    cache: 'no-store',
  })
  if (!profileResponse.ok) throw new Error('Não foi possível confirmar a conta Google desta sessão.')
  const profile = await profileResponse.json() as GoogleProfile

  return { accessToken: response.access_token, email: profile.email || 'Conta Google' }
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
