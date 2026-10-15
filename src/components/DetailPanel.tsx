import { ArrowDown, ArrowUpRight, Building2, Clock3, Compass, MapPin, Navigation, Route, Ruler, Sprout, Tractor } from 'lucide-react'
import type { Employee, Project, RouteInfo } from '../data/types'
import { formatArea, formatCoordinates, formatDistance, formatDuration, formatNumber } from '../lib/format'

interface DetailPanelProps {
  employee: Employee | null
  project: Project | null
  baseLocality: string | null
  baseLocalityLoading: boolean | null
  baseLocalityError: string | null
  route: RouteInfo | null
  routeStatus: 'idle' | 'loading' | 'success' | 'error'
  routeError: string
  onCalculateRoute: () => void
  onClose: () => void
}

const serviceLabels: Record<string, string> = {
  'PONTO FOCAL DE CAMPO': 'Ponto focal de campo',
  CB: 'CB',
  COMBOIO: 'Comboio',
  'ESTAÇÃO': 'Estação',
  PLUVIOMETRO: 'Pluviômetro',
  SOLINFNET: 'Solinfnet',
  CDA: 'CDA',
  CDG: 'CDG',
  '4G': '4G',
}

export default function DetailPanel({
  employee,
  project,
  baseLocality,
  baseLocalityLoading,
  baseLocalityError,
  route,
  routeStatus,
  routeError,
  onCalculateRoute,
  onClose,
}: DetailPanelProps) {
  if (!employee) {
    return (
      <aside className="detail-panel detail-empty" aria-label="Detalhes do atendimento">
        <div className="empty-detail-mark"><Navigation size={23} /></div>
        <span className="eyebrow">DETALHES DO ATENDIMENTO</span>
        <h2>Selecione um colaborador</h2>
        <p>Escolha uma pessoa ou unidade na lista para consultar a base, a cobertura e o deslocamento até o projeto.</p>
        <div className="empty-tip"><MapPin size={14} /> Clique em um ponto do mapa para abrir o atendimento.</div>
      </aside>
    )
  }

  const baseText = employee.baseCoord
    ? formatCoordinates(employee.baseCoord.lat, employee.baseCoord.lon)
    : 'Coordenada da base não informada'
  const farmText = !project
    ? 'Nenhuma fazenda/unidade vinculada a este colaborador'
    : project.farmCoord
      ? formatCoordinates(project.farmCoord.lat, project.farmCoord.lon)
      : 'Sem coordenada exata · cidade usada somente se identificada com segurança'
  const localityText = baseLocalityLoading
    ? 'Consultando município pela coordenada…'
    : baseLocality
      ? `${baseLocality} · aproximado pela coordenada da base`
      : baseLocalityError
        ? 'Falha ao consultar o município-base pelo serviço geográfico.'
        : !employee.baseCoord
          ? 'Coordenada da base não informada; município não consultado.'
          : employee.region !== 'Não informado'
            ? `Município não confirmado · regional ${employee.region}`
            : 'Município-base não confirmado'

  return (
    <aside className="detail-panel" aria-label="Detalhes do atendimento">
      <div className="detail-topline">
        <span className="eyebrow">FICHA DE ATENDIMENTO</span>
        <button type="button" className="icon-button close-detail" onClick={onClose} aria-label="Fechar detalhes">×</button>
      </div>
      <div className="detail-employee">
        <span className="employee-avatar detail-avatar" style={{ background: employee.color }}>{employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
        <div>
          <h2>{employee.name}</h2>
          <p>{employee.region} <span>·</span> Gestor: {employee.manager}</p>
        </div>
      </div>

      <div className="detail-project-title">
        <div className="detail-project-icon"><Sprout size={18} /></div>
        <div>
          <span className="eyebrow">PROJETO / UNIDADE</span>
          <h3>{project?.farm ?? 'Sem unidade vinculada'}</h3>
          <p>{project ? `${project.client} · ${project.city}` : 'A planilha não registra uma fazenda/unidade para este colaborador.'}</p>
        </div>
      </div>

      <div className="detail-metric-pair">
        <div className="detail-mini-metric"><span>Unidades atendidas</span><strong>{formatNumber(employee.projects.length)}</strong></div>
        <div className="detail-mini-metric"><span>Área informada</span><strong>{formatArea(project?.areaHa ?? null)}</strong></div>
      </div>

      {project ? (
        <section className="route-card">
          <div className="route-card-head">
            <span className="route-icon"><Route size={16} /></span>
            <div><strong>Deslocamento da base</strong><small>Estimativa rodoviária · sem tráfego ao vivo</small></div>
          </div>
          {routeStatus === 'loading' ? (
            <div className="route-loading"><span className="spinner" /> Consultando rota e tempo...</div>
          ) : route ? (
            <>
              <div className="route-result-grid">
                <div><span>Distância rodoviária</span><strong>{formatDistance(route.distanceKm)}</strong></div>
                <div><span>Tempo estimado</span><strong>{formatDuration(route.durationSeconds)}</strong></div>
              </div>
              <div className="route-destination-note">
                <span className={`quality-dot ${route.destinationSource === 'fazenda' ? 'quality-exact' : 'quality-approx'}`} />
                {route.destinationSource === 'fazenda'
                  ? `Trajeto até a coordenada exata da fazenda (${route.destinationLabel}).`
                  : `Trajeto até ${route.destinationLabel}; não representa a sede da fazenda.`}
              </div>
              <div className="route-origin-destination"><span><MapPin size={12} /> Base</span><ArrowDown size={13} /><span><MapPin size={12} /> {route.destinationSource === 'fazenda' ? 'Fazenda' : 'Cidade'}</span></div>
            </>
          ) : (
            <div className="route-empty">{routeError || 'Calcule a rota para consultar o percurso, a distância rodoviária e o tempo estimado.'}</div>
          )}
          <button type="button" className="route-button" onClick={onCalculateRoute} disabled={routeStatus === 'loading' || !employee.baseCoord}>
            {routeStatus === 'loading' ? <><span className="spinner spinner-light" /> Calculando…</> : <><Navigation size={15} /> {route ? 'Atualizar rota' : 'Calcular rota até o projeto'}</>}
          </button>
          {!employee.baseCoord && <small className="route-warning">A rota não pode ser calculada sem as coordenadas da base.</small>}
          {routeStatus === 'error' && routeError && <div className="route-error" role="alert">{routeError}</div>}
        </section>
      ) : (
        <div className="empty-tip"><MapPin size={14} /> Sem unidade vinculada; não há destino para calcular uma rota.</div>
      )}

      <section className="location-section">
        <div className="section-heading"><MapPin size={15} /><h3>Localidades</h3></div>
        <div className="location-row"><span>Localidade da base</span><strong>{localityText}</strong></div>
        {baseLocalityError && <div className="route-error" role="alert">{baseLocalityError}</div>}
        <div className="location-row"><span>Regional cadastrada</span><strong>{employee.region}</strong></div>
        <div className="location-row"><span>Coordenada exata da base</span><strong>{baseText}</strong></div>
        <div className="location-row"><span>Fazenda / destino</span><strong>{farmText}</strong></div>
        {project && <div className="location-row"><span>Cidade atendida</span><strong>{project.city}</strong></div>}
        {project?.farmCoord && <div className="exact-tag">Coordenada da fazenda confirmada</div>}
      </section>

      {project && (
        <>
          <section className="distance-section">
            <div className="section-heading"><Compass size={15} /><h3>Dados registrados</h3></div>
            <div className="location-row"><span><Ruler size={12} /> Distância na planilha</span><strong>{formatDistance(project.recordedDistanceKm)}</strong></div>
            <div className="location-row"><span><ArrowUpRight size={12} /> Raio de atuação</span><strong>{formatDistance(project.radiusKm)}</strong></div>
            <div className="location-row"><span><Building2 size={12} /> Unidade identificada</span><strong>{project.farm}</strong></div>
            <div className="location-row"><span><Tractor size={12} /> Área</span><strong>{formatArea(project.areaHa)}</strong></div>
          </section>

          <section className="services-section">
            <div className="section-heading"><Clock3 size={15} /><h3>Indicadores de serviço</h3></div>
            <div className="service-chips">
              {Object.entries(project.services).map(([key, value]) => {
                const affirmative = value === 'Sim'
                return <span className={`service-chip ${affirmative ? 'service-yes' : 'service-no'}`} key={key} title={`${serviceLabels[key] ?? key}: ${value}`}>
                  <i />{serviceLabels[key] ?? key}<b>{affirmative ? 'Sim' : value === 'Não informado' ? '—' : value}</b>
                </span>
              })}
            </div>
          </section>
        </>
      )}
      <div className="detail-footnote">Distância e tempo de rota são estimativas calculadas pelo OpenRouteService. A distância cadastrada na planilha é exibida separadamente.</div>
    </aside>
  )
}
