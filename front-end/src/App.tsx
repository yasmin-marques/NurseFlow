import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { NAV_ITEMS, type NavItemId } from './components/layout/navItems'
import { OverviewPage } from './pages/Overview/OverviewPage'
import { CoordinationOverviewPage } from './pages/Overview/CoordinationOverviewPage'
import { ProfessionalOverviewPage } from './pages/Overview/ProfessionalOverviewPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { LoginPage } from './pages/Login/LoginPage'
import { currentUser, logout, type SessionUser } from './services/auth'
import { UNAUTHORIZED_EVENT } from './services/api'
import { DisponibilityPage } from './pages/Disponibility/DisponibilityPage'
import { Professional } from './pages/Professionals/Professionals';
import { SectorsPage } from './pages/Sectors/SectorsPage';
import { ScalePage } from './pages/Scale/ScalePage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { ExchangesPage } from './pages/Exchanges/ExchangesPage'
import { ProfessionalLayout } from './components/layout/ProfessionalLayout'
import type { ProfessionalTabId } from './components/layout/professionalTabs'
import { MyShiftsPage } from './pages/MyShifts/MyShiftsPage'
import { GeneralSchedulePage } from './pages/GeneralSchedule/GeneralSchedulePage'
import { api } from './services/api'
import { ExtrasPage } from './pages/Extras/ExtrasPage'
import { HistoryPage } from './pages/History/HistoryPage'
import { MyExchangesPage } from './pages/Exchanges/MyExchangesPage'
import { NotificationsPage } from './pages/Notifications/NotificationsPage'

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeItem, setActiveItem] = useState<NavItemId>(() =>
    window.location.pathname === '/extras' ? 'extras' : 'visao-geral',
  )
  const [exchangeCount, setExchangeCount] = useState<number | null>(null)
  // Ao voltar do consentimento do Google (?google_agenda=...), abre direto em "Meus plantões".
  const [professionalTab, setProfessionalTab] = useState<ProfessionalTabId>(() =>
    new URLSearchParams(window.location.search).has('google_agenda') ? 'meus-plantoes' : 'inicio',
  )
  const [exchangeIdToOpen, setExchangeIdToOpen] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(() => window.location.pathname === '/perfil')
  const activePage = NAV_ITEMS.find((item) => item.id === activeItem)

  const navigate = (id: NavItemId) => {
    setActiveItem(id)
  }

  const openProfile = () => setProfileOpen(true)
  const closeProfile = () => {
    setProfileOpen(false)
    if (window.location.pathname === '/perfil') window.history.replaceState({}, '', '/')
  }

  useEffect(() => {
    currentUser()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setCheckingSession(false))
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  useEffect(() => {
    if (!user || user.perfil !== 'coordenacao') return
    const loadCount = () => api<{ contadores: { aguardandoCoordenacao: number } }>('/trocas?status=pendentes&pagina=1&limite=1')
      .then((result) => setExchangeCount(result.contadores.aguardandoCoordenacao))
      .catch(() => setExchangeCount(null))
    void loadCount()
    window.addEventListener('nurseflow:trocas-updated', loadCount)
    return () => window.removeEventListener('nurseflow:trocas-updated', loadCount)
  }, [user])

  const handleLogout = () => {
    logout()
    setUser(null)
    setActiveItem('visao-geral')
    setProfessionalTab('inicio')
  }

  if (checkingSession) return null
  if (!user) return <LoginPage onLogin={setUser} />

  const initials = user.nome
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const isCoordination = user.perfil === 'coordenacao'
  const role = { coordenacao: 'Coordenação', enfermeiro: 'Enfermeiro', tecnico: 'Técnico' }[user.perfil] ?? user.perfil

  if (!isCoordination) {
    return (
      <>
        <ProfessionalLayout
          activeTab={professionalTab}
          onNavigate={setProfessionalTab}
          onOpenExchange={(id) => { setExchangeIdToOpen(id); setProfessionalTab('trocas') }}
          onOpenNotifications={() => setProfessionalTab('notificacoes')}
          onProfileClick={openProfile}
          user={{ name: user.nome, role, initials }}
        >
          {professionalTab === 'inicio' ? (
            <ProfessionalOverviewPage
              userName={user.nome.split(/\s+/)[0]}
              onNavigate={setProfessionalTab}
              onOpenGoogleCalendar={() => setProfessionalTab('meus-plantoes')}
            />
          ) : professionalTab === 'meus-plantoes' ? (
            <MyShiftsPage />
          ) : professionalTab === 'escala-geral' ? (
            <GeneralSchedulePage />
          ) : professionalTab === 'trocas' && ['enfermeiro', 'tecnico'].includes(user.perfil) ? (
            <MyExchangesPage exchangeId={exchangeIdToOpen} />
          ) : professionalTab === 'notificacoes' ? (
            <NotificationsPage onOpenExchange={(id) => { setExchangeIdToOpen(id); setProfessionalTab('trocas') }} />
          ) : professionalTab === 'trocas' ? (
            <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-text">Trocas</h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-text-muted">Esta área ainda está sendo preparada.</p>
            </section>
          ) : (
            <OverviewPage />
          )}
        </ProfessionalLayout>
        {profileOpen ? (
          <ProfilePage user={user} onClose={closeProfile} onUserUpdated={setUser} onLogout={handleLogout} />
        ) : null}
      </>
    )
  }

  return (
    <>
      <AppLayout
        activeItem={activeItem}
        onNavigate={navigate}
        onProfileClick={openProfile}
        user={{ name: user.nome, role, initials, isCoordination }}
        onLogout={handleLogout}
        exchangeCount={isCoordination ? exchangeCount : null}
      >
        {activeItem === 'configuracoes' && isCoordination ? (
          <SettingsPage />
        ) : activeItem === 'visao-geral' && isCoordination ? (
          <CoordinationOverviewPage userName={user.nome.split(/\s+/)[0]} onNavigate={navigate} />
        ) : activeItem === 'visao-geral' ? (
          <OverviewPage />
        ) : activeItem === 'disponibilidade' && isCoordination ? (
          <DisponibilityPage />
        ) : activeItem === 'profissionais' && isCoordination ? (
            <Professional />
        ) : activeItem === 'setores' && isCoordination ? (
          <SectorsPage />
        ) : activeItem === 'escala' && isCoordination ? (
          <ScalePage />
        ) : activeItem === 'trocas' && isCoordination ? (
          <ExchangesPage onCountChange={setExchangeCount} />
        ) : activeItem === 'extras' && isCoordination ? (
          <ExtrasPage />
        ) : activeItem === 'historico' && isCoordination ? (
          <HistoryPage />
        ) : (
          <section className="mx-auto flex min-h-full w-full max-w-5xl items-center px-5 py-10 sm:px-8">
            <div className="w-full rounded-3xl border border-border bg-white p-8 shadow-(--shadow-soft) sm:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
                NurseFlow
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-text">
                {activePage?.label}
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-text-muted">
                Esta área ainda está sendo preparada. A página de configurações está disponível pelo
                menu lateral.
              </p>
            </div>
          </section>
        )}
      </AppLayout>
      {profileOpen ? (
        <ProfilePage user={user} onClose={closeProfile} onUserUpdated={setUser} onLogout={handleLogout} />
      ) : null}
    </>
  )
}

export default App
