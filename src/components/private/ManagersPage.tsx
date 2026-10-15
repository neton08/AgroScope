import { useMemo, useState } from 'react'
import { ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, CircleDollarSign, Gauge, Users } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { formatCurrency, formatNumber, summarizeManagers } from '../../data/privateAnalytics'
import type { ProjectFilters } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, Kpi, PageCard, SortableTh, sortRowsBy, StatusPill, type SortState } from './shared'

export default function ManagersPage({ projects, onOpenProjects }: { projects: PrivateProject[]; onOpenProjects: (filters?: Partial<ProjectFilters>) => void }) {
  const rows = useMemo(() => summarizeManagers(projects), [projects])
  const [sort, setSort] = useState<SortState>({ key: 'arr', direction: 'desc' })
  const sorted = useMemo(() => sortRowsBy(rows, sort, (row, key) => key === 'terminationPct' ? (row.projects ? row.terminations / row.projects * 100 : 0) : row[key as keyof typeof row]), [rows, sort])
  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  const topArea = [...rows].sort((a, b) => b.area - a.area)[0]
  const topEfficiency = [...rows].sort((a, b) => b.efficiency - a.efficiency)[0]
  const topArr = [...rows].sort((a, b) => b.arr - a.arr)[0]
  const topCharge = [...rows].sort((a, b) => b.chargePct - a.chargePct)[0]

  return (
    <div className="private-page-stack">
      <section className="private-kpis private-kpis-five">
        <Kpi label="Gestores" value={formatNumber(rows.length)} note="com projetos identificados" icon={<Users size={18} />} />
        <Kpi label="Maior área" value={`${formatNumber(topArea?.area ?? 0, 1)} ha`} note={topArea?.name ?? '—'} icon={<span className="private-kpi-letter">ha</span>} />
        <Kpi label="Maior eficiência" value={`${formatNumber(topEfficiency?.efficiency ?? 0, 1)} ha/km`} note={topEfficiency?.name ?? '—'} icon={<Gauge size={18} />} />
        <Kpi label="Maior ARR" value={formatCurrency(topArr?.arr ?? 0)} note={topArr?.name ?? '—'} icon={<CircleDollarSign size={18} />} />
        <Kpi label="Maior % com cobrança" value={`${formatNumber(topCharge?.chargePct ?? 0, 1)}%`} note={topCharge?.name ?? '—'} icon={<ChartNoAxesCombined size={18} />} />
      </section>

      <PageCard>
        <CardHeading eyebrow="EQUIPE E CARTEIRA" title="Gestores e colaboradores" badge={`${formatNumber(rows.length)} gestores`} />
        {rows.length ? <div className="private-manager-card-grid">
          {rows.map((manager) => <article className="private-manager-card" key={manager.name}>
            <div className="private-manager-card-heading"><span className="private-manager-avatar"><Users size={16} /></span><div><strong>{manager.name}</strong><small>{formatNumber(manager.collaborators.length)} colaboradores</small></div><button type="button" className="private-inline-link" onClick={() => onOpenProjects({ manager: manager.name })} aria-label={`Abrir projetos de ${manager.name}`}><ArrowUpRight size={15} /></button></div>
            <div className="private-manager-mini-stats"><div><strong>{formatNumber(manager.projects)}</strong><span>Projetos</span></div><div><strong>{formatNumber(manager.charged)}</strong><span>Com cobrança</span></div><div><strong>{formatNumber(manager.expiring90)}</strong><span>Vencem em 90 dias</span></div></div>
            <div className="private-manager-team-list">{manager.collaborators.length ? manager.collaborators.map((name) => <span key={name}><Users size={12} /> {name}</span>) : <small>Nenhum colaborador informado.</small>}</div>
          </article>)}
        </div> : <EmptyState>Sem gestores identificados na base.</EmptyState>}
      </PageCard>

      <PageCard className="private-table-card">
        <CardHeading eyebrow="DESEMPENHO" title="Comparativo por gestor" badge={`${formatNumber(rows.length)} registros`} />
        <div className="private-table-scroll"><table className="private-table private-table-dense">
          <thead><tr><SortableTh label="Gestor" sortKey="name" state={sort} onChange={changeSort} /><SortableTh label="Área total (ha)" sortKey="area" state={sort} onChange={changeSort} /><SortableTh label="ARR" sortKey="arr" state={sort} onChange={changeSort} /><SortableTh label="Projetos" sortKey="projects" state={sort} onChange={changeSort} /><SortableTh label="Com cobrança" sortKey="charged" state={sort} onChange={changeSort} /><SortableTh label="Sem cobrança" sortKey="uncharged" state={sort} onChange={changeSort} /><SortableTh label="% cobrança" sortKey="chargePct" state={sort} onChange={changeSort} /><SortableTh label="Eficiência (ha/km)" sortKey="efficiency" state={sort} onChange={changeSort} /><SortableTh label="Vencem em 90 dias" sortKey="expiring90" state={sort} onChange={changeSort} /><SortableTh label="% distrato" sortKey="terminationPct" state={sort} onChange={changeSort} /></tr></thead>
          <tbody>{sorted.map((manager) => <tr key={manager.name}>
            <td><button type="button" className="private-cell-link" onClick={() => onOpenProjects({ manager: manager.name })}><strong>{manager.name}</strong><ArrowUpRight size={13} /></button></td><td>{formatNumber(manager.area, 1)}</td><td>{formatCurrency(manager.arr)}</td><td>{formatNumber(manager.projects)}</td><td>{formatNumber(manager.charged)}</td><td>{formatNumber(manager.uncharged)}</td><td><StatusPill label={`${formatNumber(manager.chargePct, 1)}%`} tone={manager.chargePct >= 50 ? 'healthy' : 'warning'} /></td><td>{formatNumber(manager.efficiency, 1)}</td><td><StatusPill label={formatNumber(manager.expiring90)} tone={manager.expiring90 ? 'danger' : 'healthy'} /></td><td>{formatNumber(manager.projects ? manager.terminations / manager.projects * 100 : 0, 1)}%</td>
          </tr>)}{!sorted.length && <tr><td colSpan={10} className="private-empty-cell"><EmptyState /></td></tr>}</tbody>
        </table></div>
        <p className="private-help-note"><BriefcaseBusiness size={13} /> Eficiência = área total dividida pela distância cadastrada; cobrança considera somente respostas SIM/NÃO informadas.</p>
      </PageCard>
    </div>
  )
}
