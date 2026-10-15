import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Download,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { chooseSpreadsheet, GoogleApiError, missingGoogleConfiguration, signInWithGoogle } from '../lib/googleDrive'
import type { GoogleSession, PickedSpreadsheet } from '../lib/googleDrive'
import { loadPrivateWorkbook } from '../data/privateSheets'
import type { PrivateContact, PrivateProject, PrivateWorkbook } from '../data/privateSheets'
import '../private.css'

type ViewKey = 'overview' | 'projects' | 'collaborators' | 'managers' | 'equipment' | 'terminations' | 'contacts'

const VIEWS: Array<{ id: ViewKey; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'projects', label: 'Projetos' },
  { id: 'collaborators', label: 'Colaboradores' },
  { id: 'managers', label: 'Gestores' },
  { id: 'equipment', label: 'Equipamentos' },
  { id: 'terminations', label: 'Distratos' },
  { id: 'contacts', label: 'Contatos' },
]

const EQUIPMENT = ['Ponto focal', 'CB', 'Comboio', 'Estação', 'Pluviômetro', 'Solinfnet', 'CDA', 'CDG', '4G', 'Cobrança de serviço'] as const

function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function numberLabel(value: number | null, fractionDigits = 0): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: fractionDigits }).format(value)
}

function currencyLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function dateLabel(value: Date | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR').format(value) : 'Não informado'
}

function daysRemaining(value: Date | null): number | null {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}

function isPositive(value: string): boolean {
  const key = normalized(value)
  if (!key || ['nao', 'n', 'nao informado', 'nao aplicavel', '0', '-'].includes(key)) return false
  const number = Number(key.replace(',', '.'))
  return Number.isFinite(number) ? number > 0 : ['sim', 's', 'yes', 'true', 'ok'].includes(key) || Boolean(key)
}

function csvValue(value: unknown): string {
  let text = String(value ?? '')
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function renderDays(project: PrivateProject): string {
  const days = daysRemaining(project.contractEnd)
  if (days === null) return 'Sem data'
  if (days < 0) return `Vencido há ${Math.abs(days)} dia(s)`
  if (days === 0) return 'Vence hoje'
  return `${days} dia(s)`
}

function contractTone(project: PrivateProject): string {
  if (project.termination) return 'danger'
  const days = daysRemaining(project.contractEnd)
  if (days === null) return 'neutral'
  if (days < 0 || days <= 30) return 'danger'
  if (days <= 90) return 'warning'
  return 'healthy'
}

function projectCsv(projects: PrivateProject[]): unknown[][] {
  return [
    ['Gestor', 'Regional', 'Colaborador', 'Cliente', 'Fazenda/unidade', 'Cidade', 'Área (ha)', 'Distância (km)', 'Raio (km)', 'Status', 'Vencimento', 'Tempo de contrato', 'Valor total', 'ARR', 'CB', 'Ponto focal', 'Comboio', 'Estação', 'Pluviômetro', 'Solinfnet', 'CDA', 'CDG', '4G', 'Cobrança de serviço', 'Em distrato'],
    ...projects.map((project) => [
      project.manager, project.region, project.collaborator, project.client, project.farm, project.city,
      project.areaHa, project.distanceKm, project.radiusKm, project.status, dateLabel(project.contractEnd),
      project.contractTerm, project.contractValue, project.arr, project.services.CB, project.services['Ponto focal'],
      project.services.Comboio, project.services.Estação, project.services.Pluviômetro, project.services.Solinfnet,
      project.services.CDA, project.services.CDG, project.services['4G'], project.charge, project.termination ? 'Sim' : 'Não',
    ]),
  ]
}

function contactCsv(contacts: PrivateContact[]): unknown[][] {
  return [
    ['Vertical', 'Cliente', 'Nome', 'Cargo', 'E-mail', 'Telefone'],
    ...contacts.map((contact) => [contact.vertical, contact.client, contact.name, contact.role, contact.email, contact.phone]),
  ]
}

export default function PrivateDashboard({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<GoogleSession | null>(null)
  const [pickedFile, setPickedFile] = useState<PickedSpreadsheet | null>(null)
  const [workbook, setWorkbook] = useState<PrivateWorkbook | null>(null)
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [search, setSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const missingConfig = missingGoogleConfiguration()

  const managers = useMemo(() => [...new Set((workbook?.projects ?? []).map((project) => project.manager).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [workbook])
  const statuses = useMemo(() => [...new Set((workbook?.projects ?? []).map((project) => project.status).filter((status) => status && status !== 'Não informado'))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [workbook])
  const normalizedSearch = normalized(search)
  const filteredProjects = useMemo(() => (workbook?.projects ?? []).filter((project) => {
    if (managerFilter && project.manager !== managerFilter) return false
    if (statusFilter && project.status !== statusFilter) return false
    if (!normalizedSearch) return true
    return [project.manager, project.region, project.collaborator, project.client, project.farm, project.city, project.status]
      .some((value) => normalized(value).includes(normalizedSearch))
  }), [managerFilter, normalizedSearch, statusFilter, workbook])
  const filteredContacts = useMemo(() => (workbook?.contacts ?? []).filter((contact) => {
    if (!normalizedSearch) return true
    return [contact.vertical, contact.client, contact.name, contact.role, contact.email, contact.phone]
      .some((value) => normalized(value).includes(normalizedSearch))
  }), [normalizedSearch, workbook])

  const totalArea = filteredProjects.reduce((sum, project) => sum + (project.areaHa ?? 0), 0)
  const totalArr = filteredProjects.reduce((sum, project) => sum + (project.arr ?? 0), 0)
  const totalContractValue = filteredProjects.reduce((sum, project) => sum + (project.contractValue ?? 0), 0)
  const collaboratorsCount = new Set(filteredProjects.map((project) => project.collaborator)).size
  const expiringProjects = filteredProjects.filter((project) => {
    const days = daysRemaining(project.contractEnd)
    return !project.termination && days !== null && days >= 0 && days <= 90
  }).sort((a, b) => (daysRemaining(a.contractEnd) ?? 9999) - (daysRemaining(b.contractEnd) ?? 9999))
  const overdueCount = filteredProjects.filter((project) => {
    const days = daysRemaining(project.contractEnd)
    return project.termination || (days !== null && days < 0)
  }).length
  const terminationProjects = filteredProjects.filter((project) => project.termination)
  const managerSummary = useMemo(() => {
    const groups = new Map<string, { manager: string; count: number; area: number; arr: number; contract: number; billed: number; expiring: number; termination: number }>()
    for (const project of filteredProjects) {
      const group = groups.get(project.manager) ?? { manager: project.manager, count: 0, area: 0, arr: 0, contract: 0, billed: 0, expiring: 0, termination: 0 }
      group.count += 1
      group.area += project.areaHa ?? 0
      group.arr += project.arr ?? 0
      group.contract += project.contractValue ?? 0
      if (isPositive(project.charge)) group.billed += 1
      const days = daysRemaining(project.contractEnd)
      if (!project.termination && days !== null && days >= 0 && days <= 90) group.expiring += 1
      if (project.termination) group.termination += 1
      groups.set(project.manager, group)
    }
    return [...groups.values()].sort((a, b) => b.arr - a.arr)
  }, [filteredProjects])
  const maxManagerArr = Math.max(1, ...managerSummary.map((manager) => manager.arr))
  const collaboratorSummary = useMemo(() => {
    const groups = new Map<string, { name: string; manager: string; projects: number; area: number; arr: number; distance: number; distances: number; cb: number }>()
    for (const project of filteredProjects) {
      const group = groups.get(project.collaborator) ?? { name: project.collaborator, manager: project.manager, projects: 0, area: 0, arr: 0, distance: 0, distances: 0, cb: 0 }
      group.projects += 1
      group.area += project.areaHa ?? 0
      group.arr += project.arr ?? 0
      if (project.distanceKm !== null) { group.distance += project.distanceKm; group.distances += 1 }
      group.cb += Number(project.services.CB.replace(',', '.')) || (isPositive(project.services.CB) ? 1 : 0)
      groups.set(project.collaborator, group)
    }
    return [...groups.values()].sort((a, b) => b.area - a.area)
  }, [filteredProjects])
  const activeCount = filteredProjects.filter((project) => {
    const status = normalized(project.status)
    return status.includes('ativ') && !status.includes('inativ') && !status.includes('desativ')
  }).length
  const billedCount = filteredProjects.filter((project) => isPositive(project.charge)).length
  const missingContractDateCount = filteredProjects.filter((project) => project.contractEnd === null).length
  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const project of filteredProjects) counts.set(project.status, (counts.get(project.status) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [filteredProjects])
  const equipmentSummary = EQUIPMENT.map((name) => ({
    name,
    count: filteredProjects.filter((project) => isPositive(project.services[name])).length,
  })).sort((a, b) => b.count - a.count)
  const visibleProjects = activeView === 'terminations' ? terminationProjects : filteredProjects

  const loadSelected = async (file: PickedSpreadsheet, accessToken: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await loadPrivateWorkbook(accessToken, file.id)
      setPickedFile(file)
      setWorkbook(result)
    } catch (loadError) {
      setWorkbook(null)
      if (loadError instanceof GoogleApiError && loadError.status === 401) {
        setSession(null)
        setPickedFile(null)
        setError('A sessão Google expirou. Entre novamente para continuar.')
      } else if (loadError instanceof GoogleApiError && loadError.status === 403) {
        setError('Esta conta não tem acesso autorizado à planilha selecionada. Peça ao proprietário para compartilhar o arquivo com este e-mail.')
      } else {
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a planilha privada.')
      }
    } finally {
      setBusy(false)
    }
  }

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await signInWithGoogle()
      setSession(result)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Não foi possível entrar com Google.')
    } finally {
      setBusy(false)
    }
  }

  const selectFile = async () => {
    if (!session) return
    setBusy(true)
    setError('')
    try {
      const file = await chooseSpreadsheet(session.accessToken)
      if (file) await loadSelected(file, session.accessToken)
    } catch (pickerError) {
      if (pickerError instanceof GoogleApiError && pickerError.status === 401) {
        setSession(null)
        setPickedFile(null)
        setWorkbook(null)
        setError('A sessão Google expirou. Entre novamente para continuar.')
      } else {
        setError(pickerError instanceof Error ? pickerError.message : 'Não foi possível abrir o seletor Google Drive.')
      }
    } finally {
      setBusy(false)
    }
  }

  const refreshWorkbook = async () => {
    if (session && pickedFile) await loadSelected(pickedFile, session.accessToken)
  }

  const signOut = () => {
    setSession(null)
    setPickedFile(null)
    setWorkbook(null)
    setSearch('')
    setManagerFilter('')
    setStatusFilter('')
    setError('')
  }

  const exportCurrent = () => {
    if (activeView === 'contacts') downloadCsv('AgroScope-contatos.csv', contactCsv(filteredContacts))
    else downloadCsv(activeView === 'terminations' ? 'AgroScope-distratos.csv' : 'AgroScope-projetos.csv', projectCsv(visibleProjects))
  }

  const currentLabel = VIEWS.find((view) => view.id === activeView)?.label ?? 'Visão geral'

  return (
    <div className="private-shell">
      <header className="private-topbar">
        <div className="private-brand">
          <div className="private-brand-mark" aria-hidden="true">A</div>
          <div><strong>AgroScope</strong><span>ÁREA DE GESTORES</span></div>
        </div>
        <div className="private-top-actions">
          {session && <span className="private-identity"><ShieldCheck size={14} /> {session.email}</span>}
          {session && <button type="button" className="private-button private-button-ghost" onClick={selectFile} disabled={busy}><FileSpreadsheet size={15} /> Selecionar planilha</button>}
          {session && <button type="button" className="private-icon-button" onClick={signOut} title="Sair da sessão Google" aria-label="Sair da sessão Google"><LogOut size={16} /></button>}
          <button type="button" className="private-button private-button-back" onClick={onBack}><ArrowLeft size={15} /> Mapa público</button>
        </div>
      </header>

      {!session ? (
        <main className="private-auth-wrap">
          <section className="private-auth-card">
            <div className="private-auth-icon"><ShieldCheck size={26} /></div>
            <span className="private-eyebrow">ACESSO RESTRITO A GESTORES</span>
            <h1>Dados completos, com acesso pela sua conta Google.</h1>
            <p>Entre com uma conta que tenha permissão na planilha AgroScope. O navegador só consulta arquivos que você selecionar no Google Drive; tokens e registros não são salvos neste site.</p>
            {error && <div className="private-alert" role="alert"><AlertCircle size={17} />{error}</div>}
            {missingConfig.length > 0 && (
              <div className="private-setup-note">
                <strong>Configuração Google pendente</strong>
                <p>Antes do login funcionar, configure no build do Pages:</p>
                <code>{missingConfig.join(' · ')}</code>
                <p>As instruções estão no README do repositório. Não coloque o segredo de cliente OAuth no código: o Client ID e a chave do Picker são identificadores públicos e devem ter as origens/APIs restritas.</p>
              </div>
            )}
            <button type="button" className="private-button private-button-primary private-login-button" onClick={() => void signIn()} disabled={busy || missingConfig.length > 0}>
              {busy ? <RefreshCw size={16} className="private-spin" /> : <ShieldCheck size={16} />}
              {busy ? 'Conectando…' : 'Acessar com Google'}
            </button>
            <div className="private-security-note"><ShieldCheck size={15} /> Login Google · acesso concedido pelo Drive · dados mantidos só na memória da sessão</div>
            <a className="private-privacy-link" href={`${import.meta.env.BASE_URL}privacy.html`}>Política de privacidade</a>
          </section>
        </main>
      ) : !workbook ? (
        <main className="private-auth-wrap">
          <section className="private-auth-card private-file-card">
            <div className="private-auth-icon"><FileSpreadsheet size={26} /></div>
            <span className="private-eyebrow">SESSÃO AUTORIZADA</span>
            <h1>Selecione a base operacional.</h1>
            <p>Conta conectada: <strong>{session.email}</strong>. Escolha no Drive a planilha <strong>AgroScope - Base Operacional</strong>; a conta precisa ter acesso de edição/leitura autorizado pelo proprietário.</p>
            {error && <div className="private-alert" role="alert"><AlertCircle size={17} />{error}</div>}
            <button type="button" className="private-button private-button-primary private-login-button" onClick={() => void selectFile()} disabled={busy}>
              {busy ? <RefreshCw size={16} className="private-spin" /> : <FileSpreadsheet size={16} />}
              {busy ? 'Carregando…' : 'Escolher planilha no Google Drive'}
            </button>
          </section>
        </main>
      ) : (
        <>
          <nav className="private-nav" aria-label="Seções da área de gestores">
            {VIEWS.map((view) => (
              <button type="button" key={view.id} className={activeView === view.id ? 'is-active' : ''} onClick={() => setActiveView(view.id)}>
                {view.id === 'overview' ? <BarChart3 size={16} /> : view.id === 'contacts' ? <Users size={16} /> : null}
                {view.label}
                {view.id === 'contacts' && <span className="private-nav-count">{workbook.contacts.length}</span>}
              </button>
            ))}
          </nav>
          <main className="private-main">
            <div className="private-heading-row">
              <div>
                <span className="private-eyebrow">BASE PRIVADA · {workbook.title}</span>
                <h1>{currentLabel}</h1>
                <p>Dados lidos da planilha selecionada; nenhum registro foi copiado para o repositório ou salvo em armazenamento local.</p>
              </div>
              <div className="private-heading-actions">
                <button type="button" className="private-button private-button-ghost" onClick={() => void refreshWorkbook()} disabled={busy}>
                  <RefreshCw size={15} className={busy ? 'private-spin' : ''} /> Atualizar
                </button>
                <button type="button" className="private-button private-button-ghost" onClick={exportCurrent}>
                  <Download size={15} /> Exportar visão
                </button>
              </div>
            </div>
            {error && <div className="private-alert private-alert-inline" role="alert"><AlertCircle size={17} />{error}</div>}
            {workbook.warnings.map((warning) => <div className="private-warning" key={warning}><AlertCircle size={15} />{warning}</div>)}
            <div className="private-filterbar">
              <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeView === 'contacts' ? 'Buscar cliente, nome, cargo ou e-mail' : 'Buscar gestor, colaborador, cliente ou fazenda'} /></label>
              {activeView !== 'contacts' && (
                <>
                  <label><span>Gestor</span><select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}><option value="">Todos</option>{managers.map((manager) => <option key={manager} value={manager}>{manager}</option>)}</select></label>
                  <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                </>
              )}
            </div>

            {activeView === 'overview' && (
              <>
                <section className="private-kpis">
                  <Kpi label="Projetos/unidades" value={numberLabel(filteredProjects.length)} note={`${numberLabel(collaboratorsCount)} colaboradores`} icon={<FileSpreadsheet size={18} />} />
                  <Kpi label="Área atendida" value={`${numberLabel(totalArea, 1)} ha`} note="soma dos registros filtrados" icon={<span className="private-kpi-letter">ha</span>} />
                  <Kpi label="ARR" value={currencyLabel(totalArr)} note="valor anual recorrente" icon={<span className="private-kpi-letter">R$</span>} />
                  <Kpi label="Valor total de contrato" value={currencyLabel(totalContractValue)} note="soma dos contratos filtrados" icon={<span className="private-kpi-letter">Σ</span>} />
                  <Kpi label="Vencimento em 90 dias" value={numberLabel(expiringProjects.length)} note={`${numberLabel(overdueCount)} vencidos ou em distrato`} icon={<CalendarClock size={18} />} alert={overdueCount > 0} />
                </section>
                <section className="private-overview-grid">
                  <article className="private-card private-attention-card">
                    <div className="private-card-heading"><div><span className="private-eyebrow">ACOMPANHAMENTO</span><h2>Fila de atenção</h2></div><span className="private-count-pill">{expiringProjects.length + overdueCount}</span></div>
                    {[...terminationProjects.slice(0, 3), ...expiringProjects.slice(0, 6)].slice(0, 7).map((project) => (
                      <div className="private-attention-row" key={project.key}>
                        <span className={`private-risk-dot ${contractTone(project)}`} />
                        <div><strong>{project.client} · {project.farm}</strong><small>{project.collaborator} · {project.manager}</small></div>
                        <span className={`private-risk-label ${contractTone(project)}`}>{project.termination ? 'Distrato' : renderDays(project)}</span>
                      </div>
                    ))}
                    {expiringProjects.length === 0 && terminationProjects.length === 0 && <p className="private-empty">Não há vencimentos em 90 dias nem distratos nesta seleção.</p>}
                    <button type="button" className="private-text-action" onClick={() => setActiveView('terminations')}>Abrir distratos e vencimentos <span>→</span></button>
                  </article>
                  <article className="private-card private-manager-chart">
                    <div className="private-card-heading"><div><span className="private-eyebrow">DESEMPENHO</span><h2>ARR por gestor</h2></div><span className="private-chart-unit">R$</span></div>
                    {managerSummary.slice(0, 8).map((manager) => (
                      <div className="private-bar-row" key={manager.manager}>
                        <span title={manager.manager}>{manager.manager}</span>
                        <div className="private-bar-track"><i style={{ width: `${Math.max(2, (manager.arr / maxManagerArr) * 100)}%` }} /></div>
                        <strong>{currencyLabel(manager.arr)}</strong>
                      </div>
                    ))}
                    {managerSummary.length === 0 && <p className="private-empty">Sem dados para esta seleção.</p>}
                  </article>
                  <article className="private-card private-pulse-card">
                    <div className="private-card-heading"><div><span className="private-eyebrow">PULSO DA OPERAÇÃO</span><h2>Status e acompanhamento</h2></div><span className="private-count-pill">{numberLabel(filteredProjects.length)} registros</span></div>
                    <div className="private-pulse-kpis">
                      <div><strong>{numberLabel(activeCount)}</strong><span>Status ativo</span></div>
                      <div><strong>{numberLabel(billedCount)}</strong><span>Com cobrança</span></div>
                      <div><strong>{numberLabel(terminationProjects.length)}</strong><span>Em distrato</span></div>
                      <div><strong>{numberLabel(missingContractDateCount)}</strong><span>Sem vencimento</span></div>
                    </div>
                    <div className="private-status-list">
                      {statusSummary.map(([status, count]) => (
                        <div className="private-status-row" key={status}>
                          <span title={status}>{status}</span>
                          <div className="private-bar-track"><i style={{ width: `${filteredProjects.length ? count / filteredProjects.length * 100 : 0}%` }} /></div>
                          <strong>{numberLabel(count)}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              </>
            )}

            {activeView === 'projects' && <ProjectTable projects={filteredProjects} />}
            {activeView === 'terminations' && <ProjectTable projects={visibleProjects} title="Distratos e encerramentos" />}
            {activeView === 'collaborators' && (
              <section className="private-card private-table-card">
                <div className="private-card-heading"><div><span className="private-eyebrow">CARTEIRA</span><h2>Resumo por colaborador</h2></div><span className="private-count-pill">{collaboratorSummary.length}</span></div>
                <div className="private-table-scroll"><table className="private-table"><thead><tr><th>Colaborador</th><th>Gestor</th><th>Projetos</th><th>Área (ha)</th><th>ARR</th><th>Distância média (km)</th><th>CB</th></tr></thead><tbody>
                  {collaboratorSummary.map((person) => <tr key={person.name}><td><strong>{person.name}</strong></td><td>{person.manager}</td><td>{numberLabel(person.projects)}</td><td>{numberLabel(person.area, 1)}</td><td>{currencyLabel(person.arr)}</td><td>{numberLabel(person.distances ? person.distance / person.distances : null, 1)}</td><td>{numberLabel(person.cb)}</td></tr>)}
                </tbody></table></div>
              </section>
            )}
            {activeView === 'managers' && (
              <section className="private-card private-table-card">
                <div className="private-card-heading"><div><span className="private-eyebrow">COBERTURA E CARTEIRA</span><h2>Mapa de performance dos gestores</h2></div><span className="private-count-pill">{managerSummary.length}</span></div>
                <div className="private-table-scroll"><table className="private-table"><thead><tr><th>Gestor</th><th>Área total (ha)</th><th>ARR total</th><th>Projetos</th><th>Com cobrança</th><th>Sem cobrança</th><th>% cobrança</th><th>Eficiência (ha/km)</th><th>Vencem em 90 dias</th><th>% distrato</th></tr></thead><tbody>
                  {managerSummary.map((manager) => {
                    const groupProjects = filteredProjects.filter((project) => project.manager === manager.manager)
                    const distance = groupProjects.reduce((sum, project) => sum + (project.distanceKm ?? 0), 0)
                    const billedPct = manager.count ? manager.billed / manager.count * 100 : 0
                    return <tr key={manager.manager}><td><strong>{manager.manager}</strong></td><td>{numberLabel(manager.area, 1)}</td><td>{currencyLabel(manager.arr)}</td><td>{numberLabel(manager.count)}</td><td>{numberLabel(manager.billed)}</td><td>{numberLabel(manager.count - manager.billed)}</td><td>{numberLabel(billedPct, 1)}%</td><td>{numberLabel(distance ? manager.area / distance : null, 2)}</td><td>{numberLabel(manager.expiring)}</td><td>{numberLabel(manager.count ? manager.termination / manager.count * 100 : 0, 1)}%</td></tr>
                  })}
                </tbody></table></div>
              </section>
            )}
            {activeView === 'equipment' && (
              <section className="private-equipment-grid">
                <article className="private-card private-equipment-summary">
                  <div className="private-card-heading"><div><span className="private-eyebrow">ESTRUTURA DE ATENDIMENTO</span><h2>Distribuição dos equipamentos</h2></div></div>
                  {equipmentSummary.map((item) => <div className="private-equipment-row" key={item.name}><span>{item.name}</span><div className="private-bar-track"><i style={{ width: `${filteredProjects.length ? Math.max(item.count ? 2 : 0, item.count / filteredProjects.length * 100) : 0}%` }} /></div><strong>{numberLabel(item.count)}</strong></div>)}
                </article>
                <ProjectTable projects={filteredProjects} title="Equipamentos por projeto" compact />
              </section>
            )}
            {activeView === 'contacts' && (
              <section className="private-card private-table-card">
                <div className="private-card-heading"><div><span className="private-eyebrow">DADOS PRIVADOS</span><h2>Contatos de clientes</h2></div><span className="private-count-pill">{filteredContacts.length}</span></div>
                <p className="private-contact-note"><ShieldCheck size={15} /> E-mails e telefones são carregados apenas após autorização Google e permanecem na sessão atual.</p>
                {!workbook.contactsAvailable ? <p className="private-empty">A aba de contatos não está disponível neste arquivo.</p> : (
                  <div className="private-table-scroll"><table className="private-table"><thead><tr><th>Vertical</th><th>Cliente</th><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>
                    {filteredContacts.map((contact, index) => <tr key={`${contact.client}|${contact.name}|${index}`}><td>{contact.vertical || '—'}</td><td>{contact.client || '—'}</td><td><strong>{contact.name || '—'}</strong></td><td>{contact.role || '—'}</td><td><a href={contact.email ? `mailto:${contact.email}` : undefined}>{contact.email || '—'}</a></td><td><a href={contact.phone ? `tel:${contact.phone}` : undefined}>{contact.phone || '—'}</a></td></tr>)}
                  </tbody></table></div>
                )}
              </section>
            )}
          </main>
          <footer className="private-footer"><span><span className="private-status-dot" /> Sessão Google ativa · {workbook.projects.length} registros de projetos</span><span>Os dados são consultados da planilha autorizada e não ficam salvos no site.</span></footer>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, note, icon, alert = false }: { label: string; value: string; note: string; icon: ReactNode; alert?: boolean }) {
  return <article className={`private-kpi ${alert ? 'is-alert' : ''}`}><div className="private-kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>
}

function ProjectTable({ projects, title = 'Carteira de projetos', compact = false }: { projects: PrivateProject[]; title?: string; compact?: boolean }) {
  return (
    <section className={`private-card private-table-card ${compact ? 'is-compact' : ''}`}>
      <div className="private-card-heading"><div><span className="private-eyebrow">CARTEIRA COMPLETA</span><h2>{title}</h2></div><span className="private-count-pill">{projects.length}</span></div>
      <div className="private-table-scroll"><table className="private-table"><thead><tr><th>Gestor</th><th>Colaborador</th><th>Cliente</th><th>Fazenda/unidade</th><th>Área (ha)</th><th>Status</th><th>Vencimento</th><th>Valor total</th><th>ARR</th><th>CB</th><th>Clima</th><th>Ponto focal</th><th>4G</th><th>Cobrança</th><th>Distrato</th></tr></thead><tbody>
        {projects.map((project) => <tr key={project.key}>
          <td>{project.manager}</td><td><strong>{project.collaborator}</strong></td><td>{project.client}</td><td>{project.farm}</td><td>{numberLabel(project.areaHa, 1)}</td>
          <td><span className={`private-status-pill ${contractTone(project)}`}>{project.status}</span></td><td><span className={`private-date ${contractTone(project)}`}>{dateLabel(project.contractEnd)}</span><small className="private-cell-sub">{renderDays(project)}</small></td>
          <td>{currencyLabel(project.contractValue)}</td><td>{currencyLabel(project.arr)}</td><td>{project.services.CB || '—'}</td><td>{project.services.Pluviômetro || project.services.Solinfnet || '—'}</td>
          <td>{project.services['Ponto focal'] || '—'}</td><td>{project.services['4G'] || '—'}</td><td>{project.charge}</td><td>{project.termination ? <span className="private-status-pill danger">Sim</span> : 'Não'}</td>
        </tr>)}
        {projects.length === 0 && <tr><td colSpan={15} className="private-empty-cell">Nenhum registro corresponde aos filtros.</td></tr>}
      </tbody></table></div>
    </section>
  )
}
