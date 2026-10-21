import type { PrivateProject } from './privateSheets'

export type ProjectFilters = {
  search: string
  clients: string[]
  units: string[]
  manager: string
  region: string
  status: string
  charge: string
  focal: string
  fourG: string
  termination: string
  contractRange: string
  dataIssue: string
}

export const EMPTY_PROJECT_FILTERS: ProjectFilters = {
  search: '',
  clients: [],
  units: [],
  manager: '',
  region: '',
  status: '',
  charge: '',
  focal: '',
  fourG: '',
  termination: '',
  contractRange: '',
  dataIssue: '',
}

export function normalized(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function privateNumber(value: unknown): number {
  const text = String(value ?? '').trim().replace(/[^\d,.-]/g, '')
  if (!text || !/\d/.test(text)) return 0
  let normalizedText = text
  const comma = text.lastIndexOf(',')
  const dot = text.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    normalizedText = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (comma >= 0) {
    normalizedText = text.length - comma - 1 > 2 ? text.replace(/,/g, '') : text.replace(',', '.')
  } else if (dot >= 0 && text.length - dot - 1 === 3) {
    normalizedText = text.replace(/\./g, '')
  } else if ((text.match(/\./g) ?? []).length > 1) {
    normalizedText = text.replace(/\./g, '')
  }
  const number = Number(normalizedText)
  return Number.isFinite(number) ? number : 0
}

export function yesNo(value: unknown): 'SIM' | 'NÃO' | '' {
  const valueKey = normalized(value)
  if (['sim', 's', 'yes', 'true', '1', 'ok'].includes(valueKey)) return 'SIM'
  if (['nao', 'n', 'no', 'false', '0'].includes(valueKey)) return 'NÃO'
  return ''
}

export function serviceCharge(value: unknown): 'SIM' | 'NÃO' | '' {
  const valueKey = normalized(value)
  if (valueKey === 'sim') return 'SIM'
  if (valueKey === 'nao') return 'NÃO'
  return ''
}

export function isPositive(value: unknown): boolean {
  const valueKey = normalized(value)
  if (!valueKey || ['nao', 'n', 'nao informado', 'nao aplicavel', '0', '-'].includes(valueKey)) return false
  const numeric = privateNumber(value)
  if (/\d/.test(String(value ?? ''))) return numeric > 0
  return ['sim', 's', 'yes', 'true', 'ok'].includes(valueKey) || Boolean(valueKey)
}

export function serviceNumber(project: PrivateProject, name: string): number {
  return privateNumber(project.services[name])
}

export function daysRemaining(date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}

export function remainingContractValue(project: PrivateProject): number {
  const days = daysRemaining(project.contractEnd)
  if (days === null || days <= 0 || project.arr === null) return 0
  return project.arr * (days / 365)
}

export function projectIsValid(project: PrivateProject): boolean {
  return Boolean(project.client || project.farm || project.manager || project.collaborator)
}

export function contractTone(project: PrivateProject): 'danger' | 'warning' | 'healthy' | 'neutral' {
  if (project.termination) return 'danger'
  const days = daysRemaining(project.contractEnd)
  if (days === null) return 'neutral'
  if (days < 0 || days <= 30) return 'danger'
  if (days <= 90) return 'warning'
  return 'healthy'
}

export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: fractionDigits }).format(value)
}

export function formatCurrency(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR').format(value) : 'Não informado'
}

export function remainingTimeLabel(value: Date | null): string {
  const days = daysRemaining(value)
  if (days === null) return '—'
  if (days < 0) return 'Vencido'
  if (days === 0) return 'Vence hoje'
  if (days > 365) {
    const years = Math.floor(days / 365)
    const months = Math.floor((days % 365) / 30)
    return `${years} ano${years === 1 ? '' : 's'}${months ? ` e ${months} mês${months === 1 ? '' : 'es'}` : ''}`
  }
  const months = Math.floor(days / 30)
  const rest = days % 30
  if (!months) return `${days} dia${days === 1 ? '' : 's'}`
  return `${months} mês${months === 1 ? '' : 'es'}${rest ? ` e ${rest} dia${rest === 1 ? '' : 's'}` : ''}`
}

export function filterProjects(projects: PrivateProject[], filters: ProjectFilters): PrivateProject[] {
  const search = normalized(filters.search)
  return projects.filter((project) => {
    if (!projectIsValid(project)) return false
    if (search && ![project.manager, project.region, project.collaborator, project.client, project.farm, project.city, project.status].some((value) => normalized(value).includes(search))) return false
    if (filters.clients.length && !filters.clients.includes(project.client)) return false
    if (filters.units.length && !filters.units.includes(project.farm)) return false
    if (filters.manager && project.manager !== filters.manager) return false
    if (filters.region && project.region !== filters.region) return false
    if (filters.status && normalized(project.status) !== normalized(filters.status)) return false
    if (filters.charge && serviceCharge(project.charge) !== filters.charge) return false
    if (filters.focal && (filters.focal === 'SIM' ? yesNo(project.services['Ponto focal']) !== 'SIM' : yesNo(project.services['Ponto focal']) === 'SIM')) return false
    if (filters.fourG && (filters.fourG === 'SIM' ? yesNo(project.services['4G']) !== 'SIM' : yesNo(project.services['4G']) === 'SIM')) return false
    if (filters.termination && (project.termination ? 'SIM' : 'NÃO') !== filters.termination) return false

    if (filters.contractRange) {
      const days = daysRemaining(project.contractEnd)
      if (filters.contractRange === 'missing' && days !== null) return false
      if (filters.contractRange === 'risk' && (days === null || days > 180)) return false
      if (filters.contractRange === 'critical' && !project.termination && (days === null || days > 180)) return false
      if (filters.contractRange === 'moderate' && (days === null || days <= 180 || days > 365)) return false
      if (filters.contractRange === 'expired' && (days === null || days >= 0)) return false
      if (filters.contractRange === 'healthy' && (days === null || days <= 365)) return false
      if (/^\d+$/.test(filters.contractRange) && (days === null || days < 0 || days > Number(filters.contractRange))) return false
    }

    if (filters.dataIssue === 'missing-service' && serviceCharge(project.charge)) return false
    if (filters.dataIssue === 'missing-arr' && (project.arr ?? 0) > 0) return false
    if (filters.dataIssue === 'missing-farm' && project.farm && project.farm !== '-' && project.farm !== 'Fazenda/unidade não informada') return false
    return true
  })
}

export interface ContractBucket {
  key: string
  label: string
  description: string
  count: number
  arr: number
  share: number
}

export interface ManagerSummary {
  name: string
  collaborators: string[]
  projects: number
  area: number
  arr: number
  km: number
  cb: number
  expiring90: number
  terminations: number
  charged: number
  uncharged: number
  chargePct: number
  efficiency: number
}

export interface CollaboratorSummary {
  name: string
  managers: string[]
  projects: number
  area: number
  km: number
  arr: number
  implementation: number
  otherStatus: number
  cb: number
  climate: number
}

export interface OverviewMetrics {
  projects: PrivateProject[]
  totalArea: number
  totalArr: number
  rawContractValue: number
  remainingValue: number
  totalCb: number
  totalStations: number
  totalRainGauges: number
  totalClimate: number
  totalKm: number
  cbsPerKm: number
  stationsPer3000Ha: number
  rainPer600Ha: number
  collaborators: number
  managers: number
  regions: number
  arrPerProject: number
  arrPerCollaborator: number
  expiring90Count: number
  overdueOrTerminationCount: number
  riskProjects: PrivateProject[]
  riskArr: number
  terminationProjects: PrivateProject[]
  implementationProjects: PrivateProject[]
  missingFocal: PrivateProject[]
  missing4G: PrivateProject[]
  focalCoverage: number
  fourGCoverage: number
  criticalCount: number
  statusCounts: Array<{ status: string; count: number }>
  buckets: ContractBucket[]
  managerSummary: ManagerSummary[]
  collaboratorSummary: CollaboratorSummary[]
}

export function summarizeManagers(projects: PrivateProject[]): ManagerSummary[] {
  const groups = new Map<string, ManagerSummary & { collaboratorSet: Set<string> }>()
  for (const project of projects.filter((item) => item.manager && item.manager !== 'Não informado')) {
    let group = groups.get(project.manager)
    if (!group) {
      group = {
        name: project.manager,
        collaborators: [],
        collaboratorSet: new Set<string>(),
        projects: 0,
        area: 0,
        arr: 0,
        km: 0,
        cb: 0,
        expiring90: 0,
        terminations: 0,
        charged: 0,
        uncharged: 0,
        chargePct: 0,
        efficiency: 0,
      }
      groups.set(project.manager, group)
    }
    group.projects += 1
    group.area += project.areaHa ?? 0
    group.arr += project.arr ?? 0
    group.km += project.distanceKm ?? 0
    group.cb += serviceNumber(project, 'CB')
    if (project.collaborator && project.collaborator !== 'Sem colaborador informado') group.collaboratorSet.add(project.collaborator)
    const days = daysRemaining(project.contractEnd)
    if (days !== null && days >= 0 && days <= 90) group.expiring90 += 1
    if (project.termination) group.terminations += 1
    const charge = serviceCharge(project.charge)
    if (charge === 'SIM') group.charged += 1
    if (charge === 'NÃO') group.uncharged += 1
  }
  return [...groups.values()].map(({ collaboratorSet, ...group }) => {
    group.collaborators = [...collaboratorSet].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    group.chargePct = group.charged + group.uncharged ? group.charged / (group.charged + group.uncharged) * 100 : 0
    group.efficiency = group.area / (group.km || 1)
    return group
  }).sort((a, b) => b.arr - a.arr)
}

export function summarizeCollaborators(projects: PrivateProject[], manager = ''): CollaboratorSummary[] {
  const groups = new Map<string, CollaboratorSummary & { managerSet: Set<string> }>()
  for (const project of projects.filter((item) => item.collaborator && item.collaborator !== 'Sem colaborador informado')) {
    if (manager && project.manager !== manager) continue
    let group = groups.get(project.collaborator)
    if (!group) {
      group = {
        name: project.collaborator,
        managers: [],
        managerSet: new Set<string>(),
        projects: 0,
        area: 0,
        km: 0,
        arr: 0,
        implementation: 0,
        otherStatus: 0,
        cb: 0,
        climate: 0,
      }
      groups.set(project.collaborator, group)
    }
    group.projects += 1
    group.area += project.areaHa ?? 0
    group.km += project.distanceKm ?? 0
    group.arr += project.arr ?? 0
    group.cb += serviceNumber(project, 'CB')
    group.climate += serviceNumber(project, 'Estação') + serviceNumber(project, 'Pluviômetro')
    group.managerSet.add(project.manager)
    if (normalized(project.status) === 'implantacao') group.implementation += 1
    else group.otherStatus += 1
  }
  return [...groups.values()].map(({ managerSet, ...group }) => {
    group.managers = [...managerSet].filter((value) => value && value !== 'Não informado').sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return group
  })
}

export function buildOverviewMetrics(allProjects: PrivateProject[]): OverviewMetrics {
  const projects = allProjects.filter(projectIsValid)
  const totalArea = projects.reduce((sum, project) => sum + (project.areaHa ?? 0), 0)
  const totalArr = projects.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const rawContractValue = projects.reduce((sum, project) => sum + (project.contractValue ?? 0), 0)
  const remainingValue = projects.reduce((sum, project) => sum + remainingContractValue(project), 0)
  const totalCb = projects.reduce((sum, project) => sum + serviceNumber(project, 'CB'), 0)
  const totalStations = projects.reduce((sum, project) => sum + serviceNumber(project, 'Estação'), 0)
  const totalRainGauges = projects.reduce((sum, project) => sum + serviceNumber(project, 'Pluviômetro'), 0)
  const totalClimate = totalStations + totalRainGauges
  const totalKm = projects.reduce((sum, project) => sum + (project.distanceKm ?? 0), 0)
  const collaborators = new Set(projects.map((project) => project.collaborator).filter((value) => value && value !== 'Sem colaborador informado')).size
  const managers = new Set(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado')).size
  const regions = new Set(projects.map((project) => project.region).filter((value) => value && value !== 'Não informada')).size
  const riskProjects = projects.filter((project) => {
    const days = daysRemaining(project.contractEnd)
    return days !== null && days <= 180
  })
  const terminationProjects = projects.filter((project) => project.termination)
  const expiring90Count = projects.filter((project) => {
    const days = daysRemaining(project.contractEnd)
    return days !== null && days >= 0 && days <= 90
  }).length
  const overdueOrTerminationCount = new Set(projects.filter((project) => {
    const days = daysRemaining(project.contractEnd)
    return project.termination || (days !== null && days < 0)
  }).map((project) => project.key)).size
  const implementationProjects = projects.filter((project) => normalized(project.status) === 'implantacao')
  const missingFocal = projects.filter((project) => yesNo(project.services['Ponto focal']) !== 'SIM')
  const fourGProjects = projects.filter((project) => yesNo(project.services['4G']) === 'SIM')
  const missing4G = projects.filter((project) => yesNo(project.services['4G']) !== 'SIM')
  const focalCoverage = projects.length ? (projects.length - missingFocal.length) / projects.length * 100 : 0
  const fourGCoverage = projects.length ? fourGProjects.length / projects.length * 100 : 0
  const riskArr = riskProjects.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const statuses = new Map<string, number>()
  for (const project of projects) statuses.set(project.status || 'Não informado', (statuses.get(project.status || 'Não informado') ?? 0) + 1)
  const statusCounts = [...statuses.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

  const bucketDefs = [
    { key: 'healthy', label: 'Saudável', description: 'Mais de 365 dias', include: (days: number) => days > 365 },
    { key: 'moderate', label: 'Atenção moderada', description: '181 a 365 dias', include: (days: number) => days > 180 && days <= 365 },
    { key: 'risk', label: 'Risco próximo', description: '0 a 180 dias', include: (days: number) => days >= 0 && days <= 180 },
    { key: 'expired', label: 'Crítico / vencido', description: 'Menos de 0 dias', include: (days: number) => days < 0 },
  ]
  const buckets = bucketDefs.map((bucket) => {
    const rows = projects.filter((project) => {
      const days = daysRemaining(project.contractEnd)
      return days !== null && bucket.include(days)
    })
    const arr = rows.reduce((sum, project) => sum + (project.arr ?? 0), 0)
    return { key: bucket.key, label: bucket.label, description: bucket.description, count: rows.length, arr, share: totalArr ? arr / totalArr * 100 : 0 }
  })

  return {
    projects,
    totalArea,
    totalArr,
    rawContractValue,
    remainingValue,
    totalCb,
    totalStations,
    totalRainGauges,
    totalClimate,
    totalKm,
    cbsPerKm: totalKm ? totalCb / totalKm : 0,
    stationsPer3000Ha: totalArea ? totalStations / (totalArea / 3000) : 0,
    rainPer600Ha: totalArea ? totalRainGauges / (totalArea / 600) : 0,
    collaborators,
    managers,
    regions,
    arrPerProject: projects.length ? totalArr / projects.length : 0,
    arrPerCollaborator: collaborators ? totalArr / collaborators : 0,
    expiring90Count,
    overdueOrTerminationCount,
    riskProjects,
    riskArr,
    terminationProjects,
    implementationProjects,
    missingFocal,
    missing4G,
    focalCoverage,
    fourGCoverage,
    criticalCount: new Set([...riskProjects, ...terminationProjects].map((project) => project.key)).size,
    statusCounts,
    buckets,
    managerSummary: summarizeManagers(projects),
    collaboratorSummary: summarizeCollaborators(projects),
  }
}

export function formatRowForExport(project: PrivateProject): Record<string, string | number> {
  return {
    Gestor: project.manager,
    Regional: project.region,
    Colaborador: project.collaborator,
    Cliente: project.client,
    'Fazenda/unidade': project.farm,
    Cidade: project.city,
    'Área (ha)': project.areaHa ?? '',
    'Distância (km)': project.distanceKm ?? '',
    'Raio de atuação (km)': project.radiusKm ?? '',
    Status: project.status,
    'Data de vencimento': formatDate(project.contractEnd),
    'Tempo restante': remainingTimeLabel(project.contractEnd),
    'Valor total informado': project.contractValue ?? '',
    'Valor contratual remanescente': remainingContractValue(project),
    ARR: project.arr ?? '',
    CB: project.services.CB ?? '',
    Comboio: project.services.Comboio ?? '',
    Estação: project.services['Estação'] ?? '',
    Pluviômetro: project.services['Pluviômetro'] ?? '',
    Solinfnet: project.services.Solinfnet ?? '',
    CDA: project.services.CDA ?? '',
    CDG: project.services.CDG ?? '',
    'Ponto focal de campo': project.services['Ponto focal'] ?? '',
    '4G': project.services['4G'] ?? '',
    'Cobrança de serviço': project.charge,
    'Em processo de distrato': project.termination ? 'Sim' : 'Não',
  }
}
