import type { Coordinate, Project, RouteInfo } from '../data/types'
import { normalizeKey } from './format'

const ROUTE_ENDPOINT = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson'
const GEOCODE_ENDPOINT = 'https://api.heigit.org/pelias/v1/search'
const REVERSE_ENDPOINT = 'https://api.heigit.org/pelias/v1/reverse'
const API_KEY = import.meta.env.VITE_ORS_API_KEY
const MIN_INTERVAL_MS = 1_550
let lastRequestAt = 0
let requestQueue: Promise<void> = Promise.resolve()

const stateNames: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

interface PeliasFeature {
  geometry?: { coordinates?: number[] }
  properties?: {
    name?: string
    locality?: string
    region?: string
    region_a?: string
    country?: string
    country_a?: string
    layer?: string
    confidence?: number
  }
}

type Operation = 'rota' | 'geocodificação'

function sessionGet<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

function sessionSet(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A cache indisponível não impede o cálculo da rota.
  }
}

function rateLimit(): Promise<void> {
  const scheduled = requestQueue.then(async () => {
    const elapsed = Date.now() - lastRequestAt
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
    }
    lastRequestAt = Date.now()
  })
  requestQueue = scheduled.catch(() => undefined)
  return scheduled
}

function apiError(status: number, operation: Operation = 'rota'): Error {
  const service = operation === 'rota' ? 'rota' : 'geocodificação'
  if (status === 429) return new Error(`O limite gratuito do OpenRouteService foi atingido durante a ${operation}. Tente novamente mais tarde.`)
  if (status === 401 || status === 403) return new Error(`A chave do OpenRouteService não foi aceita ou atingiu a cota durante a ${operation}.`)
  if (status === 404 && operation === 'rota') return new Error('O serviço de rota não encontrou um trajeto entre estes pontos.')
  if (status === 404) return new Error('O serviço de geocodificação não encontrou uma localidade correspondente.')
  return new Error(`O serviço de ${service} respondeu com HTTP ${status}. Tente novamente mais tarde.`)
}

function normalizeGeography(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.,/|;–—-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function stateAbbreviation(value: string): string | null {
  const normalized = normalizeGeography(value)
  if (stateNames[normalized]) return normalized
  const exactName = Object.entries(stateNames).find(([, name]) => normalizeGeography(name) === normalized)
  if (exactName) return exactName[0]
  for (const [abbreviation, name] of Object.entries(stateNames)) {
    if (normalized.endsWith(` ${normalizeGeography(name)}`)) return abbreviation
  }
  const suffix = normalized.match(/(?:^|\s)([A-Z]{2})$/)?.[1]
  return suffix && stateNames[suffix] ? suffix : null
}

function cityAndState(city: string, region: string): { cityName: string; uf: string | null; stateConflict: boolean } {
  const trimmedCity = city.trim()
  const parts = trimmedCity.split(/\s*[-–,/|]\s*/).map((part) => part.trim()).filter(Boolean)
  let cityName = trimmedCity
  const regionUf = stateAbbreviation(region)
  let cityUf: string | null = null

  if (parts.length > 1) {
    cityUf = stateAbbreviation(parts[parts.length - 1])
    if (cityUf) cityName = parts.slice(0, -1).join(' ').trim()
  } else {
    const suffix = trimmedCity.match(/^(.*\S)\s+([A-Za-z]{2})$/)
    cityUf = suffix ? stateAbbreviation(suffix[2]) : null
    if (suffix && cityUf) cityName = suffix[1].trim()
  }

  return {
    cityName: cityName || trimmedCity,
    uf: regionUf ?? cityUf,
    stateConflict: Boolean(regionUf && cityUf && regionUf !== cityUf),
  }
}

function coordinateForFeature(feature: PeliasFeature): Coordinate | null {
  const coordinates = feature.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) return null
  const [lon, lat] = coordinates
  if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

function displayRegion(properties: NonNullable<PeliasFeature['properties']>): string {
  const abbreviation = stateAbbreviation(properties.region_a ?? '') ?? stateAbbreviation(properties.region ?? '')
  return abbreviation ?? properties.region ?? ''
}

export async function reverseGeocodeBase(point: Coordinate): Promise<string | null> {
  if (!API_KEY) throw new Error('A chave pública do OpenRouteService não está configurada no build do site.')
  const cacheKey = `ors-base-city:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`
  const cached = sessionGet<{ label: string | null }>(cacheKey)
  if (cached) return cached.label

  const url = new URL(REVERSE_ENDPOINT)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('point.lat', String(point.lat))
  url.searchParams.set('point.lon', String(point.lon))
  url.searchParams.set('size', '5')
  url.searchParams.set('boundary.country', 'BRA')
  await rateLimit()
  let response: Response
  try {
    response = await fetch(url.toString(), { method: 'GET', mode: 'cors' })
  } catch {
    throw new Error('Não foi possível consultar a localidade da base. Confira a conexão e tente novamente.')
  }
  if (!response.ok) throw apiError(response.status, 'geocodificação')

  const data = (await response.json()) as { features?: PeliasFeature[] }
  const candidates = (data.features ?? []).filter((feature) => {
    const properties = feature.properties ?? {}
    const country = (properties.country_a || '').toUpperCase()
    const layer = (properties.layer || '').toLowerCase()
    const confidence = properties.confidence ?? 0
    return country === 'BRA' && Boolean(properties.locality || properties.name) &&
      confidence >= 0.45 && ['locality', 'localadmin'].includes(layer)
  })
  const distinct = new Map<string, PeliasFeature>()
  for (const feature of candidates) {
    const properties = feature.properties ?? {}
    const name = properties.locality || properties.name || ''
    const region = displayRegion(properties)
    const key = normalizeKey(`${name}|${region}`)
    const existing = distinct.get(key)
    if (!existing || (feature.properties?.layer === 'locality' && existing.properties?.layer !== 'locality')) {
      distinct.set(key, feature)
    }
  }

  const chosen = distinct.size === 1 ? [...distinct.values()][0] : null
  const properties = chosen?.properties
  const locality = properties?.locality || properties?.name
  if (!locality) {
    sessionSet(cacheKey, { label: null })
    return null
  }
  const region = displayRegion(properties)
  const label = `${locality}${region ? ` · ${region}` : ''}`
  sessionSet(cacheKey, { label })
  return label
}

async function cityCoordinate(project: Project): Promise<{ point: Coordinate; label: string }> {
  if (!project.city || project.city === 'Cidade não informada') {
    throw new Error('A fazenda não tem coordenada exata e a cidade atendida não foi informada.')
  }
  if (!API_KEY) throw new Error('A chave pública do OpenRouteService não está configurada no build do site.')

  const { cityName, uf, stateConflict } = cityAndState(project.city, project.region)
  if (stateConflict) {
    throw new Error('A UF da cidade diverge da regional cadastrada. Confira os campos CIDADE e REGIONAL antes de calcular a rota.')
  }
  const fullState = uf ? stateNames[uf] : undefined
  const queryText = [cityName, fullState, 'Brasil'].filter(Boolean).join(', ')
  const cacheKey = `ors-city:${normalizeKey(queryText)}`
  const cached = sessionGet<{ point: Coordinate; label: string }>(cacheKey)
  if (cached) return cached

  const url = new URL(GEOCODE_ENDPOINT)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('text', queryText)
  url.searchParams.set('size', '5')
  url.searchParams.set('boundary.country', 'BRA')
  await rateLimit()
  let response: Response
  try {
    response = await fetch(url.toString(), { method: 'GET', mode: 'cors' })
  } catch {
    throw new Error('Não foi possível consultar a localização da cidade. Confira a conexão e tente novamente.')
  }
  if (!response.ok) throw apiError(response.status, 'geocodificação')

  const data = (await response.json()) as { features?: PeliasFeature[] }
  const target = normalizeKey(cityName)
  const candidates = (data.features ?? []).filter((feature) => {
    const properties = feature.properties ?? {}
    const label = normalizeKey(properties.locality || properties.name || '')
    const country = (properties.country_a || '').toUpperCase()
    const confidence = properties.confidence ?? 0
    const layer = (properties.layer || '').toLowerCase()
    const candidateUf = stateAbbreviation(properties.region_a ?? '') ?? stateAbbreviation(properties.region ?? '')
    const regionMatch = !uf || candidateUf === uf
    const cityMatch = label === target
    return country === 'BRA' && cityMatch && regionMatch && confidence >= 0.45 && ['locality', 'localadmin'].includes(layer)
  })
  if (candidates.length !== 1) {
    throw new Error('Não foi possível identificar a cidade/UF com segurança; complete a coordenada exata da fazenda na planilha.')
  }
  const point = coordinateForFeature(candidates[0])
  if (!point) throw new Error('O serviço não retornou uma coordenada válida para a cidade.')
  const result = { point, label: `${cityName}${uf ? ` - ${uf}` : ''} · centro aproximado` }
  sessionSet(cacheKey, result)
  return result
}

export async function calculateRoute(project: Project): Promise<RouteInfo> {
  if (!project.hasUnit) throw new Error('Este colaborador ainda não tem uma fazenda/unidade vinculada na planilha.')
  if (!API_KEY) throw new Error('A chave pública do OpenRouteService não está configurada no build do site.')
  if (!project.baseCoord) throw new Error('A coordenada da base do colaborador não está informada na planilha.')

  const destination = project.farmCoord
    ? { point: project.farmCoord, label: project.farm || 'Fazenda', source: 'fazenda' as const }
    : { ...(await cityCoordinate(project)), source: 'cidade aproximada' as const }
  const origin = project.baseCoord
  const key = `ors-route:${origin.lat},${origin.lon}:${destination.point.lat},${destination.point.lon}`
  const cached = sessionGet<RouteInfo>(key)
  if (cached) return cached

  await rateLimit()
  let response: Response
  try {
    response = await fetch(ROUTE_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      headers: {
        Authorization: API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [[origin.lon, origin.lat], [destination.point.lon, destination.point.lat]],
        preference: 'fastest',
        instructions: false,
      }),
    })
  } catch {
    throw new Error('Não foi possível conectar ao serviço de rota. Tente novamente mais tarde.')
  }
  if (!response.ok) throw apiError(response.status)

  const data = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[][] }
      properties?: { summary?: { distance?: number; duration?: number } }
    }>
  }
  const feature = data.features?.[0]
  const summary = feature?.properties?.summary
  const coordinates = feature?.geometry?.coordinates
  if (!summary || summary.distance === undefined || summary.duration === undefined || !coordinates?.length) {
    throw new Error('O serviço não encontrou um trajeto rodoviário para este destino.')
  }
  const path = coordinates
    .filter((point) => point.length >= 2)
    .map(([lon, lat]) => ({ lat, lon }))
  const result: RouteInfo = {
    path,
    distanceKm: summary.distance / 1000,
    durationSeconds: summary.duration,
    destination: destination.point,
    destinationLabel: destination.label,
    destinationSource: destination.source,
    originLabel: project.region || 'Base informada na planilha',
  }
  sessionSet(key, result)
  return result
}
