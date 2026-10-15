import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { divIcon, type LatLngExpression } from 'leaflet'
import { MapPin } from 'lucide-react'
import type { Employee, Project, RouteInfo } from '../data/types'
import { escapeHtml, initials } from '../lib/format'

interface MapViewProps {
  employees: Employee[]
  projects: Project[]
  selectedEmployeeId: string | null
  selectedProjectId: string | null
  route: RouteInfo | null
  showTeam: boolean
  showFarms: boolean
  showRoutes: boolean
  showAreas: boolean
  onSelectEmployee: (id: string) => void
  onSelectProject: (id: string) => void
}

function markerIcon(label: string, color: string, count = 0) {
  const text = count > 1 ? String(count) : escapeHtml(initials(label))
  const html = `<span class="map-pin" style="--pin-color:${color}"><span>${text}</span></span>`
  return divIcon({ html, className: 'map-pin-host', iconSize: [36, 42], iconAnchor: [18, 38], popupAnchor: [0, -34] })
}

function SelectionFocus({ employee, project, route }: {
  employee: Employee | null
  project: Project | null
  route: RouteInfo | null
}) {
  const map = useMap()
  useEffect(() => {
    if (route?.path.length) {
      const bounds = route.path.map((point) => [point.lat, point.lon] as [number, number])
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 8, animate: true, duration: 0.6 })
      return
    }
    const point = project?.farmCoord ?? employee?.baseCoord
    if (point) map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 7), { duration: 0.6 })
  }, [employee, map, project, route])
  return null
}

function groupBaseMarkers(employees: Employee[]) {
  const groups = new Map<string, Employee[]>()
  for (const employee of employees) {
    if (!employee.baseCoord) continue
    const key = `${employee.baseCoord.lat.toFixed(4)},${employee.baseCoord.lon.toFixed(4)}`
    groups.set(key, [...(groups.get(key) ?? []), employee])
  }
  return [...groups.entries()].map(([key, members]) => ({ key, members, point: members[0].baseCoord! }))
}

export default function MapView(props: MapViewProps) {
  const baseGroups = useMemo(() => groupBaseMarkers(props.employees), [props.employees])
  const routePositions = props.route?.path.map((point) => [point.lat, point.lon] as LatLngExpression) ?? []
  const origin = props.route ? ([props.route.path[0]?.lat, props.route.path[0]?.lon] as LatLngExpression) : null
  const destination = props.route ? ([props.route.destination.lat, props.route.destination.lon] as LatLngExpression) : null

  return (
    <div className="map-shell">
      <MapContainer center={[-14.2, -52.5]} zoom={4} minZoom={3} maxZoom={18} scrollWheelZoom className="map-canvas">
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Relevo">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Map style: <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer
              attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <SelectionFocus
          employee={props.employees.find((person) => person.id === props.selectedEmployeeId) ?? null}
          project={props.projects.find((item) => item.id === props.selectedProjectId) ?? null}
          route={props.showRoutes ? props.route : null}
        />

        {props.showAreas && props.employees
          .filter((employee) => !props.selectedEmployeeId || employee.id === props.selectedEmployeeId)
          .map((employee) => {
          const projectRadii = props.selectedEmployeeId
            ? employee.projects.filter((project) => project.id === props.selectedProjectId).map((project) => project.radiusKm)
            : employee.projects.map((project) => project.radiusKm)
          const radii = [...new Set(projectRadii
            .filter((radius): radius is number => typeof radius === 'number' && radius > 0))]
            .sort((a, b) => b - a)
          if (!employee.baseCoord || radii.length === 0) return null
          return radii.map((radius, index) => (
            <Circle
              key={`radius-${employee.id}-${radius}`}
              center={[employee.baseCoord!.lat, employee.baseCoord!.lon]}
              radius={radius * 1000}
              pathOptions={{ color: employee.color, fillColor: employee.color, fillOpacity: 0.025, weight: index === radii.length - 1 ? 1.8 : 1.2, opacity: 0.42 }}
            />
          ))
        })}

        {props.showTeam && baseGroups.map(({ key, members, point }) => {
          const main = members.find((person) => person.id === props.selectedEmployeeId) ?? members[0]
          const icon = markerIcon(main.name, main.color, members.length)
          return (
            <Marker
              key={`base-${key}`}
              position={[point.lat, point.lon]}
              icon={icon}
              eventHandlers={{ click: () => props.onSelectEmployee(main.id) }}
              zIndexOffset={700}
            >
              <Popup className="map-popup">
                <div className="popup-title">Base de atendimento</div>
                <div className="popup-subtitle">{members.length} colaborador{members.length === 1 ? '' : 'es'}</div>
                {members.map((person) => (
                  <button key={person.id} className="popup-person" type="button" onClick={() => props.onSelectEmployee(person.id)}>
                    <i style={{ background: person.color }} />{person.name}
                  </button>
                ))}
              </Popup>
            </Marker>
          )
        })}

        {props.showFarms && props.projects.filter((project) => project.farmCoord).map((project) => {
          const employee = props.employees.find((person) => person.name === project.collaborator)
          const color = employee?.color ?? '#d2a15e'
          const selected = project.id === props.selectedProjectId
          const position: LatLngExpression = [project.farmCoord!.lat, project.farmCoord!.lon]
          return (
            <CircleMarker
              key={`farm-${project.id}`}
              center={position}
              radius={selected ? 9 : 6}
              pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.96 }}
              eventHandlers={{ click: () => props.onSelectProject(project.id) }}
            >
              <Popup className="map-popup">
                <div className="popup-title">{project.farm}</div>
                <div className="popup-subtitle">{project.city} · {project.collaborator}</div>
                <button className="popup-action" type="button" onClick={() => props.onSelectProject(project.id)}>Abrir atendimento</button>
              </Popup>
            </CircleMarker>
          )
        })}

        {props.showRoutes && routePositions.length > 1 && (
          <>
            <Polyline positions={routePositions} pathOptions={{ color: '#197a5b', weight: 5, opacity: 0.86, lineCap: 'round' }} />
            {origin && <CircleMarker center={origin} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: '#12313b', fillOpacity: 1 }} />}
            {destination && <CircleMarker center={destination} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#d19a4a', fillOpacity: 1 }} />}
          </>
        )}
      </MapContainer>

      <div className="map-legend" aria-label="Legenda do mapa">
        <span><i className="legend-dot legend-base" />Bases</span>
        <span><i className="legend-dot legend-farm" />Fazendas com coordenada exata</span>
        <span><i className="legend-line" />Rota rodoviária</span>
        <span><i className="legend-radius" />Raio do projeto selecionado · todos sem seleção</span>
      </div>
      <div className="map-context-chip"><MapPin size={13} aria-hidden="true" /> Brasil · visão territorial</div>
    </div>
  )
}
