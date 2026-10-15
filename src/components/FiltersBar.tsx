import { CircleDot, RotateCcw, Route, Search, Users, Warehouse } from 'lucide-react'

export interface VisibilityOptions {
  team: boolean
  farms: boolean
  routes: boolean
  areas: boolean
}

interface FiltersBarProps {
  managers: string[]
  regions: string[]
  collaborators: string[]
  manager: string
  region: string
  collaborator: string
  query: string
  visibility: VisibilityOptions
  onManagerChange: (value: string) => void
  onRegionChange: (value: string) => void
  onCollaboratorChange: (value: string) => void
  onQueryChange: (value: string) => void
  onVisibilityChange: (value: VisibilityOptions) => void
  onReset: () => void
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

export default function FiltersBar(props: FiltersBarProps) {
  const toggles: Array<{ key: keyof VisibilityOptions; label: string; icon: typeof Users }> = [
    { key: 'team', label: 'Bases', icon: Users },
    { key: 'farms', label: 'Fazendas', icon: Warehouse },
    { key: 'routes', label: 'Rotas', icon: Route },
    { key: 'areas', label: 'Raios', icon: CircleDot },
  ]

  return (
    <section className="filters-bar" aria-label="Filtros do painel">
      <div className="filter-selects">
        <FilterSelect label="Gestor" value={props.manager} options={props.managers} onChange={props.onManagerChange} />
        <FilterSelect label="Regional" value={props.region} options={props.regions} onChange={props.onRegionChange} />
        <FilterSelect label="Colaborador" value={props.collaborator} options={props.collaborators} onChange={props.onCollaboratorChange} />
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Buscar fazenda, cliente ou cidade</span>
          <input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Buscar fazenda, cliente ou cidade" />
        </label>
      </div>
      <div className="layer-toggles">
        {toggles.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`layer-toggle ${props.visibility[key] ? 'is-on' : ''}`}
            aria-pressed={props.visibility[key]}
            onClick={() => props.onVisibilityChange({ ...props.visibility, [key]: !props.visibility[key] })}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className="reset-button" onClick={props.onReset}>
          <RotateCcw size={14} aria-hidden="true" />
          <span>Limpar filtros</span>
        </button>
      </div>
    </section>
  )
}
