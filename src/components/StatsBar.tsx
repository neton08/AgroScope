import { Activity, Compass, MapPinned, Ruler, Users } from 'lucide-react'
import type { DashboardStats } from '../data/types'
import { formatArea, formatDistance, formatNumber } from '../lib/format'

export default function StatsBar({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: 'Unidades atendidas', value: formatNumber(stats.unitCount), note: 'vínculos únicos', icon: Compass },
    { label: 'Colaboradores', value: formatNumber(stats.employeeCount), note: 'na seleção atual', icon: Users },
    { label: 'Área atendida', value: formatArea(stats.areaHa), note: 'hectares informados', icon: Activity },
    { label: 'Distância média', value: formatDistance(stats.averageDistanceKm), note: 'valor cadastrado', icon: Ruler },
    { label: 'Sem coordenada exata', value: formatNumber(stats.missingFarmCoordinates), note: `de ${formatNumber(stats.totalProjects)} registros`, icon: MapPinned },
  ]

  return (
    <section className="stats-strip" aria-label="Indicadores da seleção">
      {items.map(({ label, value, note, icon: Icon }, index) => (
        <article key={label} className={`stat-card ${index === 0 ? 'stat-primary' : ''}`}>
          <div className="stat-icon"><Icon size={17} strokeWidth={1.9} aria-hidden={true} /></div>
          <div className="stat-copy">
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value}</strong>
            <span className="stat-note">{note}</span>
          </div>
          {index === 4 && stats.missingFarmCoordinates > 0 && <span className="stat-alert-dot" aria-label="Atenção: coordenadas incompletas" />}
        </article>
      ))}
    </section>
  )
}
