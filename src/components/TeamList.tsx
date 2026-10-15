import { ChevronDown, ChevronRight, MapPin, Users } from 'lucide-react'
import type { Employee } from '../data/types'
import { initials } from '../lib/format'

interface TeamListProps {
  employees: Employee[]
  selectedEmployeeId: string | null
  selectedProjectId: string | null
  onSelectEmployee: (id: string) => void
  onSelectProject: (projectId: string) => void
}

export default function TeamList({ employees, selectedEmployeeId, selectedProjectId, onSelectEmployee, onSelectProject }: TeamListProps) {
  return (
    <aside className="team-panel" aria-label="Equipe e unidades">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TERRITÓRIO</span>
          <h2>Equipe</h2>
        </div>
        <span className="count-badge"><Users size={13} /> {employees.length}</span>
      </div>
      <div className="team-list-scroll">
        {employees.length === 0 ? (
          <div className="empty-list">Nenhum colaborador corresponde aos filtros.</div>
        ) : employees.map((employee) => {
          const selected = employee.id === selectedEmployeeId
          return (
            <section className={`employee-group ${selected ? 'is-selected' : ''}`} key={employee.id}>
              <button className="employee-row" type="button" onClick={() => onSelectEmployee(employee.id)} aria-expanded={selected}>
                <span className="employee-avatar" style={{ background: employee.color }}>{initials(employee.name)}</span>
                <span className="employee-copy">
                  <strong>{employee.name}</strong>
                  <small><MapPin size={11} /> {employee.region}</small>
                </span>
                <span className="unit-count" title="Unidades atendidas">{employee.projects.length}</span>
                {selected ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              {selected && (
                <div className="employee-projects">
                  <div className="employee-summary-line">
                    <span>Gestor</span><strong>{employee.manager}</strong>
                  </div>
                  <div className="employee-summary-line">
                    <span>Base</span><strong>{employee.baseCoord ? 'Coordenada informada' : 'Sem coordenada'}</strong>
                  </div>
                  {employee.projects.length === 0 && (
                    <div className="empty-list employee-no-units">Nenhuma fazenda/unidade vinculada a este colaborador na planilha.</div>
                  )}
                  {employee.projects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      className={`project-row ${project.id === selectedProjectId ? 'project-active' : ''}`}
                      onClick={() => onSelectProject(project.id)}
                    >
                      <span className={`project-status-dot ${project.farmCoord ? 'has-exact-coordinate' : ''}`} />
                      <span className="project-row-copy">
                        <strong>{project.farm}</strong>
                        <small>{project.client} · {project.city}</small>
                      </span>
                      {project.farmCoord && <span className="exact-coordinate-mark" title="Coordenada exata informada">EX</span>}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="team-footer"><span className="status-dot" /> Dados carregados da planilha pública</div>
    </aside>
  )
}
