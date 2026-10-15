import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, RefreshCw, Sprout } from 'lucide-react'
import FiltersBar, { type VisibilityOptions } from './components/FiltersBar'
import StatsBar from './components/StatsBar'
import TeamList from './components/TeamList'
import DetailPanel from './components/DetailPanel'
import MapView from './components/MapView'
import { fetchProjects } from './data/sheets'
import type { Project, RouteInfo } from './data/types'
import { buildEmployees, calculateStats, uniqueValues } from './data/metrics'
import { calculateRoute, reverseGeocodeBase } from './lib/routes'
import { formatNumber, normalizeKey } from './lib/format'

const PUBLIC_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1T5th-xWhvAq-2Kc8eO9JNLRskZdsWhL88fXUzd5DAx0/edit'

function dateLabel(value: Date | null): string {
  if (!value) return 'aguardando dados'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(value)
}

function Header({ lastUpdated, refreshing, onRefresh }: { lastUpdated: Date | null; refreshing: boolean; onRefresh: () => void }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" role="presentation">
            <path d="M20 3.8C11.8 3.8 5.2 10.4 5.2 18.6 5.2 29.4 20 38 20 38s14.8-8.6 14.8-19.4C34.8 10.4 28.2 3.8 20 3.8Z" fill="currentColor" />
            <circle cx="20" cy="18" r="5.4" fill="#f5f7f4" />
            <path d="M10 13h5m10 13h5M11 27h6" stroke="#d7e8df" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="10" cy="13" r="1.6" fill="#d2a15e" /><circle cx="30" cy="26" r="1.6" fill="#d2a15e" />
          </svg>
        </div>
        <div className="brand-name-block">
          <strong>AgroScope</strong>
          <span>VISÃO TERRITORIAL · BRASIL</span>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="sync-status"><span className="sync-dot" /> Consulta {dateLabel(lastUpdated)}</span>
        <button type="button" className="refresh-button" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Atualizando' : 'Atualizar dados'}</span>
        </button>
        <a className="sheet-link" href={PUBLIC_SHEET_URL} target="_blank" rel="noreferrer" title="Planilha derivada pública, somente leitura">
          <span>Dados públicos</span> <ExternalLink size={12} />
        </a>
      </div>
    </header>
  )
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [manager, setManager] = useState('')
  const [region, setRegion] = useState('')
  const [collaborator, setCollaborator] = useState('')
  const [query, setQuery] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [routeForId, setRouteForId] = useState<string | null>(null)
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [routeError, setRouteError] = useState('')
  const routeRequestToken = useRef(0)
  const [baseLocality, setBaseLocality] = useState<{ employeeId: string; label: string | null; loading: boolean; error: string | null } | null>(null)
  const baseLocalityToken = useRef(0)
  const [visibility, setVisibility] = useState<VisibilityOptions>({ team: true, farms: true, routes: true, areas: false })

  useEffect(() => {
    let active = true
    let controller = new AbortController()
    const load = async () => {
      setRefreshing(true)
      if (!projects.length) setLoading(true)
      try {
        const result = await fetchProjects(controller.signal)
        if (!active) return
        setProjects(result.projects)
        setLastUpdated(result.updatedAt)
        setLoadError('')
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar a planilha pública.')
      } finally {
        if (active) {
          setRefreshing(false)
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
    // Enquanto não há acionador de origem, a atualização é manual; filtros nunca recarregam dados.
  }, [refreshVersion])

  const allEmployees = useMemo(() => buildEmployees(projects), [projects])
  const filteredProjects = useMemo(() => {
    const queryKey = normalizeKey(query)
    return projects.filter((project) => {
      if (manager && project.manager !== manager) return false
      if (region && project.region !== region) return false
      if (collaborator && project.collaborator !== collaborator) return false
      if (!queryKey) return true
      return [project.collaborator, project.manager, project.region, project.client, project.farm, project.city]
        .some((value) => normalizeKey(value).includes(queryKey))
    })
  }, [collaborator, manager, projects, query, region])
  const filteredEmployees = useMemo(() => buildEmployees(filteredProjects), [filteredProjects])
  const selectedEmployee = filteredEmployees.find((person) => person.id === selectedEmployeeId) ?? null
  const unitProjects = useMemo(() => filteredProjects.filter((project) => project.hasUnit), [filteredProjects])
  const selectedProject = unitProjects.find((project) => project.id === selectedProjectId) ?? (selectedEmployee?.projects[0] ?? null)
  const visibleRoute = routeForId === selectedProject?.id ? route : null
  const stats = useMemo(() => calculateStats(filteredProjects), [filteredProjects])
  const managers = useMemo(() => uniqueValues(projects, 'manager'), [projects])
  const regions = useMemo(() => uniqueValues(projects, 'region'), [projects])
  const collaborators = useMemo(() => uniqueValues(projects, 'collaborator'), [projects])

  useEffect(() => {
    const token = ++baseLocalityToken.current
    if (!selectedEmployee) {
      setBaseLocality(null)
      return
    }
    const employeeId = selectedEmployee.id
    const coordinate = selectedEmployee.baseCoord
    if (!coordinate) {
      setBaseLocality({ employeeId, label: null, loading: false, error: null })
      return
    }
    setBaseLocality({ employeeId, label: null, loading: true, error: null })
    void reverseGeocodeBase(coordinate)
      .then((label) => {
        if (baseLocalityToken.current !== token) return
        setBaseLocality({ employeeId, label, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (baseLocalityToken.current !== token) return
        setBaseLocality({
          employeeId,
          label: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Não foi possível consultar o serviço de geocodificação.',
        })
      })
    return () => {
      if (baseLocalityToken.current === token) baseLocalityToken.current += 1
    }
  }, [selectedEmployee?.id, selectedEmployee?.baseCoord?.lat, selectedEmployee?.baseCoord?.lon])

  const runRoute = useCallback(async (project: Project) => {
    const token = ++routeRequestToken.current
    setRoute(null)
    setRouteForId(project.id)
    setRouteError('')
    setRouteStatus('loading')
    try {
      const result = await calculateRoute(project)
      if (routeRequestToken.current !== token) return
      setRoute(result)
      setRouteStatus('success')
    } catch (error) {
      if (routeRequestToken.current !== token) return
      setRoute(null)
      setRouteError(error instanceof Error ? error.message : 'Não foi possível calcular esta rota.')
      setRouteStatus('error')
    }
  }, [])

  const selectEmployee = useCallback((employeeId: string) => {
    const employee = filteredEmployees.find((person) => person.id === employeeId)
    setSelectedEmployeeId(employeeId)
    const firstProject = employee?.projects[0] ?? null
    setSelectedProjectId(firstProject?.id ?? null)
    setVisibility((current) => ({ ...current, areas: true }))
    if (firstProject) {
      void runRoute({ ...firstProject, baseCoord: firstProject.baseCoord ?? employee?.baseCoord ?? null })
    }
    else {
      routeRequestToken.current += 1
      setRoute(null)
      setRouteForId(null)
      setRouteError('')
      setRouteStatus('idle')
    }
  }, [filteredEmployees, runRoute])

  const selectProject = useCallback((projectId: string) => {
    const project = filteredProjects.find((item) => item.id === projectId)
    if (!project) return
    const employee = filteredEmployees.find((person) => person.name === project.collaborator)
    setSelectedProjectId(projectId)
    setSelectedEmployeeId(employee?.id ?? null)
    setVisibility((current) => ({ ...current, areas: true }))
    void runRoute({ ...project, baseCoord: project.baseCoord ?? employee?.baseCoord ?? null })
  }, [filteredEmployees, filteredProjects, runRoute])

  const selectCollaboratorFilter = (value: string) => {
    setCollaborator(value)
    if (!value) {
      setSelectedEmployeeId(null)
      setSelectedProjectId(null)
      setRoute(null)
      setRouteForId(null)
      setRouteError('')
      setRouteStatus('idle')
      setVisibility((current) => ({ ...current, areas: false }))
      return
    }
    const employee = allEmployees.find((person) => person.name === value)
    if (employee) {
      setSelectedEmployeeId(employee.id)
      const project = employee.projects[0]
      setSelectedProjectId(project?.id ?? null)
      setVisibility((current) => ({ ...current, areas: true }))
      if (project) void runRoute({ ...project, baseCoord: project.baseCoord ?? employee.baseCoord ?? null })
      else {
        routeRequestToken.current += 1
        setRoute(null)
        setRouteForId(null)
        setRouteError('')
        setRouteStatus('idle')
      }
    }
  }

  const resetFilters = () => {
    setManager('')
    setRegion('')
    setCollaborator('')
    setQuery('')
    setSelectedEmployeeId(null)
    setSelectedProjectId(null)
    setRoute(null)
    setRouteForId(null)
    setRouteStatus('idle')
    setRouteError('')
    routeRequestToken.current += 1
    setVisibility({ team: true, farms: true, routes: true, areas: false })
  }

  const refresh = () => setRefreshVersion((value) => value + 1)
  const closeDetail = () => {
    setSelectedEmployeeId(null)
    setSelectedProjectId(null)
    setRoute(null)
    setRouteForId(null)
    setRouteStatus('idle')
    setRouteError('')
    routeRequestToken.current += 1
    setVisibility((current) => ({ ...current, areas: false }))
  }

  return (
    <div className="app-shell">
      <Header lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} />
      <FiltersBar
        managers={managers}
        regions={regions}
        collaborators={collaborators}
        manager={manager}
        region={region}
        collaborator={collaborator}
        query={query}
        visibility={visibility}
        onManagerChange={setManager}
        onRegionChange={setRegion}
        onCollaboratorChange={selectCollaboratorFilter}
        onQueryChange={setQuery}
        onVisibilityChange={setVisibility}
        onReset={resetFilters}
      />
      {loadError && (
        <div className="source-alert" role="alert">
          <AlertCircle size={17} />
          <span><strong>Não foi possível atualizar a fonte.</strong> {loadError}</span>
          <button type="button" onClick={refresh}>Tentar novamente <ExternalLink size={13} /></button>
        </div>
      )}
      <StatsBar stats={stats} />
      <main className="workspace">
        <TeamList
          employees={filteredEmployees}
          selectedEmployeeId={selectedEmployeeId}
          selectedProjectId={selectedProject?.id ?? null}
          onSelectEmployee={selectEmployee}
          onSelectProject={selectProject}
        />
        <section className="map-column" aria-label="Mapa de atendimento">
          <div className="map-heading">
            <div><span className="eyebrow">OPERAÇÃO NO TERRITÓRIO</span><h1>Equipe no território, em um só mapa.</h1></div>
            <div className="map-heading-right"><span className="map-record-count"><Sprout size={14} /> {formatNumber(stats.totalProjects)} unidades atendidas</span></div>
          </div>
          {loading && <div className="map-loading-overlay"><span className="spinner" /> Carregando planilha…</div>}
          <MapView
            employees={filteredEmployees}
            projects={unitProjects}
            selectedEmployeeId={selectedEmployeeId}
            selectedProjectId={selectedProject?.id ?? null}
            route={visibleRoute}
            showTeam={visibility.team}
            showFarms={visibility.farms}
            showRoutes={visibility.routes}
            showAreas={visibility.areas}
            onSelectEmployee={selectEmployee}
            onSelectProject={selectProject}
          />
          <div className="map-bottom-note"><span className="quality-dot quality-exact" /> Coordenada exata <span className="quality-dot quality-approx" /> Localidade aproximada <span className="map-note-separator">·</span> Trajetos sob consulta</div>
        </section>
        <DetailPanel
          employee={selectedEmployee}
          project={selectedProject}
          baseLocality={baseLocality && selectedEmployee && baseLocality.employeeId === selectedEmployee.id ? baseLocality.label : null}
          baseLocalityLoading={Boolean(baseLocality && selectedEmployee && baseLocality.employeeId === selectedEmployee.id && baseLocality.loading)}
          baseLocalityError={baseLocality && baseLocality.employeeId === selectedEmployee?.id ? baseLocality.error : null}
          route={visibleRoute}
          routeStatus={routeStatus}
          routeError={routeError}
          onCalculateRoute={() => selectedProject && void runRoute({ ...selectedProject, baseCoord: selectedProject.baseCoord ?? selectedEmployee?.baseCoord ?? null })}
          onClose={closeDetail}
        />
      </main>
      <footer className="app-footer">
        <span><span className="footer-dot" /> Planilha pública curada conectada</span>
        <span>Snapshot público · {formatNumber(stats.totalProjects)} unidades · {formatNumber(stats.employeeCount)} colaboradores · atualizar manualmente</span>
        <a href={PUBLIC_SHEET_URL} target="_blank" rel="noreferrer">PAINEL_PUBLICO <ExternalLink size={11} /></a>
      </footer>
      <div className="sr-only" aria-live="polite">{routeStatus === 'loading' ? 'Calculando rota e tempo estimado.' : routeStatus === 'success' ? 'Rota estimada calculada.' : ''}</div>
    </div>
  )
}
