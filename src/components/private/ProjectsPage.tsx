import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { daysRemaining, filterProjects, formatCurrency, formatDate, formatNumber, remainingContractValue, remainingTimeLabel, serviceCharge, serviceNumber, yesNo } from '../../data/privateAnalytics'
import type { ProjectFilters } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, FilterSelect, Kpi, PageCard, SortableTh, sortRowsBy, StatusPill, type SortState } from './shared'

export default function ProjectsPage({ projects, filters, onFiltersChange, onClear, onExport }: {
  projects: PrivateProject[]
  filters: ProjectFilters
  onFiltersChange: (next: ProjectFilters) => void
  onClear: () => void
  onExport: (rows: PrivateProject[]) => void
}) {
  const filtered = useMemo(() => filterProjects(projects, filters), [filters, projects])
  const [sort, setSort] = useState<SortState>({ key: 'client', direction: 'asc' })
  const tableScroll = useRef<HTMLDivElement>(null)
  const topScroll = useRef<HTMLDivElement>(null)
  const table = useRef<HTMLTableElement>(null)
  const [tableWidth, setTableWidth] = useState(0)
  const managers = unique(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado'))
  const regions = unique(projects.map((project) => project.region).filter((value) => value && value !== 'Não informada'))
  const statuses = unique(projects.map((project) => project.status).filter((value) => value && value !== 'Não informado'))

  useEffect(() => {
    const update = () => setTableWidth(table.current?.scrollWidth ?? 0)
    update()
    const observer = new ResizeObserver(update)
    if (table.current) observer.observe(table.current)
    return () => observer.disconnect()
  }, [filtered.length])

  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  const sorted = useMemo(() => sortRowsBy(filtered, sort, (project, key) => {
    switch (key) {
      case 'manager': return project.manager
      case 'collaborator': return project.collaborator
      case 'client': return project.client
      case 'farm': return project.farm
      case 'area': return project.areaHa ?? 0
      case 'remaining': return daysRemaining(project.contractEnd) ?? -9999
      case 'end': return project.contractEnd?.getTime() ?? 0
      case 'value': return remainingContractValue(project)
      case 'arr': return project.arr ?? 0
      case 'cb': return serviceNumber(project, 'CB')
      case 'climate': return serviceNumber(project, 'Estação') + serviceNumber(project, 'Pluviômetro')
      case 'status': return project.status
      case 'focal': return yesNo(project.services['Ponto focal'])
      case '4g': return yesNo(project.services['4G'])
      case 'charge': return serviceCharge(project.charge)
      default: return project.client
    }
  }), [filtered, sort])
  const totalCb = filtered.reduce((sum, project) => sum + serviceNumber(project, 'CB'), 0)
  const totalStations = filtered.reduce((sum, project) => sum + serviceNumber(project, 'Estação'), 0)
  const totalRain = filtered.reduce((sum, project) => sum + serviceNumber(project, 'Pluviômetro'), 0)
  const arr = filtered.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const focal = filtered.filter((project) => yesNo(project.services['Ponto focal']) === 'SIM').length
  const fourG = filtered.filter((project) => yesNo(project.services['4G']) === 'SIM').length
  const charged = filtered.filter((project) => serviceCharge(project.charge) === 'SIM')
  const uncharged = filtered.filter((project) => serviceCharge(project.charge) === 'NÃO')
  const chargeKnown = charged.length + uncharged.length
  const chargeArr = charged.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const noChargeArr = uncharged.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const update = (key: keyof ProjectFilters, value: string) => onFiltersChange({ ...filters, [key]: value })
  const syncScroll = (source: 'top' | 'table') => {
    const from = source === 'top' ? topScroll.current : tableScroll.current
    const to = source === 'top' ? tableScroll.current : topScroll.current
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft
  }

  return (
    <div className="private-page-stack">
      <PageCard className="private-project-filters">
        <div className="private-project-filter-grid">
          <label className="private-search"><Search size={16} /><input value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Buscar cliente ou fazenda" /></label>
          <FilterSelect label="Gestor" value={filters.manager} options={managers.map((value) => ({ value, label: value }))} onChange={(value) => update('manager', value)} />
          <FilterSelect label="Regional" value={filters.region} options={regions.map((value) => ({ value, label: value }))} onChange={(value) => update('region', value)} />
          <FilterSelect label="Status" value={filters.status} options={statuses.map((value) => ({ value, label: value }))} onChange={(value) => update('status', value)} />
          <FilterSelect label="Cobrança" value={filters.charge} options={[{ value: 'SIM', label: 'Com cobrança' }, { value: 'NÃO', label: 'Sem cobrança' }]} onChange={(value) => update('charge', value)} />
          <FilterSelect label="Ponto focal" value={filters.focal} options={[{ value: 'SIM', label: 'Com ponto focal' }, { value: 'NÃO', label: 'Sem ponto focal' }]} onChange={(value) => update('focal', value)} />
          <FilterSelect label="4G" value={filters.fourG} options={[{ value: 'SIM', label: 'Com 4G' }, { value: 'NÃO', label: 'Sem 4G / não informado' }]} onChange={(value) => update('fourG', value)} />
          <FilterSelect label="Distrato" value={filters.termination} options={[{ value: 'SIM', label: 'Em distrato' }, { value: 'NÃO', label: 'Fora de distrato' }]} onChange={(value) => update('termination', value)} />
          <FilterSelect label="Vencimento" value={filters.contractRange} options={[{ value: 'critical', label: 'Pendências críticas (risco ou distrato)' }, { value: 'expired', label: 'Crítico / vencido' }, { value: '30', label: 'Até 30 dias' }, { value: '90', label: 'Até 90 dias' }, { value: '180', label: 'Até 180 dias' }, { value: 'risk', label: 'Risco próximo (até 180 dias ou vencidos)' }, { value: 'moderate', label: 'Atenção moderada (181–365 dias)' }, { value: '365', label: 'Até 1 ano' }, { value: 'healthy', label: 'Saudável (mais de 1 ano)' }, { value: 'missing', label: 'Sem data' }]} onChange={(value) => update('contractRange', value)} />
          <FilterSelect label="Qualidade dos dados" value={filters.dataIssue} options={[{ value: 'missing-service', label: 'Cobrança indefinida' }, { value: 'missing-arr', label: 'Sem ARR' }, { value: 'missing-farm', label: 'Sem fazenda' }]} onChange={(value) => update('dataIssue', value)} />
          <button type="button" className="private-button private-button-ghost" onClick={onClear}><RotateCcw size={15} /> Limpar filtros</button>
        </div>
      </PageCard>

      <section className="private-kpis private-kpis-six">
        <Kpi label="Projetos filtrados" value={formatNumber(filtered.length)} note={`${formatCurrency(arr)} ARR`} icon={<span className="private-kpi-letter">Σ</span>} />
        <Kpi label="CBs" value={formatNumber(totalCb)} note="soma dos registros" icon={<span className="private-kpi-letter">CB</span>} />
        <Kpi label="Equipamentos climáticos" value={formatNumber(totalStations + totalRain)} note={`Estação ${formatNumber(totalStations)} · Pluviômetro ${formatNumber(totalRain)}`} icon={<span className="private-kpi-letter">CL</span>} />
        <Kpi label="Ponto focal" value={`${formatNumber(filtered.length ? focal / filtered.length * 100 : 0, 1)}%`} note={`${formatNumber(focal)} de ${formatNumber(filtered.length)} projetos`} icon={<span className="private-kpi-letter">PF</span>} />
        <Kpi label="Cobertura 4G" value={`${formatNumber(filtered.length ? fourG / filtered.length * 100 : 0, 1)}%`} note={`${formatNumber(fourG)} de ${formatNumber(filtered.length)} projetos`} icon={<span className="private-kpi-letter">4G</span>} />
        <Kpi label="Com cobrança" value={formatNumber(charged.length)} note={`${chargeKnown ? formatNumber(charged.length / chargeKnown * 100, 1) : '0'}% · ${formatCurrency(chargeArr)} ARR`} icon={<span className="private-kpi-letter">R$</span>} />
        <Kpi label="Sem cobrança" value={formatNumber(uncharged.length)} note={`${chargeKnown ? formatNumber(uncharged.length / chargeKnown * 100, 1) : '0'}% · ${formatCurrency(noChargeArr)} ARR`} icon={<span className="private-kpi-letter">—</span>} alert={uncharged.length > 0} />
      </section>

      <PageCard className="private-table-card">
        <CardHeading eyebrow="CARTEIRA COMPLETA" title="Projetos e unidades" badge={formatNumber(filtered.length)} action={<button type="button" className="private-button private-button-ghost private-button-small" onClick={() => onExport(filtered)}><Download size={14} /> Exportar filtrados</button>} />
        <div className="private-scroll-controls">
          <span>Use a rolagem horizontal para consultar todas as colunas.</span><button type="button" onClick={() => tableScroll.current?.scrollBy({ left: -700, behavior: 'smooth' })}>←</button><button type="button" onClick={() => tableScroll.current?.scrollBy({ left: 700, behavior: 'smooth' })}>→</button>
        </div>
        <div className="private-project-scroll-top" ref={topScroll} onScroll={() => syncScroll('top')}><div style={{ width: tableWidth, height: 1 }} /></div>
        <div className="private-table-scroll private-project-table-scroll" ref={tableScroll} onScroll={() => syncScroll('table')}>
          <table className="private-table private-project-table" ref={table}>
            <thead><tr>
              <SortableTh label="Gestor" sortKey="manager" state={sort} onChange={changeSort} /><SortableTh label="Colaborador" sortKey="collaborator" state={sort} onChange={changeSort} /><SortableTh label="Cliente" sortKey="client" state={sort} onChange={changeSort} /><SortableTh label="Fazenda/unidade" sortKey="farm" state={sort} onChange={changeSort} /><SortableTh label="Área (ha)" sortKey="area" state={sort} onChange={changeSort} /><SortableTh label="Tempo restante" sortKey="remaining" state={sort} onChange={changeSort} /><SortableTh label="Data final" sortKey="end" state={sort} onChange={changeSort} /><SortableTh label="Valor contratual remanescente" sortKey="value" state={sort} onChange={changeSort} /><SortableTh label="ARR" sortKey="arr" state={sort} onChange={changeSort} /><SortableTh label="CB" sortKey="cb" state={sort} onChange={changeSort} /><SortableTh label="Clima" sortKey="climate" state={sort} onChange={changeSort} /><SortableTh label="Status" sortKey="status" state={sort} onChange={changeSort} /><SortableTh label="Ponto focal" sortKey="focal" state={sort} onChange={changeSort} /><SortableTh label="4G" sortKey="4g" state={sort} onChange={changeSort} /><SortableTh label="Cobrança" sortKey="charge" state={sort} onChange={changeSort} />
            </tr></thead>
            <tbody>{sorted.map((project) => {
              const days = daysRemaining(project.contractEnd)
              const tone = project.termination || (days !== null && days <= 30) ? 'danger' : days !== null && days <= 90 ? 'warning' : 'healthy'
              return <tr key={project.key}>
                <td>{project.manager}</td><td><strong>{project.collaborator}</strong></td><td>{project.client}</td><td>{project.farm}</td><td>{formatNumber(project.areaHa, 1)}</td>
                <td><span className={`private-date ${tone}`}>{remainingTimeLabel(project.contractEnd)}</span></td><td>{formatDate(project.contractEnd)}</td><td>{formatCurrency(remainingContractValue(project))}</td><td>{formatCurrency(project.arr)}</td><td>{formatNumber(serviceNumber(project, 'CB'))}</td><td>{formatNumber(serviceNumber(project, 'Estação') + serviceNumber(project, 'Pluviômetro'))}</td>
                <td><StatusPill label={project.status} tone={project.termination ? 'danger' : tone} /></td><td><StatusPill label={yesNo(project.services['Ponto focal']) || 'Não informado'} tone={yesNo(project.services['Ponto focal']) === 'SIM' ? 'healthy' : 'warning'} /></td><td><StatusPill label={yesNo(project.services['4G']) || 'Não informado'} tone={yesNo(project.services['4G']) === 'SIM' ? 'healthy' : 'warning'} /></td><td><StatusPill label={serviceCharge(project.charge) || 'Não informado'} tone={serviceCharge(project.charge) === 'SIM' ? 'healthy' : serviceCharge(project.charge) === 'NÃO' ? 'danger' : 'neutral'} /></td>
              </tr>
            })}{!sorted.length && <tr><td colSpan={15} className="private-empty-cell"><EmptyState /></td></tr>}</tbody>
          </table>
        </div>
      </PageCard>
    </div>
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
