import Papa from 'papaparse'
import type { Coordinate, Project } from './types'

export const PUBLIC_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1T5th-xWhvAq-2Kc8eO9JNLRskZdsWhL88fXUzd5DAx0/gviz/tq?tqx=out:csv&sheet=PAINEL_PUBLICO'

const SERVICE_FIELDS = [
  { key: 'PONTO FOCAL DE CAMPO', aliases: ['POSSUI PONTO FOCAL DE CAMPO? SIM/NÃO', 'PONTO FOCAL DE CAMPO? SIM/NÃO'] },
  { key: 'CB', aliases: ['CB'] },
  { key: 'COMBOIO', aliases: ['COMBOIO'] },
  { key: 'ESTAÇÃO', aliases: ['ESTAÇÃO'] },
  { key: 'PLUVIOMETRO', aliases: ['PLUVIOMETRO', 'PLUVIÔMETRO'] },
  { key: 'SOLINFNET', aliases: ['SOLINFNET'] },
  { key: 'CDA', aliases: ['CDA'] },
  { key: 'CDG', aliases: ['CDG'] },
  { key: '4G', aliases: ['4G'] },
] as const

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeHeader(value: string): string {
  return normalizeText(value).toUpperCase().replace(/\s+/g, ' ')
}

function numberFromCell(value: unknown): number | null {
  const source = String(value ?? '').trim()
  if (!source) return null
  let number = source.replace(/[^\d,.-]/g, '')
  if (!number || !/\d/.test(number)) return null

  const lastComma = number.lastIndexOf(',')
  const lastDot = number.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) number = number.replace(/\./g, '').replace(',', '.')
    else number = number.replace(/,/g, '')
  } else if (lastComma >= 0) {
    const after = number.length - lastComma - 1
    number = after > 2 ? number.replace(/,/g, '') : number.replace(',', '.')
  } else if ((number.match(/\./g) ?? []).length > 1) {
    number = number.replace(/\./g, '')
  }

  const parsed = Number(number)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCoordinate(value: unknown): Coordinate | null {
  const source = String(value ?? '').trim()
  if (!source) return null
  const parts = source.match(/-?\d+(?:[.,]\d+)?/g)
  if (!parts || parts.length < 2) return null
  const first = Number(parts[0].replace(',', '.'))
  const second = Number(parts[1].replace(',', '.'))
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null
  if (Math.abs(first) > 90 || Math.abs(second) > 180) return null
  return { lat: first, lon: second }
}

function isAffirmative(value: string): boolean {
  const normalized = normalizeText(value).toUpperCase()
  return ['SIM', 'S', 'YES', 'TRUE', '1', 'OK'].includes(normalized)
}

function makeId(parts: string[], fallbackIndex: number): string {
  const key = parts.map((part) => normalizeText(part).toLowerCase()).join('|')
  const compact = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9|]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return compact || `registro-${fallbackIndex}`
}

export function parseProjects(csv: string): Project[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  if (parsed.errors.length) {
    const serious = parsed.errors.find((error) => error.type !== 'FieldMismatch')
    if (serious) throw new Error('A planilha retornou um CSV inválido.')
  }

  const records = parsed.data
  if (!records.length) throw new Error('A aba pública ainda não contém registros.')
  const headerMap = new Map<string, string>()
  for (const header of Object.keys(records[0])) headerMap.set(normalizeHeader(header), header)

  const field = (row: Record<string, string>, ...labels: string[]): string => {
    for (const label of labels) {
      const original = headerMap.get(normalizeHeader(label))
      const value = original ? String(row[original] ?? '').trim() : ''
      if (value) return value
    }
    return ''
  }

  const unique = new Map<string, Project>()
  records.forEach((row, index) => {
    const manager = field(row, 'GESTOR')
    const region = field(row, 'REGIONAL')
    const collaborator = field(row, 'COLABORADOR')
    const client = field(row, 'CLIENTE', 'CLIENTE SGPA')
    const farm = field(row, 'FAZENDA', 'UNIDADE SGPA')
    const city = field(row, 'CIDADE')
    const hasUnit = Boolean(client || farm)
    if (!collaborator && !hasUnit) return

    const projectKey = hasUnit
      ? makeId([collaborator, client, farm, city], index + 1)
      : makeId([collaborator, '__sem-unidade__', manager, region], index + 1)
    const services = Object.fromEntries(
      SERVICE_FIELDS.map(({ key, aliases }) => {
        const value = field(row, ...aliases)
        return [key, value ? (isAffirmative(value) ? 'Sim' : value) : 'Não informado']
      }),
    )
    const project: Project = {
      id: projectKey,
      hasUnit,
      manager: manager || 'Não informado',
      region: region || 'Não informado',
      collaborator: collaborator || 'Sem colaborador informado',
      baseCoord: parseCoordinate(field(row, 'LAT LONG - BASE')),
      client: client || 'Cliente não informado',
      farm: farm || 'Fazenda/unidade não informada',
      farmCoord: parseCoordinate(field(row, 'LAT LONG - FAZ')),
      city: city || 'Cidade não informada',
      areaHa: numberFromCell(field(row, 'ÁREA (ha)', 'ÁREA', 'AREA (ha)', 'AREA')),
      recordedDistanceKm: numberFromCell(field(row, 'Distância (km)', 'DISTÂNCIA', 'DISTANCIA (KM)')),
      radiusKm: numberFromCell(field(row, 'Raio de Atuação (km)', 'RAIO DE ATUAÇÃO', 'RAIO DE ATUACAO (KM)')),
      services,
    }

    const previous = unique.get(projectKey)
    if (!previous) {
      unique.set(projectKey, project)
      return
    }
    if (!previous.baseCoord && project.baseCoord) previous.baseCoord = project.baseCoord
    if (!previous.farmCoord && project.farmCoord) previous.farmCoord = project.farmCoord
    if (previous.areaHa === null) previous.areaHa = project.areaHa
    if (previous.recordedDistanceKm === null) previous.recordedDistanceKm = project.recordedDistanceKm
    if (previous.radiusKm === null) previous.radiusKm = project.radiusKm
    for (const [service, value] of Object.entries(project.services)) {
      if (previous.services[service] === 'Não informado' && value !== 'Não informado') {
        previous.services[service] = value
      }
    }
  })

  return [...unique.values()]
}

export async function fetchProjects(signal?: AbortSignal): Promise<{ projects: Project[]; sourceRows: number; updatedAt: Date }> {
  const response = await fetch(PUBLIC_SHEET_CSV_URL, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(`Google Planilhas respondeu com HTTP ${response.status}.`)
  const csv = await response.text()
  if (csv.trimStart().startsWith('<!DOCTYPE') || csv.includes('Sign in to continue')) {
    throw new Error('A fonte de dados não está pública para leitura. Verifique o compartilhamento de PAINEL_PUBLICO.')
  }
  if (csv.includes('#ERROR!') || csv.includes('#REF!')) {
    throw new Error('A planilha pública ainda não consegue sincronizar a base. Verifique a fórmula PAINEL_PUBLICO.')
  }
  const projects = parseProjects(csv)
  return { projects, sourceRows: projects.length, updatedAt: new Date() }
}

export function affirmativeServices(services: Record<string, string>): string[] {
  return Object.entries(services)
    .filter(([, value]) => isAffirmative(value))
    .map(([name]) => name)
}
