import { useMemo, useState } from 'react'
import { Search, Trophy, Users } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { formatCurrency, formatNumber, normalized, summarizeCollaborators } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, FilterSelect, Kpi, PageCard, SortableTh, sortRowsBy, type SortState } from './shared'

export default function CollaboratorsPage({ projects, onExport }: { projects: PrivateProject[]; onExport: (rows: PrivateProject[]) => void }) {
  const [search, setSearch] = useState('')
  const [manager, setManager] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'area', direction: 'desc' })
  const managers = unique(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado'))
  const filteredProjects = projects.filter((project) => !manager || project.manager === manager)
  const query = normalized(search)
  const rows = useMemo(() => summarizeCollaborators(filteredProjects).filter((person) => !query || normalized(person.name).includes(query)), [filteredProjects, query])
  const visibleNames = new Set(rows.map((person) => person.name))
  const sorted = useMemo(() => sortRowsBy(rows, sort, (row, key) => row[key as keyof typeof row]), [rows, sort])
  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  const avg = (key: 'arr' | 'area' | 'km') => rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0
  const postSale = projects.filter((project) => normalized(project.status) === 'pos-venda' && (!manager || project.manager === manager) && project.collaborator && project.collaborator !== 'Sem colaborador informado')
  const ranking = summarizeCollaborators(postSale).map((person) => ({ ...person, cbPerKm: person.km > 0 ? person.cb / person.km : 0 }))
  const bestCbKm = [...ranking].sort((a, b) => b.cbPerKm - a.cbPerKm)[0]
  const worstCbKm = [...ranking].sort((a, b) => a.cbPerKm - b.cbPerKm)[0]
  const bestArr = [...ranking].sort((a, b) => b.arr - a.arr)[0]
  const worstArr = [...ranking].sort((a, b) => a.arr - b.arr)[0]
  const bestCb = [...ranking].sort((a, b) => b.cb - a.cb)[0]
  const worstCb = [...ranking].sort((a, b) => a.cb - b.cb)[0]

  return (
    <div className="private-page-stack">
      <PageCard className="private-filterbar">
        <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador" /></label>
        <FilterSelect label="Gestor" value={manager} options={managers.map((value) => ({ value, label: value }))} onChange={setManager} />
      </PageCard>
      <section className="private-kpis">
        <Kpi label="ARR médio por colaborador" value={formatCurrency(avg('arr'))} note="média da seleção" icon={<span className="private-kpi-letter">R$</span>} />
        <Kpi label="Área média" value={`${formatNumber(avg('area'), 1)} ha`} note="por colaborador" icon={<span className="private-kpi-letter">ha</span>} />
        <Kpi label="KM médio" value={`${formatNumber(avg('km'), 1)} km`} note="distância somada por carteira" icon={<span className="private-kpi-letter">KM</span>} />
      </section>
      <PageCard>
        <CardHeading eyebrow="RANKING · PÓS-VENDA" title="Melhor e menor indicador" badge={`${formatNumber(ranking.length)} colaboradores`} />
        <div className="private-ranking-grid">
          <Ranking label="Maior CB/KM" person={bestCbKm?.name} value={formatNumber(bestCbKm?.cbPerKm ?? 0, 2)} tone="positive" />
          <Ranking label="Menor CB/KM" person={worstCbKm?.name} value={formatNumber(worstCbKm?.cbPerKm ?? 0, 2)} tone="warning" />
          <Ranking label="Maior ARR" person={bestArr?.name} value={formatCurrency(bestArr?.arr ?? 0)} tone="positive" />
          <Ranking label="Menor ARR" person={worstArr?.name} value={formatCurrency(worstArr?.arr ?? 0)} tone="warning" />
          <Ranking label="Mais CBs" person={bestCb?.name} value={formatNumber(bestCb?.cb ?? 0)} tone="positive" />
          <Ranking label="Menos CBs" person={worstCb?.name} value={formatNumber(worstCb?.cb ?? 0)} tone="warning" />
        </div>
        <p className="private-help-note">Os rankings consideram somente projetos em pós-venda e o gestor selecionado; CB/KM vale zero quando não há KM registrado.</p>
      </PageCard>
      <PageCard className="private-table-card">
        <CardHeading eyebrow="CARTEIRA" title="Resumo por colaborador" badge={formatNumber(rows.length)} action={<button type="button" className="private-button private-button-ghost private-button-small" onClick={() => onExport(filteredProjects.filter((project) => visibleNames.has(project.collaborator)))}><span>Exportar XLSX</span></button>} />
        <div className="private-table-scroll"><table className="private-table private-table-dense">
          <thead><tr><SortableTh label="Colaborador" sortKey="name" state={sort} onChange={changeSort} /><th>Gestor(es)</th><SortableTh label="Projetos" sortKey="projects" state={sort} onChange={changeSort} /><SortableTh label="Área (ha)" sortKey="area" state={sort} onChange={changeSort} /><SortableTh label="KM" sortKey="km" state={sort} onChange={changeSort} /><SortableTh label="ARR" sortKey="arr" state={sort} onChange={changeSort} /><SortableTh label="Implantação" sortKey="implementation" state={sort} onChange={changeSort} /><SortableTh label="Pós-venda / outros" sortKey="otherStatus" state={sort} onChange={changeSort} /><SortableTh label="CB" sortKey="cb" state={sort} onChange={changeSort} /><SortableTh label="Clima" sortKey="climate" state={sort} onChange={changeSort} /></tr></thead>
          <tbody>{sorted.map((person) => <tr key={person.name}><td><strong>{person.name}</strong></td><td>{person.managers.join(', ') || 'Não informado'}</td><td>{formatNumber(person.projects)}</td><td>{formatNumber(person.area, 1)}</td><td>{formatNumber(person.km, 1)}</td><td>{formatCurrency(person.arr)}</td><td>{formatNumber(person.implementation)}</td><td>{formatNumber(person.otherStatus)}</td><td>{formatNumber(person.cb)}</td><td>{formatNumber(person.climate)}</td></tr>)}{!sorted.length && <tr><td colSpan={10} className="private-empty-cell"><EmptyState>Não há colaboradores para os filtros atuais.</EmptyState></td></tr>}</tbody>
        </table></div>
      </PageCard>
    </div>
  )
}

function Ranking({ label, person, value, tone }: { label: string; person?: string; value: string; tone: 'positive' | 'warning' }) {
  return <div className={`private-ranking-card ${tone}`}><span><Trophy size={14} /> {label}</span><strong>{value}</strong><small><Users size={13} /> {person || 'Sem dados'}</small></div>
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
