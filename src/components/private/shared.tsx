import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { formatCurrency, formatNumber } from '../../data/privateAnalytics'

export type SortState = { key: string; direction: 'asc' | 'desc' }

export function compareValues(left: unknown, right: unknown): number {
  if (left instanceof Date || right instanceof Date) {
    const a = left instanceof Date ? left.getTime() : Number.NEGATIVE_INFINITY
    const b = right instanceof Date ? right.getTime() : Number.NEGATIVE_INFINITY
    return a - b
  }
  if (typeof left === 'number' || typeof right === 'number') {
    return (Number(left) || 0) - (Number(right) || 0)
  }
  return String(left ?? '').localeCompare(String(right ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' })
}

export function sortRowsBy<T>(rows: T[], state: SortState, accessor: (row: T, key: string) => unknown): T[] {
  const direction = state.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => compareValues(accessor(a, state.key), accessor(b, state.key)) * direction)
}

export function SortableTh({ label, sortKey, state, onChange }: { label: string; sortKey: string; state: SortState; onChange: (key: string) => void }) {
  const active = state.key === sortKey
  return (
    <th aria-sort={active ? (state.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="private-sort-button" onClick={() => onChange(sortKey)}>
        {label}<span aria-hidden="true">{active ? (state.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    </th>
  )
}

export function Kpi({ label, value, note, icon, alert = false, onClick }: { label: string; value: string; note: string; icon: ReactNode; alert?: boolean; onClick?: () => void }) {
  const className = `private-kpi ${alert ? 'is-alert' : ''} ${onClick ? 'is-clickable' : ''}`
  const content = <><span className="private-kpi-icon">{icon}</span><span className="private-kpi-copy"><span className="private-kpi-label">{label}</span><strong>{value}</strong><small>{note}</small></span></>
  return onClick
    ? <button type="button" className={className} onClick={onClick} aria-label={`${label}: ${value}. ${note}`}>{content}</button>
    : <article className={className}>{content}</article>
}

export function PageCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`private-card ${className}`}>{children}</article>
}

export function CardHeading({ eyebrow, title, badge, action }: { eyebrow?: string; title: string; badge?: string; action?: ReactNode }) {
  return (
    <div className="private-card-heading">
      <div>{eyebrow && <span className="private-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
      <div className="private-card-heading-actions">{badge && <span className="private-count-pill">{badge}</span>}{action}</div>
    </div>
  )
}

export function BarRow({ label, value, max, valueLabel, tone = '' }: { label: string; value: number; max: number; valueLabel: string; tone?: string }) {
  const width = value > 0 ? Math.max(2, Math.min(100, value / (max || 1) * 100)) : 0
  return (
    <div className="private-bar-row">
      <span title={label}>{label}</span>
      <div className="private-bar-track"><i className={tone} style={{ width: `${width}%` }} /></div>
      <strong>{valueLabel}</strong>
    </div>
  )
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: string }) {
  return <span className={`private-status-pill ${tone}`}>{label || 'Não informado'}</span>
}

export function EmptyState({ children = 'Nenhum registro corresponde aos filtros.' }: { children?: ReactNode }) {
  return <div className="private-empty-state">{children}</div>
}

export function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="private-filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todos</option>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select></label>
  )
}

export type MultiSelectOption = { value: string; label: string; meta?: string }

export function MultiSelectFilter({ label, value, options, onChange, emptyLabel = 'Todos' }: {
  label: string
  value: string[]
  options: MultiSelectOption[]
  onChange: (values: string[]) => void
  emptyLabel?: string
}) {
  const rootRef = useRef<HTMLDetailsElement>(null)
  const [search, setSearch] = useState('')
  const selected = new Set(value)
  const query = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  const visibleOptions = options.filter((option) => !query || option.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query))
  const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every((option) => selected.has(option.value))

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (rootRef.current?.open && !rootRef.current.contains(event.target as Node)) rootRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && rootRef.current?.open) {
        rootRef.current.open = false
        rootRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggle = (optionValue: string) => onChange(selected.has(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue])
  const toggleVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleOptions.map((option) => option.value))
      onChange(value.filter((item) => !visible.has(item)))
    } else {
      onChange([...new Set([...value, ...visibleOptions.map((option) => option.value)])])
    }
  }

  return (
    <details className="private-multi-select" ref={rootRef}>
      <summary aria-label={`${label}: ${value.length ? `${value.length} selecionados` : emptyLabel}`}><span className="private-multi-select-label">{label}</span><span className="private-multi-select-value">{value.length ? `${value.length} selecionado${value.length === 1 ? '' : 's'}` : emptyLabel}</span><ChevronDown size={15} aria-hidden="true" /></summary>
      <div className="private-multi-select-panel">
        <label className="private-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Filtrar ${label.toLocaleLowerCase('pt-BR')}`} /></label>
        <div className="private-multi-select-actions"><button type="button" onClick={toggleVisible} disabled={!visibleOptions.length}>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button><button type="button" onClick={() => onChange([])} disabled={!value.length}>Limpar seleção</button></div>
        <div className="private-multi-select-options" role="group" aria-label={`${label} disponíveis`}>
          {visibleOptions.map((option) => <label className="private-multi-select-option" key={option.value}><input type="checkbox" checked={selected.has(option.value)} onChange={() => toggle(option.value)} /><span>{option.label}</span>{option.meta && <small>{option.meta}</small>}</label>)}
          {!visibleOptions.length && <EmptyState>Nenhuma opção corresponde à busca.</EmptyState>}
        </div>
        <div className="private-multi-select-panel-footer"><button type="button" onClick={() => { rootRef.current?.removeAttribute('open'); setSearch('') }}>Concluído</button></div>
      </div>
    </details>
  )
}

export function NumberMetric({ label, value, note, kind = 'number' }: { label: string; value: number; note?: string; kind?: 'number' | 'currency' | 'percent' }) {
  const displayed = kind === 'currency' ? formatCurrency(value) : kind === 'percent' ? `${formatNumber(value, 1)}%` : formatNumber(value, 1)
  return <div className="private-pulse-metric"><span>{label}</span><strong>{displayed}</strong>{note && <small>{note}</small>}</div>
}
