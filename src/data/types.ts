export interface Coordinate {
  lat: number
  lon: number
}

export interface Project {
  id: string
  hasUnit: boolean
  manager: string
  region: string
  collaborator: string
  baseCoord: Coordinate | null
  client: string
  farm: string
  farmCoord: Coordinate | null
  city: string
  areaHa: number | null
  recordedDistanceKm: number | null
  radiusKm: number | null
  services: Record<string, string>
}

export interface Employee {
  id: string
  name: string
  manager: string
  region: string
  baseCoord: Coordinate | null
  projects: Project[]
  color: string
}

export interface RouteInfo {
  path: Coordinate[]
  distanceKm: number
  durationSeconds: number
  destination: Coordinate
  destinationLabel: string
  destinationSource: 'fazenda' | 'cidade aproximada'
  originLabel: string
}

export interface DashboardStats {
  unitCount: number
  employeeCount: number
  areaHa: number
  averageDistanceKm: number | null
  missingFarmCoordinates: number
  totalProjects: number
}
