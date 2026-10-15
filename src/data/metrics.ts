import type { DashboardStats, Employee, Project } from './types'
import { colorForEmployee, normalizeKey } from '../lib/format'

export function buildEmployees(projects: Project[]): Employee[] {
  const groups = new Map<string, Employee>()
  for (const project of projects) {
    const key = normalizeKey(project.collaborator)
    const current = groups.get(key)
    if (current) {
      if (project.hasUnit) current.projects.push(project)
      if (!current.baseCoord && project.baseCoord) current.baseCoord = project.baseCoord
      if (current.manager === 'Não informado' && project.manager !== 'Não informado') current.manager = project.manager
      if (current.region === 'Não informado' && project.region !== 'Não informado') current.region = project.region
      continue
    }
    groups.set(key, {
      id: key,
      name: project.collaborator,
      manager: project.manager,
      region: project.region,
      baseCoord: project.baseCoord,
      projects: project.hasUnit ? [project] : [],
      color: colorForEmployee(project.collaborator),
    })
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function calculateStats(projects: Project[]): DashboardStats {
  const units = projects.filter((project) => project.hasUnit)
  const employees = new Set(
    projects
      .map((project) => project.collaborator)
      .filter((name) => name && name !== 'Sem colaborador informado' && name !== 'Não informado')
      .map(normalizeKey),
  )
  const areaHa = units.reduce((total, project) => total + (project.areaHa ?? 0), 0)
  const distances = units
    .map((project) => project.recordedDistanceKm)
    .filter((distance): distance is number => distance !== null && Number.isFinite(distance) && distance >= 0)
  const averageDistanceKm = distances.length
    ? distances.reduce((total, distance) => total + distance, 0) / distances.length
    : null

  return {
    unitCount: units.length,
    employeeCount: employees.size,
    areaHa,
    averageDistanceKm,
    missingFarmCoordinates: units.filter((project) => !project.farmCoord).length,
    totalProjects: units.length,
  }
}

export function uniqueValues(projects: Project[], key: 'manager' | 'region' | 'collaborator'): string[] {
  return [...new Set(projects.map((project) => project[key]).filter((value) =>
    value && value !== 'Não informado' && value !== 'Sem colaborador informado',
  ))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
