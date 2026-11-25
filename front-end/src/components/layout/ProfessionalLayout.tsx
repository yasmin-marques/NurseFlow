import { useCallback, useEffect, useState, type ReactNode } from 'react'
import logo from '../../assets/logo.png'
import { NotificationCenter } from './NotificationCenter'
import { PROFESSIONAL_TABS, type ProfessionalTabId } from './professionalTabs'
import { getIncomingExchangeCount } from '../../services/my-shifts'
import { UserAvatar } from '../ui/UserAvatar'
import { CountBadge } from '../ui/CountBadge'


type ProfessionalLayoutProps = {
  activeTab: ProfessionalTabId
  onNavigate: (id: ProfessionalTabId) => void
  onProfileClick: () => void
  onOpenExchange?: (id: string) => void
  user: { name: string; role: string; initials: string }
  children: ReactNode
}

/** Shell do Enfermeiro/Técnico: navegação no topo, sem as áreas de gestão da Coordenação. */
export function ProfessionalLayout({ activeTab, onNavigate, onProfileClick, onOpenExchange, user, children }: ProfessionalLayoutProps) {
  const [incomingCount, setIncomingCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)
  const refreshCount = useCallback(() => {
    getIncomingExchangeCount().then(({ recebidas }) => { setIncomingCount(recebidas); setCountError(false) }).catch(() => { setIncomingCount(null); setCountError(true) })
  }, [])
  useEffect(() => {
    refreshCount()
    window.addEventListener('nurseflow:professional-exchanges-updated', refreshCount)
    window.addEventListener('focus', refreshCount)
    return () => { window.removeEventListener('nurseflow:professional-exchanges-updated', refreshCount); window.removeEventListener('focus', refreshCount) }
  }, [refreshCount])
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-page text-text">
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="mx-auto flex min-h-18.5 w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2 sm:px-8">
          <button
            type="button"
            onClick={() => onNavigate('inicio')}
            aria-label="Ir para a visão geral"
            className="flex cursor-pointer items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img src={logo} alt="" className="size-10 rounded-xl" />
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-tight">NurseFlow</p>
              <p className="text-xs text-text-muted">Gestão de escalas</p>
            </div>
          </button>

          <nav aria-label="Áreas do profissional" className="order-last -mb-2 flex w-full justify-between gap-0 md:order-0 md:mb-0 md:w-auto md:flex-1 md:justify-center md:gap-1">
            {PROFESSIONAL_TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  aria-label={tab.id === 'trocas' && incomingCount !== null && incomingCount > 0 ? `${tab.label} ${incomingCount}` : tab.label}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative flex h-14 min-w-0 flex-1 items-center justify-center px-1 text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-2 sm:text-xs md:h-18.5 md:flex-none md:px-4 md:text-[13px] ${
                    active ? 'text-primary' : 'text-text-muted hover:text-text'
                  }`}
                >
                  <span className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
                    <span className="min-w-0 whitespace-normal text-center leading-tight">{tab.label}</span>
                    {tab.id === 'trocas' && incomingCount !== null && incomingCount !== undefined ? <CountBadge count={incomingCount} /> : null}
                  </span>
                  {tab.id === 'trocas' && countError ? <span className="sr-only">, contagem indisponível</span> : null}
                  {tab.id === 'trocas' && incomingCount === 0 ? <span className="sr-only">, nenhuma solicitação aguardando resposta</span> : null}
                  {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.75 rounded-t bg-primary" /> : null}
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <NotificationCenter onOpenExchange={onOpenExchange} />
            <button
              type="button"
              onClick={onProfileClick}
              aria-label={`Abrir meu perfil — ${user.name}, ${user.role}`}
              className="flex items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <UserAvatar initials={user.initials} sizeClassName="size-9" textClassName="text-[11px] font-bold text-primary" decorative />
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
