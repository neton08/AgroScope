import { useMemo } from 'react'
import { Activity, AlertTriangle, ArrowRight, CalendarClock, ChartNoAxesCombined, CircleDollarSign, CloudSun, Gauge, MapPinned, Radio, Sprout, TowerControl, Users, Wifi } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { buildOverviewMetrics, daysRemaining, formatCurrency, formatNumber, normalized, remainingTimeLabel } from '../../data/privateAnalytics'
import type { ProjectFilters } from '../../data/privateAnalytics'
import { BarRow, CardHeading, EmptyState, Kpi, PageCard } from './shared'

export default function OverviewPage({ projects, onOpenProjects, onOpenTerminations }: {
  projects: PrivateProject[]
  onOpenProjects: (filters?: Partial<ProjectFilters>) => void
  onOpenTerminations: () => void
}) {
  const metrics = useMemo(() => buildOverviewMetrics(projects), [projects])
  const maxManager = Math.max(1, ...metrics.managerSummary.map((manager) => manager.arr))
  const areaRanking = [...metrics.collaboratorSummary].sort((a, b) => b.area - a.area).slice(0, 15)
  const cbRanking = [...metrics.collaboratorSummary].sort((a, b) => b.cb - a.cb).slice(0, 15)
  const maxArea = Math.max(1, ...areaRanking.map((row) => row.area))
  const maxKm = Math.max(1, ...areaRanking.map((row) => row.km))
  const maxCb = Math.max(1, ...cbRanking.map((row) => row.cb))
  const statusValue = (key: string) => metrics.statusCounts.find((item) => normalized(item.status) === key)?.status ?? ''
  const postSaleStatus = statusValue('pos-venda')
  const implementationStatus = statusValue('implantacao')
  const attention = useMemo(() => {
    const byDate = [...metrics.riskProjects].sort((a, b) => (daysRemaining(a.contractEnd) ?? 9999) - (daysRemaining(b.contractEnd) ?? 9999))
    const set = new Set<string>()
    return [...metrics.terminationProjects, ...byDate].filter((project) => {
      if (set.has(project.key)) return false
      set.add(project.key)
      return true
    }).slice(0, 10)
  }, [metrics.riskProjects, metrics.terminationProjects])
  const statuses = [
    { label: 'Pós-venda', count: metrics.projects.filter((project) => normalized(project.status) === 'pos-venda').length, filter: postSaleStatus },
    { label: 'Implantação', count: metrics.implementationProjects.length, filter: implementationStatus },
    { label: 'Em distrato', count: metrics.terminationProjects.length, filter: '' },
    { label: 'ARR em risco', count: metrics.riskProjects.length, filter: 'risk' },
  ]

  return (
    <div className="private-page-stack">
      <div className="private-shortcuts" aria-label="Atalhos da operação">
        <button type="button" className="private-button private-button-primary" onClick={() => onOpenProjects()}><Sprout size={15} /> Abrir carteira <ArrowRight size={14} /></button>
        <button type="button" className="private-button private-button-ghost" onClick={() => onOpenProjects(implementationStatus ? { status: implementationStatus } : {})}><Activity size={15} /> Ver implantações</button>
        <button type="button" className="private-button private-button-ghost" onClick={onOpenTerminations}><AlertTriangle size={15} /> Distratos <span className="private-count-pill">{formatNumber(metrics.terminationProjects.length)}</span></button>
      </div>

      <section className="private-kpis private-kpis-six" aria-label="Indicadores gerais">
        <Kpi label="ARR da carteira" value={formatCurrency(metrics.totalArr)} note="receita anual recorrente" icon={<CircleDollarSign size={18} />} />
        <Kpi label="Projetos ativos" value={formatNumber(metrics.projects.length)} note={`${formatNumber(metrics.collaborators)} colaboradores na carteira`} icon={<MapPinned size={18} />} />
        <Kpi label="ARR em risco" value={formatCurrency(metrics.riskArr)} note={`${formatNumber(metrics.riskProjects.length)} contratos até 180 dias ou vencidos`} icon={<CalendarClock size={18} />} alert={metrics.riskProjects.length > 0} onClick={() => onOpenProjects({ contractRange: 'risk' })} />
        <Kpi label="Área gerida" value={`${formatNumber(metrics.totalArea, 1)} ha`} note="soma da carteira" icon={<span className="private-kpi-letter">ha</span>} />
        <Kpi label="CBs em operação" value={formatNumber(metrics.totalCb)} note="capacidade monitorada" icon={<TowerControl size={18} />} />
        <Kpi label="Pendências críticas" value={formatNumber(metrics.criticalCount)} note="risco contratual ou distrato" icon={<AlertTriangle size={18} />} alert={metrics.criticalCount > 0} onClick={() => onOpenProjects({ contractRange: 'critical' })} />
      </section>

      <PageCard className="private-pulse-card">
        <CardHeading eyebrow="PULSO DA OPERAÇÃO" title="Composição da carteira" badge={`${formatNumber(metrics.projects.length)} registros`} />
        <div className="private-status-strip">
          {statuses.map((item, index) => (
            <button type="button" className={`private-status-tile tone-${index}`} key={item.label} onClick={() => item.label === 'Em distrato' ? onOpenTerminations() : item.filter === 'risk' ? onOpenProjects({ contractRange: 'risk' }) : item.filter ? onOpenProjects({ status: item.filter }) : onOpenProjects({ contractRange: 'risk' })}>
              <span>{item.label}</span><strong>{formatNumber(item.count)}</strong><i aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="private-status-list">
          {metrics.statusCounts.map(({ status, count }) => (
            <button type="button" className="private-status-row private-status-button" key={status} onClick={() => onOpenProjects({ status })}>
              <span title={status}>{status}</span><div className="private-bar-track"><i style={{ width: `${metrics.projects.length ? count / metrics.projects.length * 100 : 0}%` }} /></div><strong>{formatNumber(count)}</strong>
            </button>
          ))}
        </div>
      </PageCard>

      <section className="private-overview-grid">
        <PageCard className="private-attention-card">
          <CardHeading eyebrow="ACOMPANHAMENTO" title="Fila de atenção" badge={formatNumber(metrics.criticalCount)} action={<span className="private-tag">AÇÃO</span>} />
          <div className="private-alert-shortcuts">
            <button type="button" onClick={() => onOpenProjects({ contractRange: 'risk' })}><CalendarClock size={14} /> {formatNumber(metrics.riskProjects.length)} contratos em risco</button>
            <button type="button" onClick={onOpenTerminations}><AlertTriangle size={14} /> {formatNumber(metrics.terminationProjects.length)} em distrato</button>
            <button type="button" onClick={() => onOpenProjects(implementationStatus ? { status: implementationStatus } : {})}><Activity size={14} /> {formatNumber(metrics.implementationProjects.length)} implantações</button>
            <button type="button" onClick={() => onOpenProjects({ focal: 'NÃO' })}><Users size={14} /> {formatNumber(metrics.missingFocal.length)} sem ponto focal</button>
            <button type="button" onClick={() => onOpenProjects({ fourG: 'NÃO' })}><Wifi size={14} /> {formatNumber(metrics.missing4G.length)} sem 4G / não informado</button>
          </div>
          {attention.map((project) => {
            const days = daysRemaining(project.contractEnd)
            const tone = project.termination || (days !== null && days <= 30) ? 'danger' : 'warning'
            return (
              <button type="button" className="private-attention-row private-attention-button" key={project.key} onClick={() => project.termination ? onOpenTerminations() : onOpenProjects({ contractRange: 'risk' })}>
                <span className={`private-risk-dot ${tone}`} />
                <span className="private-attention-copy"><strong>{project.client} · {project.farm}</strong><small>{project.collaborator} · {project.manager}</small></span>
                <span className={`private-risk-label ${tone}`}>{project.termination ? 'Distrato' : remainingTimeLabel(project.contractEnd)}</span>
              </button>
            )
          })}
          {!attention.length && <EmptyState>Não há contratos em risco nem distratos na base.</EmptyState>}
          <button type="button" className="private-text-action" onClick={() => onOpenProjects({ contractRange: 'critical' })}>Abrir carteira de atenção <span>→</span></button>
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="COBERTURA" title="Indicadores de serviço" badge="%" />
          <div className="private-coverage-list">
            <button type="button" onClick={() => onOpenProjects({ focal: 'SIM' })}>
              <span><Users size={15} /> Ponto focal de campo</span><strong>{formatNumber(metrics.focalCoverage, 1)}%</strong>
              <div className="private-bar-track"><i style={{ width: `${Math.min(100, metrics.focalCoverage)}%` }} /></div><small>{formatNumber(metrics.projects.length - metrics.missingFocal.length)} de {formatNumber(metrics.projects.length)} projetos</small>
            </button>
            <button type="button" onClick={() => onOpenProjects({ fourG: 'SIM' })}>
              <span><Wifi size={15} /> Cobertura 4G</span><strong>{formatNumber(metrics.fourGCoverage, 1)}%</strong>
              <div className="private-bar-track"><i style={{ width: `${Math.min(100, metrics.fourGCoverage)}%` }} /></div><small>{formatNumber(metrics.projects.length - metrics.missing4G.length)} de {formatNumber(metrics.projects.length)} projetos</small>
            </button>
          </div>
          <div className="private-inline-kpis">
            <div><span>ARR médio/projeto</span><strong>{formatCurrency(metrics.arrPerProject)}</strong></div>
            <div><span>ARR médio/colaborador</span><strong>{formatCurrency(metrics.arrPerCollaborator)}</strong></div>
            <div><span>Colaboradores</span><strong>{formatNumber(metrics.collaborators)}</strong></div>
            <div><span>Regionais</span><strong>{formatNumber(metrics.regions)}</strong></div>
            <div><span>Valor total do contrato</span><strong>{formatCurrency(metrics.rawContractValue)}</strong></div>
            <div><span>Vencimentos em 90 dias</span><strong>{formatNumber(metrics.expiring90Count)}</strong></div>
            <div><span>Vencidos ou em distrato</span><strong>{formatNumber(metrics.overdueOrTerminationCount)}</strong></div>
          </div>
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="DESEMPENHO" title="ARR por gestor" badge="R$" />
          {metrics.managerSummary.slice(0, 8).map((manager) => <BarRow key={manager.name} label={manager.name} value={manager.arr} max={maxManager} valueLabel={formatCurrency(manager.arr)} />)}
          {!metrics.managerSummary.length && <EmptyState>Sem gestores identificados na planilha.</EmptyState>}
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="CONTRATOS" title="Régua contratual" badge="ARR" />
          <div className="private-contract-ruler">
            {metrics.buckets.map((bucket) => (
              <button type="button" key={bucket.key} className={`private-contract-bucket ${bucket.key === 'expired' ? 'is-danger' : ''}`} onClick={() => onOpenProjects({ contractRange: bucket.key })}>
                <span>{bucket.label}</span><strong>{formatNumber(bucket.count)}</strong><small>{bucket.description}</small><b>{formatCurrency(bucket.arr)}</b><i><em style={{ width: `${Math.min(100, bucket.share)}%` }} /></i><small>{formatNumber(bucket.share, 1)}% do ARR</small>
              </button>
            ))}
          </div>
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="PRODUTIVIDADE" title="Área × KM por colaborador" badge="TOP 15" />
          <div className="private-area-km-list">
            {areaRanking.map((person, index) => (
              <div className="private-area-km-row" key={person.name}>
                <span className="private-rank-number">{index + 1}</span><div className="private-area-km-name"><strong title={person.name}>{person.name}</strong><small>{formatNumber(person.area)} ha · {formatNumber(person.km)} km</small></div>
                <div className="private-area-km-bars"><div><span>Área</span><i><em style={{ width: `${person.area > 0 ? Math.max(3, person.area / maxArea * 100) : 0}%` }} /></i><b>{formatNumber(person.area)}</b></div><div><span>KM</span><i><em className="km" style={{ width: `${person.km > 0 ? Math.max(3, person.km / maxKm * 100) : 0}%` }} /></i><b>{formatNumber(person.km)}</b></div></div>
              </div>
            ))}
            {!areaRanking.length && <EmptyState>Sem colaboradores identificados.</EmptyState>}
          </div>
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="CAPACIDADE" title="CB por colaborador" badge="TOP 15" />
          {cbRanking.map((person) => <BarRow key={person.name} label={person.name} value={person.cb} max={maxCb} valueLabel={formatNumber(person.cb)} tone="is-orange" />)}
          {!cbRanking.length && <EmptyState>Sem dados de CB por colaborador.</EmptyState>}
        </PageCard>

        <PageCard>
          <CardHeading eyebrow="INDICADORES OPERACIONAIS" title="Eficiência e equipamentos" badge="BASE" />
          <div className="private-ops-metrics">
            <div><span><Gauge size={15} /> CBs por KM</span><strong>{formatNumber(metrics.cbsPerKm, 2)}</strong></div>
            <div><span><CloudSun size={15} /> Estações por 3.000 ha</span><strong>{formatNumber(metrics.stationsPer3000Ha, 2)}</strong></div>
            <div><span><Radio size={15} /> Pluviômetros por 600 ha</span><strong>{formatNumber(metrics.rainPer600Ha, 2)}</strong></div>
            <div><span><TowerControl size={15} /> Equipamentos climáticos</span><strong>{formatNumber(metrics.totalClimate)}</strong></div>
            <div><span><ChartNoAxesCombined size={15} /> Valor remanescente estimado</span><strong>{formatCurrency(metrics.remainingValue)}</strong></div>
          </div>
        </PageCard>
      </section>
    </div>
  )
}
