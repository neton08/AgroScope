import { googleFetchJson } from '../lib/googleDrive'

export interface PrivateProject {
  key: string
  manager: string
  region: string
  collaborator: string
  client: string
  farm: string
  city: string
  areaHa: number | null
  distanceKm: number | null
  radiusKm: number | null
  status: string
  contractEnd: Date | null
  contractTerm: string
  contractValue: number | null
  arr: number | null
  charge: string
  termination: boolean
  services: Record<string, string>
}

export interface PrivateContact {
  vertical: string
  client: string
  name: string
  role: string
  email: string
  phone: string
}

export interface PrivateWorkbook {
  title: string
  projects: PrivateProject[]
  contacts: PrivateContact[]
  contactsAvailable: boolean
  warnings: string[]
  loadedAt: Date
}

interface SpreadsheetMetadata {
  properties?: { title?: string }
  sheets?: Array<{ properties?: { title?: string } }>
}

interface ValuesResponse {
  valueRanges?: Array<{ values?: unknown[][] }>
}

interface FieldColumn {
  header: string
  index: number
}

const PROJECT_FIELDS = [
  ['GESTOR'],
  ['REGIONAL'],
  ['COLABORADOR'],
  ['CLIENTE'],
  ['FAZENDA'],
  ['CIDADE'],
  ['POSSUI PONTO FOCAL DE CAMPO? SIM/NÃO'],
  ['STATUS'],
  ['DATA VENCI. CONTRATO', 'DATA VENCIMENTO CONTRATO'],
  ['ARR'],
  ['VALOR TOTAL DO CONTRATO', 'VALOR TOTAL CONTRATO'],
  ['TEMPO DE CONTRATO'],
  ['ÁREA (ha)', 'AREA (ha)', 'ÁREA', 'AREA'],
  ['Distância (km)', 'DISTÂNCIA', 'DISTANCIA (KM)'],
  ['Raio de Atuação (km)', 'RAIO DE ATUAÇÃO', 'RAIO DE ATUACAO (KM)'],
  ['CB'],
  ['COMBOIO'],
  ['ESTAÇÃO'],
  ['PLUVIOMETRO', 'PLUVIÔMETRO'],
  ['SOLINFNET'],
  ['CDA'],
  ['CDG'],
  ['COBRANÇA DE SERVIÇO'],
  ['4G'],
  ['EM PROCESSO DE DISTRATO'],
]

// A coluna B contém ID técnico e é intencionalmente excluída.
const CONTACT_FIELDS = [
  ['VERTICAL'],
  ['CLIENTE'],
  ['NOME'],
  ['CARGO'],
  ['E-MAIL', 'EMAIL'],
  ['TELEFONE'],
]

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`
}

function asText(value: unknown): string {
  return String(value ?? '').trim()
}

function columnLabel(index: number): string {
  let value = index + 1
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

function selectColumns(headers: unknown[], groups: string[][]): { columns: FieldColumn[]; missing: string[] } {
  const headerMap = new Map<string, FieldColumn>()
  headers.forEach((value, index) => {
    const header = asText(value)
    if (header) headerMap.set(normalize(header), { header, index })
  })

  const columns: FieldColumn[] = []
  const missing: string[] = []
  for (const aliases of groups) {
    const match = aliases.map((alias) => headerMap.get(normalize(alias))).find(Boolean)
    if (match) columns.push(match)
    else missing.push(aliases[0])
  }
  return { columns, missing }
}

async function getValueRanges(accessToken: string, spreadsheetId: string, ranges: string[]): Promise<Array<{ values?: unknown[][] }>> {
  if (!ranges.length) return []
  const query = new URLSearchParams()
  query.set('majorDimension', 'ROWS')
  query.set('valueRenderOption', 'FORMATTED_VALUE')
  ranges.forEach((range) => query.append('ranges', range))
  const encodedId = encodeURIComponent(spreadsheetId)
  const response = await googleFetchJson<ValuesResponse>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedId}/values:batchGet?${query.toString()}`,
    accessToken,
  )
  return response.valueRanges ?? []
}

function matrixFromColumns(columns: FieldColumn[], values: Array<{ values?: unknown[][] }>): unknown[][] {
  const columnValues = columns.map((_, index) => values[index]?.values ?? [])
  const rowCount = columnValues.reduce((largest, column) => Math.max(largest, column.length), 0)
  const rows: unknown[][] = [columns.map((column) => column.header)]
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    rows.push(columnValues.map((column) => column[rowIndex]?.[0] ?? ''))
  }
  return rows
}

function numberFromCell(value: unknown): number | null {
  const source = asText(value)
  if (!source) return null
  let number = source.replace(/[^\d,.-]/g, '')
  if (!number || !/\d/.test(number)) return null
  const comma = number.lastIndexOf(',')
  const dot = number.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    number = comma > dot ? number.replace(/\./g, '').replace(',', '.') : number.replace(/,/g, '')
  } else if (comma >= 0) {
    number = number.length - comma - 1 > 2 ? number.replace(/,/g, '') : number.replace(',', '.')
  } else if (dot >= 0 && number.length - dot - 1 === 3) {
    number = number.replace(/\./g, '')
  } else if ((number.match(/\./g) ?? []).length > 1) {
    number = number.replace(/\./g, '')
  }
  const parsed = Number(number)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  if (typeof value === 'number' && value > 1 && value < 100000) {
    const serialDate = new Date(new Date(1899, 11, 30).getTime() + value * 86_400_000)
    return Number.isNaN(serialDate.getTime()) ? null : new Date(serialDate.getFullYear(), serialDate.getMonth(), serialDate.getDate())
  }
  const source = asText(value)
  if (!source) return null
  const br = source.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const iso = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (/^\d+(\.\d+)?$/.test(source)) return parseDate(Number(source))
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function objectRows(rows: unknown[][]): Array<Record<string, string>> {
  if (rows.length < 2) return []
  const headers = rows[0].map((value) => asText(value))
  const keys = headers.map(normalize)
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}
    keys.forEach((key, index) => {
      if (key) record[key] = asText(row[index])
    })
    return record
  }).filter((record) => Object.values(record).some(Boolean))
}

function field(row: Record<string, string>, ...labels: string[]): string {
  for (const label of labels) {
    const value = row[normalize(label)]
    if (value) return value
  }
  return ''
}

function privateProjects(rows: unknown[][]): PrivateProject[] {
  return objectRows(rows).map((row, index) => {
    const collaborator = field(row, 'COLABORADOR') || 'Sem colaborador informado'
    const manager = field(row, 'GESTOR') || 'Não informado'
    const region = field(row, 'REGIONAL') || 'Não informada'
    const client = field(row, 'CLIENTE') || 'Cliente não informado'
    const farm = field(row, 'FAZENDA') || 'Fazenda/unidade não informada'
    const city = field(row, 'CIDADE') || 'Cidade não informada'
    const status = field(row, 'STATUS') || 'Não informado'
    const terminationValue = field(row, 'EM PROCESSO DE DISTRATO')
    const services = {
      'Ponto focal': field(row, 'POSSUI PONTO FOCAL DE CAMPO? SIM/NÃO'),
      CB: field(row, 'CB'),
      Comboio: field(row, 'COMBOIO'),
      Estação: field(row, 'ESTAÇÃO'),
      Pluviômetro: field(row, 'PLUVIOMETRO', 'PLUVIÔMETRO'),
      Solinfnet: field(row, 'SOLINFNET'),
      CDA: field(row, 'CDA'),
      CDG: field(row, 'CDG'),
      '4G': field(row, '4G'),
      'Cobrança de serviço': field(row, 'COBRANÇA DE SERVIÇO'),
    }
    return {
      key: [collaborator, client, farm, city, String(index)].join('|'),
      manager,
      region,
      collaborator,
      client,
      farm,
      city,
      areaHa: numberFromCell(field(row, 'ÁREA (ha)', 'AREA (ha)', 'ÁREA', 'AREA')),
      distanceKm: numberFromCell(field(row, 'Distância (km)', 'DISTÂNCIA', 'DISTANCIA (KM)')),
      radiusKm: numberFromCell(field(row, 'Raio de Atuação (km)', 'RAIO DE ATUAÇÃO', 'RAIO DE ATUACAO (KM)')),
      status,
      contractEnd: parseDate(field(row, 'DATA VENCI. CONTRATO', 'DATA VENCIMENTO CONTRATO')),
      contractTerm: field(row, 'TEMPO DE CONTRATO'),
      contractValue: numberFromCell(field(row, 'VALOR TOTAL DO CONTRATO', 'VALOR TOTAL CONTRATO')),
      arr: numberFromCell(field(row, 'ARR')),
      charge: field(row, 'COBRANÇA DE SERVIÇO') || 'Não informado',
      termination: normalize(terminationValue).startsWith('S'),
      services,
    }
  }).filter((project) => project.collaborator !== 'Sem colaborador informado' || project.client !== 'Cliente não informado' || project.farm !== 'Fazenda/unidade não informada' || project.manager !== 'Não informado')
}

// Ao importar um XLSX local, limitar a leitura ao mesmo conjunto operacional permitido no painel.
export function parsePrivateProjectsFromRows(rows: unknown[][]): PrivateProject[] {
  if (rows.length < 2) return []
  const selection = selectColumns(rows[0] ?? [], PROJECT_FIELDS)
  if (!selection.columns.length) return []
  const safeRows: unknown[][] = [selection.columns.map((column) => column.header)]
  for (const row of rows.slice(1)) safeRows.push(selection.columns.map((column) => row[column.index] ?? ''))
  return privateProjects(safeRows)
}

function privateContacts(rows: unknown[][]): PrivateContact[] {
  return objectRows(rows).map((row) => ({
    vertical: field(row, 'VERTICAL'),
    client: field(row, 'CLIENTE'),
    name: field(row, 'NOME'),
    role: field(row, 'CARGO'),
    email: field(row, 'E-MAIL', 'EMAIL'),
    phone: field(row, 'TELEFONE'),
  })).filter((contact) => contact.name || contact.client || contact.email || contact.phone)
}

export async function loadPrivateWorkbook(accessToken: string, spreadsheetId: string): Promise<PrivateWorkbook> {
  const encodedId = encodeURIComponent(spreadsheetId)
  const meta = await googleFetchJson<SpreadsheetMetadata>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedId}?fields=properties.title,sheets.properties.title`,
    accessToken,
  )
  const sheetNames = (meta.sheets ?? []).map((sheet) => sheet.properties?.title ?? '')
  const projectSheet = sheetNames.find((name) => normalize(name) === 'PROJETOS')
  if (!projectSheet) throw new Error('A planilha precisa conter uma aba chamada “Projetos”.')
  const contactSheet = sheetNames.find((name) => normalize(name) === 'CONTATO CLIENTES PESQUISAS NPS')
  const headerRanges = [`${quoteSheetName(projectSheet)}!1:1`]
  if (contactSheet) headerRanges.push(`${quoteSheetName(contactSheet)}!1:1`)
  const headerValues = await getValueRanges(accessToken, spreadsheetId, headerRanges)
  const projectSelection = selectColumns(headerValues[0]?.values?.[0] ?? [], PROJECT_FIELDS)
  const contactSelection = contactSheet
    ? selectColumns(headerValues[1]?.values?.[0] ?? [], CONTACT_FIELDS)
    : { columns: [], missing: [] as string[] }
  if (!projectSelection.columns.length) throw new Error('Não encontrei os campos operacionais necessários na aba “Projetos”.')

  const projectRanges = projectSelection.columns.map((column) => {
    const label = columnLabel(column.index)
    return `${quoteSheetName(projectSheet)}!${label}2:${label}1000`
  })
  const contactRanges = contactSheet ? contactSelection.columns.map((column) => {
    const label = columnLabel(column.index)
    return `${quoteSheetName(contactSheet)}!${label}2:${label}1000`
  }) : []
  const dataValues = await getValueRanges(accessToken, spreadsheetId, [...projectRanges, ...contactRanges])
  const projectData = matrixFromColumns(projectSelection.columns, dataValues.slice(0, projectRanges.length))
  const contactData = matrixFromColumns(contactSelection.columns, dataValues.slice(projectRanges.length, projectRanges.length + contactRanges.length))
  const projects = privateProjects(projectData)
  if (!projects.length) throw new Error('A aba “Projetos” não contém registros para mostrar.')
  const contacts = contactSheet ? privateContacts(contactData) : []
  const warnings: string[] = []
  if (projectSelection.missing.length) warnings.push(`Campos operacionais não encontrados: ${projectSelection.missing.join(', ')}.`)
  if (!contactSheet) warnings.push('A aba “Contato Clientes Pesquisas NPS” não foi encontrada; a seção Contatos ficará vazia.')
  else if (contactSelection.missing.length) warnings.push(`Campos de contato não encontrados: ${contactSelection.missing.join(', ')}.`)
  return {
    title: meta.properties?.title || 'Base AgroScope',
    projects,
    contacts,
    contactsAvailable: Boolean(contactSheet),
    warnings,
    loadedAt: new Date(),
  }
}
