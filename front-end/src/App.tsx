import { useEffect, useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { NAV_ITEMS, type NavItemId } from './components/layout/navItems'
import { OverviewPage } from './pages/Overview/OverviewPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { LoginPage } from './pages/Login/LoginPage'
import { currentUser, logout, type SessionUser } from './services/auth'
import { UNAUTHORIZED_EVENT } from './services/api'
import { DisponibilityPage } from './pages/Disponibility/DisponibilityPage'
import { Professional } from './pages/Professionals/Professionals';
import { SectorsPage } from './pages/Sectors/SectorsPage';

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [activeItem, setActiveItem] = useState<NavItemId>('visao-geral')
  const [searchQuery, setSearchQuery] = useState('')
  const activePage = NAV_ITEMS.find((item) => item.id === activeItem)

  const navigate = (id: NavItemId) => {
    setActiveItem(id)
    setSearchQuery('')
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

  const handleLogout = () => {
    logout()
    setUser(null)
    setActiveItem('visao-geral')
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

  return (
    <AppLayout
      title={activePage?.label ?? 'NurseFlow'}
      activeItem={activeItem}
      onNavigate={navigate}
      onSearchChange={setSearchQuery}
      user={{ name: user.nome, role, initials, isCoordination }}
      onLogout={handleLogout}
    >
      {activeItem === 'configuracoes' ? (
        <SettingsPage searchQuery={searchQuery} />
      ) : activeItem === 'visao-geral' ? (
        <OverviewPage />
      ) : activeItem === 'disponibilidade' ? (
        <DisponibilityPage />
      ) : activeItem === 'profissionais' && isCoordination ? (
          <Professional />
      ) : activeItem === 'setores' && isCoordination ? (
        <SectorsPage />
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
  )
}

export default App
