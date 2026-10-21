import { useMemo, useState } from 'react'
import { ChevronDown, Search, Trophy, Users } from 'lucide-react'
import type { PrivateProject } from '../../data/privateSheets'
import { formatCurrency, formatNumber, normalized, summarizeCollaborators } from '../../data/privateAnalytics'
import { CardHeading, EmptyState, FilterSelect, Kpi, PageCard, SortableTh, sortRowsBy, type SortState } from './shared'

type CollaboratorOption = { name: string; projects: number }

export default function CollaboratorsPage({ projects, onExport }: { projects: PrivateProject[]; onExport: (rows: PrivateProject[]) => void }) {
  const [search, setSearch] = useState('')
  const [manager, setManager] = useState('')
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([])
  const [sort, setSort] = useState<SortState>({ key: 'area', direction: 'desc' })
  const managers = unique(projects.map((project) => project.manager).filter((value) => value && value !== 'Não informado'))
  const filteredProjects = useMemo(() => projects.filter((project) => !manager || project.manager === manager), [projects, manager])
  const allRows = useMemo(() => summarizeCollaborators(filteredProjects), [filteredProjects])
  const collaboratorOptions = useMemo(() => allRows.map((person) => ({ name: person.name, projects: person.projects })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [allRows])
  const selectedSet = useMemo(() => new Set(selectedCollaborators), [selectedCollaborators])
  const query = normalized(search)
  const rows = useMemo(() => allRows.filter((person) => {
    if (query && !normalized(person.name).includes(query)) return false
    return selectedSet.size === 0 || selectedSet.has(person.name)
  }), [allRows, query, selectedSet])
  const visibleNames = useMemo(() => new Set(rows.map((person) => person.name)), [rows])
  const sorted = useMemo(() => sortRowsBy(rows, sort, (row, key) => row[key as keyof typeof row]), [rows, sort])
  const projectsByCollaborator = useMemo(() => {
    const grouped = new Map<string, PrivateProject[]>()
    for (const project of filteredProjects) {
      if (!project.collaborator || project.collaborator === 'Sem colaborador informado') continue
      const assigned = grouped.get(project.collaborator) ?? []
      assigned.push(project)
      grouped.set(project.collaborator, assigned)
    }
    for (const assigned of grouped.values()) {
      assigned.sort((a, b) => projectName(a).localeCompare(projectName(b), 'pt-BR'))
    }
    return grouped
  }, [filteredProjects])
  const projectCards = useMemo(() => rows
    .filter((person) => selectedSet.has(person.name))
    .map((person) => ({ ...person, assignedProjects: projectsByCollaborator.get(person.name) ?? [] })), [rows, projectsByCollaborator, selectedSet])
  const visibleProjectCount = rows.reduce((sum, person) => sum + person.projects, 0)
  const cardProjectCount = projectCards.reduce((sum, person) => sum + person.assignedProjects.length, 0)
  const changeSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
  const avg = (key: 'arr' | 'area' | 'km') => rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0
  const changeManager = (value: string) => {
    setManager(value)
    if (!value) return
    const available = new Set(summarizeCollaborators(projects.filter((project) => project.manager === value)).map((person) => person.name))
    setSelectedCollaborators((current) => current.filter((name) => available.has(name)))
  }
  const postSale = filteredProjects.filter((project) => normalized(project.status) === 'pos-venda' && visibleNames.has(project.collaborator))
  const ranking = summarizeCollaborators(postSale).map((person) => ({ ...person, cbPerKm: person.km > 0 ? person.cb / person.km : 0 }))
  const bestCbKm = [...ranking].sort((a, b) => b.cbPerKm - a.cbPerKm)[0]
  const worstCbKm = [...ranking].sort((a, b) => a.cbPerKm - b.cbPerKm)[0]
  const bestArr = [...ranking].sort((a, b) => b.arr - a.arr)[0]
  const worstArr = [...ranking].sort((a, b) => a.arr - b.arr)[0]
  const bestCb = [...ranking].sort((a, b) => b.cb - a.cb)[0]
  const worstCb = [...ranking].sort((a, b) => a.cb - b.cb)[0]

  return (
    <div className="private-page-stack">
      <PageCard className="private-filterbar private-collaborators-filterbar">
        <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar colaborador" /></label>
        <FilterSelect label="Gestor" value={manager} options={managers.map((value) => ({ value, label: value }))} onChange={changeManager} />
        <CollaboratorMultiSelect options={collaboratorOptions} value={selectedCollaborators} onChange={setSelectedCollaborators} />
      </PageCard>

      <section className="private-kpis private-kpis-five">
        <Kpi label="Colaboradores" value={formatNumber(rows.length)} note={selectedSet.size ? 'na seleção atual' : 'na carteira filtrada'} icon={<Users size={17} />} />
        <Kpi label="Projetos atribuídos" value={formatNumber(visibleProjectCount)} note="dos colaboradores exibidos" icon={<span className="private-kpi-letter">PR</span>} />
        <Kpi label="ARR médio por colaborador" value={formatCurrency(avg('arr'))} note="média da seleção" icon={<span className="private-kpi-letter">R$</span>} />
        <Kpi label="Área média" value={`${formatNumber(avg('area'), 1)} ha`} note="por colaborador" icon={<span className="private-kpi-letter">ha</span>} />
        <Kpi label="KM médio" value={`${formatNumber(avg('km'), 1)} km`} note="distância somada por carteira" icon={<span className="private-kpi-letter">KM</span>} />
      </section>

      <PageCard>
        <CardHeading eyebrow="CARTEIRA INDIVIDUAL" title="Projetos por colaborador" badge={selectedSet.size ? `${formatNumber(projectCards.length)} pessoas · ${formatNumber(cardProjectCount)} projetos` : 'Selecione colaboradores'} />
        {selectedSet.size === 0 ? <EmptyState>Selecione um ou mais colaboradores no filtro para ver, por pessoa, a quantidade e os projetos atendidos.</EmptyState> : projectCards.length === 0 ? <EmptyState>Nenhum colaborador selecionado corresponde à busca atual.</EmptyState> : (
          <div className="private-collaborator-project-grid">
            {projectCards.map((person) => <article className="private-collaborator-project-card" key={person.name}>
              <div className="private-collaborator-project-heading"><div><span className="private-eyebrow">COLABORADOR</span><h3>{person.name}</h3></div><span className="private-count-pill">{formatNumber(person.assignedProjects.length)} projetos</span></div>
              <ProjectList projects={person.assignedProjects} />
            </article>)}
          </div>
        )}
      </PageCard>

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
        <p className="private-help-note">Os rankings consideram somente projetos em pós-venda e os colaboradores selecionados; CB/KM vale zero quando não há KM registrado.</p>
      </PageCard>

      <PageCard className="private-table-card">
        <CardHeading eyebrow="CARTEIRA" title="Resumo por colaborador" badge={formatNumber(rows.length)} action={<button type="button" className="private-button private-button-ghost private-button-small" onClick={() => onExport(filteredProjects.filter((project) => visibleNames.has(project.collaborator)))}><span>Exportar XLSX</span></button>} />
        <div className="private-table-scroll"><table className="private-table private-table-dense private-collaborator-table">
          <thead><tr><SortableTh label="Colaborador" sortKey="name" state={sort} onChange={changeSort} /><th>Gestor(es)</th><SortableTh label="Projetos" sortKey="projects" state={sort} onChange={changeSort} /><th>Projetos atendidos</th><SortableTh label="Área (ha)" sortKey="area" state={sort} onChange={changeSort} /><SortableTh label="KM" sortKey="km" state={sort} onChange={changeSort} /><SortableTh label="ARR" sortKey="arr" state={sort} onChange={changeSort} /><SortableTh label="Implantação" sortKey="implementation" state={sort} onChange={changeSort} /><SortableTh label="Pós-venda / outros" sortKey="otherStatus" state={sort} onChange={changeSort} /><SortableTh label="CB" sortKey="cb" state={sort} onChange={changeSort} /><SortableTh label="Clima" sortKey="climate" state={sort} onChange={changeSort} /></tr></thead>
          <tbody>{sorted.map((person) => <tr key={person.name}><td><strong>{person.name}</strong></td><td>{person.managers.join(', ') || 'Não informado'}</td><td>{formatNumber(person.projects)}</td><td className="private-collaborator-project-cell"><ProjectList projects={projectsByCollaborator.get(person.name) ?? []} compact /></td><td>{formatNumber(person.area, 1)}</td><td>{formatNumber(person.km, 1)}</td><td>{formatCurrency(person.arr)}</td><td>{formatNumber(person.implementation)}</td><td>{formatNumber(person.otherStatus)}</td><td>{formatNumber(person.cb)}</td><td>{formatNumber(person.climate)}</td></tr>)}{!sorted.length && <tr><td colSpan={11} className="private-empty-cell"><EmptyState>Não há colaboradores para os filtros atuais.</EmptyState></td></tr>}</tbody>
        </table></div>
      </PageCard>
    </div>
  )
}

function CollaboratorMultiSelect({ options, value, onChange }: { options: CollaboratorOption[]; value: string[]; onChange: (names: string[]) => void }) {
  const [search, setSearch] = useState('')
  const query = normalized(search)
  const visibleOptions = options.filter((option) => !query || normalized(option.name).includes(query))
  const selected = new Set(value)
  const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every((option) => selected.has(option.name))

  const toggle = (name: string) => onChange(selected.has(name) ? value.filter((item) => item !== name) : [...value, name])
  const toggleVisible = () => {
    if (allVisibleSelected) {
      const visibleNames = new Set(visibleOptions.map((option) => option.name))
      onChange(value.filter((name) => !visibleNames.has(name)))
    } else {
      onChange([...new Set([...value, ...visibleOptions.map((option) => option.name)])])
    }
  }

  return (
    <details className="private-multi-select">
      <summary aria-label="Selecionar vários colaboradores"><span className="private-multi-select-label">Colaboradores</span><span className="private-multi-select-value">{value.length ? `${value.length} selecionado${value.length === 1 ? '' : 's'}` : 'Selecionar vários'}</span><ChevronDown size={15} aria-hidden="true" /></summary>
      <div className="private-multi-select-panel">
        <label className="private-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar nomes" /></label>
        <div className="private-multi-select-actions"><button type="button" onClick={toggleVisible} disabled={!visibleOptions.length}>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button><button type="button" onClick={() => onChange([])} disabled={!value.length}>Limpar seleção</button></div>
        <div className="private-multi-select-options" role="group" aria-label="Colaboradores disponíveis">
          {visibleOptions.map((option) => <label className="private-multi-select-option" key={option.name}><input type="checkbox" checked={selected.has(option.name)} onChange={() => toggle(option.name)} /><span>{option.name}</span><small>{formatNumber(option.projects)} proj.</small></label>)}
          {!visibleOptions.length && <EmptyState>Nenhum nome corresponde à busca.</EmptyState>}
        </div>
      </div>
    </details>
  )
}

function ProjectList({ projects, compact = false }: { projects: PrivateProject[]; compact?: boolean }) {
  if (!projects.length) return <span className="private-empty">Nenhum projeto identificado.</span>
  return <ul className={`private-collaborator-project-list ${compact ? 'is-compact' : ''}`}>
    {projects.map((project, index) => {
      const farm = project.farm && project.farm !== '-' && project.farm !== 'Fazenda/unidade não informada' ? project.farm : ''
      const title = farm || project.client || 'Projeto sem identificação'
      const detail = farm && project.client && normalized(farm) !== normalized(project.client) ? project.client : ''
      return <li key={project.key || `${project.client}|${project.farm}|${index}`}><strong title={title}>{title}</strong>{detail && <small title={detail}>{detail}</small>}</li>
    })}
  </ul>
}

function projectName(project: PrivateProject): string {
  return `${project.farm || ''} ${project.client || ''}`.trim()
}

function Ranking({ label, person, value, tone }: { label: string; person?: string; value: string; tone: 'positive' | 'warning' }) {
  return <div className={`private-ranking-card ${tone}`}><span><Trophy size={14} /> {label}</span><strong>{value}</strong><small><Users size={13} /> {person || 'Sem dados'}</small></div>
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
