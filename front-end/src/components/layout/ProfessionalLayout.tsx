import type { ReactNode } from 'react'
import logo from '../../assets/logo.png'
import { NotificationCenter } from './NotificationCenter'
import { PROFESSIONAL_TABS, type ProfessionalTabId } from './professionalTabs'


type ProfessionalLayoutProps = {
  activeTab: ProfessionalTabId
  onNavigate: (id: ProfessionalTabId) => void
  onProfileClick: () => void
  user: { name: string; role: string; initials: string }
  children: ReactNode
}

/** Shell do Enfermeiro/Técnico: navegação no topo, sem as áreas de gestão da Coordenação. */
export function ProfessionalLayout({ activeTab, onNavigate, onProfileClick, user, children }: ProfessionalLayoutProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-page text-text">
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="mx-auto flex min-h-[74px] w-full max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2 sm:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-10 rounded-xl" />
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-tight">NurseFlow</p>
              <p className="text-xs text-text-muted">Gestão de escalas</p>
            </div>
          </div>

          <nav aria-label="Áreas do profissional" className="order-last -mb-2 flex w-full gap-1 overflow-x-auto md:order-none md:mb-0 md:w-auto md:flex-1 md:justify-center">
            {PROFESSIONAL_TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative flex h-[74px] shrink-0 items-center px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    active ? 'text-primary' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                  {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-primary" /> : null}
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <NotificationCenter />
            <button
              type="button"
              onClick={onProfileClick}
              aria-label={`Abrir meu perfil — ${user.name}, ${user.role}`}
              className="flex items-center gap-3 rounded-xl p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary">
                {user.initials}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[13px] font-semibold">{user.name}</span>
                <span className="block text-[11px] text-text-muted">{user.role}</span>
              </span>
            </button>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</main>
    </div>
  )
}
