import { useMemo, useState } from 'react'
import { Boxes, Download, Search, TowerControl, Users, Wifi } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { formatNumber, projectIsValid, serviceNumber } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, FilterSelect, Kpi, MultiSelectFilter, PageCard, SortableTh, sortRowsBy, type SortState } from './shared'

const MIX = [
  { key: 'CB', label: 'CB', color: '#197a5b' },
  { key: 'Estação', label: 'Estação', color: '#3187bc' },
  { key: 'Pluviômetro', label: 'Pluviômetro', color: '#d88b37' },
  { key: 'CDA', label: 'CDA', color: '#9271b7' },
  { key: 'CDG', label: 'CDG', color: '#41a7a2' },
]

export default function EquipmentPage({ projects, onExport }: { projects: PrivateProject[]; onExport: (rows: PrivateProject[]) => void }) {
  const [manager, setManager] = useState('')
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'cb', direction: 'desc' })
  const query = normalized(search)
  const selectedCollaboratorSet = new Set(selectedCollaborators)
  const filtered = projects.filter((project) => {
    if (!projectIsValid(project)) return false
    if (manager && project.manager !== manager) return false
    if (selectedCollaboratorSet.size && !selectedCollaboratorSet.has(project.collaborator)) return false
    return !query || normalized(project.client).includes(query) || normalized(project.farm).includes(query)
  })
  const totals = Object.fromEntries(MIX.map((item) => [item.key, filtered.reduce((sum, project) => sum + serviceNumber(project, item.key), 0)])) as Record<string, number>
  const totalArea = filtered.reduce((sum, project) => sum + (project.areaHa ?? 0), 0)
  const expectedStations = totalArea > 0 ? Math.ceil(totalArea / 3000) : 0
  const expectedRain = totalArea > 0 ? Math.ceil(totalArea / 600) : 0
  const stationCoverage = expectedStations ? totals['Estação'] / expectedStations * 100 : 0
  const rainCoverage = expectedRain ? totals['Pluviômetro'] / expectedRain * 100 : 0
  const stationGap = Math.max(0, expectedStations - totals['Estação'])
  const rainGap = Math.max(0, expectedRain - totals['Pluviômetro'])
  const managerCount = new Set(filtered.map((project) => project.manager).filter((value) => value && value !== 'Não informado')).size
  const managerBars = Object.entries(filtered.reduce<Record<string, number>>((acc, project) => {
    if (project.manager && project.manager !== 'Não informado') acc[project.manager] = (acc[project.manager] ?? 0) + serviceNumber(project, 'CB')
    return acc
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxManager = Math.max(1, ...managerBars.map(([, value]) => value))
  const mixTotal = MIX.reduce((sum, item) => sum + (totals[item.key] ?? 0), 0)
  let cursor = 0
  const gradient = mixTotal ? `conic-gradient(${MIX.map((item) => {
    const start = cursor / mixTotal * 100
    cursor += totals[item.key] ?? 0
    return `${item.color} ${start}% ${cursor / mixTotal * 100}%`
  }).join(', ')})` : 'conic-gradient(#e8efeb 0% 100%)'
  const managers = unique(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado'))
  const collaboratorSource = manager ? projects.filter((project) => project.manager === manager) : projects
  const collaborators = unique(collaboratorSource.map((project) => project.collaborator).filter((value) => value && value !== 'Sem colaborador informado'))
  const collaboratorOptions = collaborators.map((value) => ({ value, label: value, meta: `${formatNumber(collaboratorSource.filter((project) => project.collaborator === value).length)} proj.` }))
  const changeManager = (value: string) => {
    setManager(value)
    const available = new Set((value ? projects.filter((project) => project.manager === value) : projects).map((project) => project.collaborator))
    setSelectedCollaborators((current) => current.filter((name) => available.has(name)))
  }
  const sorted = useMemo(() => sortRowsBy(filtered, sort, (row, key) => {
    switch (key) {
      case 'client': return row.client
      case 'farm': return row.farm
      case 'manager': return row.manager
      case 'collaborator': return row.collaborator
      case 'cb': return serviceNumber(row, 'CB')
      case 'station': return serviceNumber(row, 'Estação')
      case 'rain': return serviceNumber(row, 'Pluviômetro')
      case 'cda': return serviceNumber(row, 'CDA')
      case 'cdg': return serviceNumber(row, 'CDG')
      default: return row.client
    }
  }), [filtered, sort])
  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))

  return (
    <div className="private-page-stack">
      <PageCard className="private-filterbar private-equipment-filterbar">
        <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente ou fazenda" /></label>
        <FilterSelect label="Gestor" value={manager} options={managers.map((value) => ({ value, label: value }))} onChange={changeManager} />
        <MultiSelectFilter label="Colaboradores" emptyLabel="Selecionar vários" value={selectedCollaborators} options={collaboratorOptions} onChange={setSelectedCollaborators} />
      </PageCard>
      <section className="private-kpis private-kpis-six">
        <Kpi label="CBs" value={formatNumber(totals.CB)} note="unidades monitoradas" icon={<TowerControl size={18} />} />
        <Kpi label="Equipamentos climáticos" value={formatNumber((totals['Estação'] ?? 0) + (totals['Pluviômetro'] ?? 0))} note={`Estação ${formatNumber(totals['Estação'])} · Pluviômetro ${formatNumber(totals['Pluviômetro'])}`} icon={<Boxes size={18} />} />
        <Kpi label="Projetos/unidades" value={formatNumber(filtered.length)} note="após filtros" icon={<span className="private-kpi-letter">Σ</span>} />
        <Kpi label="Gestores" value={formatNumber(managerCount)} note="na seleção atual" icon={<Users size={18} />} />
        <Kpi label="Cobertura de estação" value={`${formatNumber(stationCoverage, 1)}%`} note={`${formatNumber(totals['Estação'])} instaladas / ${formatNumber(expectedStations)} estimadas${stationGap ? ` · déficit ${formatNumber(stationGap)}` : ''}`} icon={<span className="private-kpi-letter">EST</span>} alert={stationGap > 0} />
        <Kpi label="Cobertura de pluviômetro" value={`${formatNumber(rainCoverage, 1)}%`} note={`${formatNumber(totals['Pluviômetro'])} instalados / ${formatNumber(expectedRain)} estimados${rainGap ? ` · déficit ${formatNumber(rainGap)}` : ''}`} icon={<Wifi size={18} />} alert={rainGap > 0} />
      </section>

      <section className="private-equipment-grid">
        <PageCard>
          <CardHeading eyebrow="MIX DA CARTEIRA" title="Distribuição de equipamentos" badge={`${formatNumber(mixTotal)} itens`} />
          <div className="private-equipment-chart">
            <div className="private-equipment-donut" style={{ background: gradient }} role="img" aria-label="Gráfico de rosca da quantidade de equipamentos por tipo"><div><span>Total</span><strong>{formatNumber(mixTotal)}</strong></div></div>
            <div className="private-equipment-legend">{MIX.map((item) => <div key={item.key}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{formatNumber(totals[item.key])}</strong></div>)}</div>
          </div>
          <div className="private-section-divider" />
          <CardHeading eyebrow="CB POR GESTOR" title="Maiores carteiras" badge="TOP 6" />
          {managerBars.map(([name, value]) => <div className="private-equipment-manager" key={name}><span title={name}>{name}</span><div className="private-bar-track"><i style={{ width: `${value ? Math.max(2, value / maxManager * 100) : 0}%` }} /></div><strong>{formatNumber(value)} CB</strong></div>)}
          {!managerBars.length && <EmptyState>Nenhum equipamento encontrado para os filtros atuais.</EmptyState>}
        </PageCard>
        <PageCard className="private-equipment-coverage-card">
          <CardHeading eyebrow="COBERTURA ESTIMADA" title="Estações e pluviômetros" badge="ÁREA" />
          <div className="private-coverage-detail">
            <Coverage label="Estações meteorológicas" actual={totals['Estação'] ?? 0} expected={expectedStations} coverage={stationCoverage} gap={stationGap} />
            <Coverage label="Pluviômetros" actual={totals['Pluviômetro'] ?? 0} expected={expectedRain} coverage={rainCoverage} gap={rainGap} />
          </div>
          <p className="private-help-note">Estimativa legada: 1 estação a cada 3.000 ha e 1 pluviômetro a cada 600 ha; os valores não substituem o planejamento técnico.</p>
        </PageCard>
      </section>

      <PageCard className="private-table-card">
        <CardHeading eyebrow="ESTRUTURA DE ATENDIMENTO" title="Equipamentos por projeto" badge={formatNumber(filtered.length)} action={<button type="button" className="private-button private-button-ghost private-button-small" onClick={() => onExport(filtered)}><Download size={14} /> Exportar XLSX</button>} />
        <div className="private-table-scroll"><table className="private-table private-table-dense">
          <thead><tr><SortableTh label="Cliente" sortKey="client" state={sort} onChange={changeSort} /><SortableTh label="Fazenda/unidade" sortKey="farm" state={sort} onChange={changeSort} /><SortableTh label="Gestor" sortKey="manager" state={sort} onChange={changeSort} /><SortableTh label="Colaborador" sortKey="collaborator" state={sort} onChange={changeSort} /><SortableTh label="CB" sortKey="cb" state={sort} onChange={changeSort} /><SortableTh label="Estação" sortKey="station" state={sort} onChange={changeSort} /><SortableTh label="Pluviômetro" sortKey="rain" state={sort} onChange={changeSort} /><SortableTh label="CDA" sortKey="cda" state={sort} onChange={changeSort} /><SortableTh label="CDG" sortKey="cdg" state={sort} onChange={changeSort} /></tr></thead>
          <tbody>{sorted.map((project) => <tr key={project.key}><td><strong>{project.client}</strong></td><td>{project.farm}</td><td>{project.manager}</td><td>{project.collaborator}</td><td>{formatNumber(serviceNumber(project, 'CB'))}</td><td>{formatNumber(serviceNumber(project, 'Estação'))}</td><td>{formatNumber(serviceNumber(project, 'Pluviômetro'))}</td><td>{formatNumber(serviceNumber(project, 'CDA'))}</td><td>{formatNumber(serviceNumber(project, 'CDG'))}</td></tr>)}{!sorted.length && <tr><td colSpan={9} className="private-empty-cell"><EmptyState /></td></tr>}</tbody>
        </table></div>
      </PageCard>
    </div>
  )
}

function Coverage({ label, actual, expected, coverage, gap }: { label: string; actual: number; expected: number; coverage: number; gap: number }) {
  return <div className="private-coverage-widget"><div><span>{label}</span><strong>{formatNumber(coverage, 1)}%</strong></div><div className="private-bar-track"><i style={{ width: `${Math.min(100, coverage)}%` }} /></div><small>{formatNumber(actual)} instalados / {formatNumber(expected)} estimados{gap ? ` · déficit ${formatNumber(gap)}` : ''}</small></div>
}

function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
