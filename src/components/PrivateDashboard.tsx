import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { AlertCircle, ArrowLeft, BarChart3, Boxes, BriefcaseBusiness, CalendarClock, Download, FileSpreadsheet, LogOut, Moon, RefreshCw, Search, ShieldCheck, Sun, Trash2, Users } from 'lucide-react'
import { chooseSpreadsheet, GoogleApiError, missingGoogleConfiguration, signInWithGoogle } from '../lib/googleDrive'
import type { GoogleSession, PickedSpreadsheet } from '../lib/googleDrive'
import { loadPrivateWorkbook, parsePrivateProjectsFromRows } from '../data/privateSheets'
import type { PrivateContact, PrivateProject, PrivateWorkbook } from '../data/privateSheets'
import { EMPTY_PROJECT_FILTERS, filterProjects, formatRowForExport } from '../data/privateAnalytics'
import type { ProjectFilters } from '../data/privateAnalytics'
import OverviewPage from './private/OverviewPage'
import ProjectsPage from './private/ProjectsPage'
import CollaboratorsPage from './private/CollaboratorsPage'
import ManagersPage from './private/ManagersPage'
import EquipmentPage from './private/EquipmentPage'
import TerminationsPage from './private/TerminationsPage'
import { PageCard } from './private/shared'
import '../private.css'

type ViewKey = 'overview' | 'projects' | 'collaborators' | 'managers' | 'equipment' | 'terminations' | 'contacts'

const VIEWS: Array<{ id: ViewKey; label: string; icon: ReactNode; description: string }> = [
  { id: 'overview', label: 'Visão Geral', icon: <BarChart3 size={16} />, description: 'Visão completa da carteira, dos alertas e da operação.' },
  { id: 'projects', label: 'Projetos', icon: <BriefcaseBusiness size={16} />, description: 'Pesquise e cruze os registros da carteira com filtros combináveis.' },
  { id: 'collaborators', label: 'Colaboradores', icon: <Users size={16} />, description: 'Compare carteira, cobertura, área e indicadores por colaborador.' },
  { id: 'managers', label: 'Gestores', icon: <Users size={16} />, description: 'Acompanhe equipes, resultados, cobrança e vencimentos por gestor.' },
  { id: 'equipment', label: 'Equipamentos', icon: <Boxes size={16} />, description: 'Veja CBs e cobertura de equipamentos por projeto e responsável.' },
  { id: 'terminations', label: 'Distratos', icon: <CalendarClock size={16} />, description: 'Consulte somente os projetos marcados em processo de distrato.' },
  { id: 'contacts', label: 'Contatos / NPS', icon: <ShieldCheck size={16} />, description: 'Dados de contato protegidos, carregados apenas após autorização.' },
]

function safeRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value,
  ])))
}

async function downloadXlsx(filename: string, sheetName: string, rows: Array<Record<string, unknown>>): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(safeRows(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  XLSX.writeFile(workbook, filename, { compression: true })
}

function privateProjectRows(projects: PrivateProject[]): Array<Record<string, unknown>> {
  return projects.map(formatRowForExport)
}

function privateContactRows(contacts: PrivateContact[]): Array<Record<string, unknown>> {
  return contacts.map((contact) => ({
    Vertical: contact.vertical,
    Cliente: contact.client,
    Nome: contact.name,
    Cargo: contact.role,
    'E-mail': contact.email,
    Telefone: contact.phone,
  }))
}

export default function PrivateDashboard({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<GoogleSession | null>(null)
  const [pickedFile, setPickedFile] = useState<PickedSpreadsheet | null>(null)
  const [workbook, setWorkbook] = useState<PrivateWorkbook | null>(null)
  const [localProjects, setLocalProjects] = useState<PrivateProject[] | null>(null)
  const [localFileName, setLocalFileName] = useState('')
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [projectFilters, setProjectFilters] = useState<ProjectFilters>({ ...EMPTY_PROJECT_FILTERS })
  const [contactSearch, setContactSearch] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const localFileInput = useRef<HTMLInputElement>(null)
  const missingConfig = missingGoogleConfiguration()
  const projects = localProjects ?? workbook?.projects ?? []
  const filteredProjects = useMemo(() => filterProjects(projects, projectFilters), [projects, projectFilters])
  const filteredContacts = useMemo(() => {
    const query = normalize(contactSearch)
    return (workbook?.contacts ?? []).filter((contact) => !query || [contact.vertical, contact.client, contact.name, contact.role, contact.email, contact.phone].some((value) => normalize(value).includes(query)))
  }, [contactSearch, workbook])
  const currentView = VIEWS.find((view) => view.id === activeView) ?? VIEWS[0]

  const loadSelected = async (file: PickedSpreadsheet, accessToken: string) => {
    setBusy(true)
    setError('')
    try {
      const result = await loadPrivateWorkbook(accessToken, file.id)
      setPickedFile(file)
      setWorkbook(result)
      setLocalProjects(null)
      setLocalFileName('')
      setProjectFilters({ ...EMPTY_PROJECT_FILTERS })
      setActiveView('overview')
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
        setLocalProjects(null)
        setError('A sessão Google expirou. Entre novamente para continuar.')
      } else {
        setError(pickerError instanceof Error ? pickerError.message : 'Não foi possível abrir o seletor Google Drive.')
      }
    } finally {
      setBusy(false)
    }
  }

  const refreshWorkbook = async () => {
    if (!session || !pickedFile) return
    setLocalProjects(null)
    setLocalFileName('')
    await loadSelected(pickedFile, session.accessToken)
  }

  const signOut = () => {
    setSession(null)
    setPickedFile(null)
    setWorkbook(null)
    setLocalProjects(null)
    setLocalFileName('')
    setProjectFilters({ ...EMPTY_PROJECT_FILTERS })
    setContactSearch('')
    setActiveView('overview')
    setError('')
  }

  const clearSessionData = () => {
    if (!window.confirm('Limpar os dados carregados desta sessão? A planilha Google não será alterada.')) return
    setWorkbook(null)
    setPickedFile(null)
    setLocalProjects(null)
    setLocalFileName('')
    setProjectFilters({ ...EMPTY_PROJECT_FILTERS })
    setContactSearch('')
    setActiveView('overview')
    setError('')
  }

  const importLocalWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const imported = XLSX.read(buffer, { type: 'array', cellDates: true })
      const projectSheetName = imported.SheetNames.find((name) => normalize(name) === 'projetos') ?? imported.SheetNames[0]
      const sheet = imported.Sheets[projectSheetName]
      if (!sheet) throw new Error('O arquivo não contém uma aba legível com projetos.')
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][]
      const parsed = parsePrivateProjectsFromRows(matrix)
      if (!parsed.length) throw new Error('Não encontrei linhas operacionais reconhecíveis na aba Projetos.')
      setLocalProjects(parsed)
      setLocalFileName(file.name)
      setProjectFilters({ ...EMPTY_PROJECT_FILTERS })
      setActiveView('overview')
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Não foi possível ler o arquivo XLSX.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const exportProjects = async (rows: PrivateProject[], name = 'AgroScope-projetos.xlsx') => {
    await downloadXlsx(name, 'Projetos', privateProjectRows(rows))
  }

  const exportFilteredProjects = async (rows: PrivateProject[]) => {
    if (!rows.length) {
      window.alert('Nenhum projeto encontrado para os filtros atuais.')
      return
    }
    const rangeLabels: Record<string, string> = {
      critical: 'Pendências críticas (risco ou distrato)',
      expired: 'Crítico / vencido',
      risk: 'Risco próximo (até 180 dias ou vencidos)',
      moderate: 'Atenção moderada (181 a 365 dias)',
      '30': 'Até 30 dias',
      '90': 'Até 90 dias',
      '180': 'Até 180 dias',
      '365': 'Até 1 ano',
      healthy: 'Acima de 1 ano',
      missing: 'Sem data',
    }
    const issueLabels: Record<string, string> = {
      'missing-service': 'Cobrança indefinida',
      'missing-arr': 'Sem ARR',
      'missing-farm': 'Sem fazenda',
    }
    const filterSummary = [
      { Filtro: 'Busca', Valor: projectFilters.search || 'Todos' },
      { Filtro: 'Gestor', Valor: projectFilters.manager || 'Todos' },
      { Filtro: 'Regional', Valor: projectFilters.region || 'Todos' },
      { Filtro: 'Status', Valor: projectFilters.status || 'Todos' },
      { Filtro: 'Cobrança de serviço', Valor: projectFilters.charge || 'Todos' },
      { Filtro: 'Ponto focal', Valor: projectFilters.focal ? (projectFilters.focal === 'SIM' ? 'Com ponto focal' : 'Sem ponto focal') : 'Todos' },
      { Filtro: '4G', Valor: projectFilters.fourG ? (projectFilters.fourG === 'SIM' ? 'Com 4G' : 'Sem 4G / não informado') : 'Todos' },
      { Filtro: 'Distrato', Valor: projectFilters.termination ? (projectFilters.termination === 'SIM' ? 'Em distrato' : 'Fora de distrato') : 'Todos' },
      { Filtro: 'Vencimento', Valor: rangeLabels[projectFilters.contractRange] || 'Todos' },
      { Filtro: 'Qualidade dos dados', Valor: issueLabels[projectFilters.dataIssue] || 'Todos' },
      { Filtro: 'Registros exportados', Valor: rows.length },
      { Filtro: 'Exportado em', Valor: new Date().toLocaleString('pt-BR') },
    ]
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const filtersSheet = XLSX.utils.json_to_sheet(safeRows(filterSummary))
    filtersSheet['!cols'] = [{ wch: 24 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(workbook, filtersSheet, 'Filtros')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(safeRows(privateProjectRows(rows))), 'Projetos')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `AgroScope-projetos-filtrados-${date}.xlsx`, { compression: true })
  }

  const exportCurrent = () => {
    if (activeView === 'contacts') {
      void downloadXlsx('AgroScope-contatos-nps.xlsx', 'Contatos', privateContactRows(filteredContacts))
      return
    }
    if (activeView === 'projects') {
      void exportFilteredProjects(filteredProjects)
      return
    }
    const rows = activeView === 'terminations' ? projects.filter((project) => project.termination) : projects
    void exportProjects(rows, activeView === 'terminations' ? 'AgroScope-distratos.xlsx' : 'AgroScope-visao-geral.xlsx')
  }

  const openProjects = (preset: Partial<ProjectFilters> = {}) => {
    setProjectFilters({ ...EMPTY_PROJECT_FILTERS, ...preset })
    setActiveView('projects')
  }

  return (
    <div className={`private-shell ${theme === 'dark' ? 'is-dark' : ''}`}>
      <header className="private-topbar">
        <div className="private-brand">
          <div className="private-brand-mark" aria-hidden="true">A</div>
          <div><strong>AgroScope</strong><span>RADAR OPERACIONAL · ÁREA PRIVADA</span></div>
        </div>
        <div className="private-top-actions">
          {session && <span className="private-identity"><ShieldCheck size={14} /> {session.email}</span>}
          {session && workbook && <button type="button" className="private-button private-button-ghost" onClick={selectFile} disabled={busy}><FileSpreadsheet size={15} /> Selecionar planilha</button>}
          {session && workbook && <button type="button" className="private-icon-button" onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')} title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>}
          {session && workbook && <button type="button" className="private-icon-button" onClick={clearSessionData} title="Limpar dados carregados desta sessão" aria-label="Limpar dados carregados desta sessão"><Trash2 size={16} /></button>}
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
            {missingConfig.length > 0 && <div className="private-setup-note"><strong>Configuração Google pendente</strong><p>Antes do login funcionar, configure no build do Pages:</p><code>{missingConfig.join(' · ')}</code><p>As instruções estão no README do repositório. Não coloque o segredo de cliente OAuth no código; o Client ID e a chave do Picker são identificadores públicos e devem ter origens/APIs restritas.</p></div>}
            <button type="button" className="private-button private-button-primary private-login-button" onClick={() => void signIn()} disabled={busy || missingConfig.length > 0}>{busy ? <RefreshCw size={16} className="private-spin" /> : <ShieldCheck size={16} />}{busy ? 'Conectando…' : 'Acessar com Google'}</button>
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
            <p>Conta conectada: <strong>{session.email}</strong>. Escolha no Drive a planilha <strong>AgroScope - Base Operacional</strong>; a conta precisa ter permissão de leitura autorizada pelo proprietário.</p>
            {error && <div className="private-alert" role="alert"><AlertCircle size={17} />{error}</div>}
            <button type="button" className="private-button private-button-primary private-login-button" onClick={() => void selectFile()} disabled={busy}>{busy ? <RefreshCw size={16} className="private-spin" /> : <FileSpreadsheet size={16} />}{busy ? 'Carregando…' : 'Escolher planilha no Google Drive'}</button>
          </section>
        </main>
      ) : (
        <>
          <nav className="private-nav" aria-label="Seções da área de gestores">
            {VIEWS.map((view) => <button type="button" key={view.id} className={activeView === view.id ? 'is-active' : ''} onClick={() => setActiveView(view.id)}>
              {view.icon}{view.label}{view.id === 'contacts' && <span className="private-nav-count">{workbook.contacts.length}</span>}{view.id === 'projects' && <span className="private-nav-count">{projects.length}</span>}
            </button>)}
          </nav>
          <main className="private-main">
            <div className="private-heading-row">
              <div><span className="private-eyebrow">BASE PRIVADA · {workbook.title}</span><h1>{currentView.label}</h1><p>{currentView.description} Atualizada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(workbook.loadedAt)}.</p></div>
              <div className="private-heading-actions">
                <button type="button" className="private-button private-button-ghost" onClick={() => void refreshWorkbook()} disabled={busy}><RefreshCw size={15} className={busy ? 'private-spin' : ''} /> Atualizar</button>
                <button type="button" className="private-button private-button-ghost" onClick={() => localFileInput.current?.click()} disabled={busy}><FileSpreadsheet size={15} /> Importar XLSX</button>
                <button type="button" className="private-button private-button-ghost" onClick={exportCurrent}><Download size={15} /> Exportar visão</button>
                <input ref={localFileInput} className="private-visually-hidden" type="file" accept=".xlsx,.xls,.xlsm" onChange={(event) => void importLocalWorkbook(event)} />
              </div>
            </div>
            {localFileName && <div className="private-warning"><AlertCircle size={15} /> Visualização temporária de <strong>{localFileName}</strong>; não altera nem sincroniza a planilha Google. Use Atualizar para voltar à fonte autorizada.</div>}
            {error && <div className="private-alert private-alert-inline" role="alert"><AlertCircle size={17} />{error}</div>}
            {workbook.warnings.map((warning) => <div className="private-warning" key={warning}><AlertCircle size={15} />{warning}</div>)}

            {activeView === 'overview' && <OverviewPage projects={projects} onOpenProjects={openProjects} onOpenTerminations={() => setActiveView('terminations')} />}
            {activeView === 'projects' && <ProjectsPage projects={projects} filters={projectFilters} onFiltersChange={setProjectFilters} onClear={() => setProjectFilters({ ...EMPTY_PROJECT_FILTERS })} onExport={exportFilteredProjects} />}
            {activeView === 'collaborators' && <CollaboratorsPage projects={projects} onExport={(rows) => exportProjects(rows, 'AgroScope-colaboradores.xlsx')} />}
            {activeView === 'managers' && <ManagersPage projects={projects} onOpenProjects={openProjects} />}
            {activeView === 'equipment' && <EquipmentPage projects={projects} onExport={(rows) => exportProjects(rows, 'AgroScope-equipamentos.xlsx')} />}
            {activeView === 'terminations' && <TerminationsPage projects={projects} onExport={(rows) => exportProjects(rows, 'AgroScope-distratos.xlsx')} />}
            {activeView === 'contacts' && <ContactsPage workbook={workbook} contacts={filteredContacts} search={contactSearch} onSearch={setContactSearch} onExport={() => downloadXlsx('AgroScope-contatos-nps.xlsx', 'Contatos', privateContactRows(filteredContacts))} />}
          </main>
          <footer className="private-footer"><span><span className="private-status-dot" /> Sessão Google ativa · {projects.length} registros de projetos</span><span>{localFileName ? 'Arquivo local carregado somente em memória.' : 'Dados consultados da planilha autorizada e mantidos somente na sessão.'}</span></footer>
        </>
      )}
    </div>
  )
}

function ContactsPage({ workbook, contacts, search, onSearch, onExport }: { workbook: PrivateWorkbook; contacts: PrivateContact[]; search: string; onSearch: (value: string) => void; onExport: () => void }) {
  return (
    <section className="private-page-stack">
      <PageCard className="private-filterbar">
        <label className="private-search"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar cliente, nome, cargo ou e-mail" /></label>
        <button type="button" className="private-button private-button-ghost" onClick={onExport}><Download size={15} /> Exportar contatos</button>
      </PageCard>
      <PageCard className="private-table-card">
        <div className="private-card-heading"><div><span className="private-eyebrow">DADOS PRIVADOS</span><h2>Contatos de clientes</h2></div><span className="private-count-pill">{contacts.length}</span></div>
        <p className="private-contact-note"><ShieldCheck size={15} /> E-mails e telefones são carregados apenas após autorização Google e permanecem na sessão atual.</p>
        {!workbook.contactsAvailable ? <p className="private-empty">A aba de contatos não está disponível neste arquivo.</p> : <div className="private-table-scroll"><table className="private-table private-table-dense"><thead><tr><th>Vertical</th><th>Cliente</th><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>
          {contacts.map((contact, index) => <tr key={`${contact.client}|${contact.name}|${index}`}><td>{contact.vertical || '—'}</td><td>{contact.client || '—'}</td><td><strong>{contact.name || '—'}</strong></td><td>{contact.role || '—'}</td><td><a href={contact.email ? `mailto:${contact.email}` : undefined}>{contact.email || '—'}</a></td><td><a href={contact.phone ? `tel:${contact.phone}` : undefined}>{contact.phone || '—'}</a></td></tr>)}
          {!contacts.length && <tr><td colSpan={6} className="private-empty-cell">Nenhum contato para a busca atual.</td></tr>}
        </tbody></table></div>}
      </PageCard>
    </section>
  )
}

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}
