import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { NAV_ITEMS, type NavItemId } from './components/layout/navItems'
import { OverviewPage } from './pages/Overview/OverviewPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { LoginPage } from './pages/Login/LoginPage'
import type { LoginFormValues, LoginProfile } from './pages/Login/types'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [activeItem, setActiveItem] = useState<NavItemId>('visao-geral')
  const [searchQuery, setSearchQuery] = useState('')
  const activePage = NAV_ITEMS.find((item) => item.id === activeItem)

  const navigate = (id: NavItemId) => {
    setActiveItem(id)
    setSearchQuery('')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLogin = (_profile: LoginProfile, _values: LoginFormValues) => {
    setAuthenticated(true)
  }

  if (!authenticated) return <LoginPage onLogin={handleLogin} />

  return (
    <AppLayout
      title={activePage?.label ?? 'NurseFlow'}
      activeItem={activeItem}
      onNavigate={navigate}
      onSearchChange={setSearchQuery}
    >
      {activeItem === 'configuracoes' ? (
        <SettingsPage searchQuery={searchQuery} />
      ) : activeItem === 'visao-geral' ? (
        <OverviewPage />
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
