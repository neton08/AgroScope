import type { ReactNode } from 'react'
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

export function NumberMetric({ label, value, note, kind = 'number' }: { label: string; value: number; note?: string; kind?: 'number' | 'currency' | 'percent' }) {
  const displayed = kind === 'currency' ? formatCurrency(value) : kind === 'percent' ? `${formatNumber(value, 1)}%` : formatNumber(value, 1)
  return <div className="private-pulse-metric"><span>{label}</span><strong>{displayed}</strong>{note && <small>{note}</small>}</div>
}
