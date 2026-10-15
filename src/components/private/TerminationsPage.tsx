import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Search } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { formatCurrency, formatNumber, normalized, projectIsValid, serviceNumber } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, FilterSelect, Kpi, PageCard, SortableTh, sortRowsBy, type SortState } from './shared'

export default function TerminationsPage({ projects, onExport }: { projects: PrivateProject[]; onExport: (rows: PrivateProject[]) => void }) {
  const [search, setSearch] = useState('')
  const [manager, setManager] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'client', direction: 'asc' })
  const query = normalized(search)
  const managers = unique(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado'))
  const filtered = projects.filter((project) => projectIsValid(project) && project.termination && (!manager || project.manager === manager) && (!query || normalized(project.client).includes(query)))
  const arr = filtered.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const cb = filtered.reduce((sum, project) => sum + serviceNumber(project, 'CB'), 0)
  const climate = filtered.reduce((sum, project) => sum + serviceNumber(project, 'Estação') + serviceNumber(project, 'Pluviômetro'), 0)
  const area = filtered.reduce((sum, project) => sum + (project.areaHa ?? 0), 0)
  const sorted = useMemo(() => sortRowsBy(filtered, sort, (row, key) => {
    if (key === 'area') return row.areaHa ?? 0
    if (key === 'cb') return serviceNumber(row, 'CB')
    if (key === 'climate') return serviceNumber(row, 'Estação') + serviceNumber(row, 'Pluviômetro')
    return row[key as keyof typeof row]
  }), [filtered, sort])
  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))

  return (
    <div className="private-page-stack">
      <PageCard className="private-filterbar">
        <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pelo nome do cliente" /></label>
        <FilterSelect label="Gestor" value={manager} options={managers.map((value) => ({ value, label: value }))} onChange={setManager} />
      </PageCard>
      <section className="private-kpis">
        <Kpi label="ARR em distrato" value={formatCurrency(arr)} note="receita anual recorrente" icon={<AlertTriangle size={18} />} alert={arr > 0} />
        <Kpi label="CBs" value={formatNumber(cb)} note="ativos associados" icon={<span className="private-kpi-letter">CB</span>} />
        <Kpi label="Equipamentos climáticos" value={formatNumber(climate)} note="estações e pluviômetros" icon={<span className="private-kpi-letter">CL</span>} />
        <Kpi label="Área em distrato" value={`${formatNumber(area, 1)} ha`} note="soma da seleção" icon={<span className="private-kpi-letter">ha</span>} />
      </section>
      <PageCard className="private-table-card">
        <CardHeading eyebrow="ENCERRAMENTO DE CARTEIRA" title="Projetos em processo de distrato" badge={formatNumber(filtered.length)} action={<button type="button" className="private-button private-button-ghost private-button-small" onClick={() => onExport(filtered)}><Download size={14} /> Exportar XLSX</button>} />
        <p className="private-help-note">Esta lista inclui somente linhas marcadas como “em processo de distrato” na planilha. Vencimentos sem essa marca permanecem nos alertas e filtros de Projetos.</p>
        <div className="private-table-scroll"><table className="private-table private-table-dense">
          <thead><tr><SortableTh label="Cliente" sortKey="client" state={sort} onChange={changeSort} /><SortableTh label="Fazenda/unidade" sortKey="farm" state={sort} onChange={changeSort} /><SortableTh label="Gestor" sortKey="manager" state={sort} onChange={changeSort} /><SortableTh label="Área (ha)" sortKey="area" state={sort} onChange={changeSort} /><SortableTh label="ARR" sortKey="arr" state={sort} onChange={changeSort} /><SortableTh label="CB" sortKey="cb" state={sort} onChange={changeSort} /><SortableTh label="Clima" sortKey="climate" state={sort} onChange={changeSort} /><th>Status</th></tr></thead>
          <tbody>{sorted.map((project) => <tr key={project.key}><td><strong>{project.client}</strong></td><td>{project.farm}</td><td>{project.manager}</td><td>{formatNumber(project.areaHa, 1)}</td><td>{formatCurrency(project.arr)}</td><td>{formatNumber(serviceNumber(project, 'CB'))}</td><td>{formatNumber(serviceNumber(project, 'Estação') + serviceNumber(project, 'Pluviômetro'))}</td><td><span className="private-status-pill danger">DISTRATO</span></td></tr>)}{!sorted.length && <tr><td colSpan={8} className="private-empty-cell"><EmptyState>Não há projetos em distrato com os filtros atuais.</EmptyState></td></tr>}</tbody>
        </table></div>
      </PageCard>
    </div>
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
