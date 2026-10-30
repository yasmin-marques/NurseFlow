import { ChevronRight, LogOut } from '../icons'
import { NAV_ITEMS, type NavItemId } from './navItems'
import logo from '../../assets/logo.png'

export type SideMenuUser = {
  name: string
  role: string
  initials: string
  isCoordination?: boolean
}

type SideMenuProps = {
  activeItem: NavItemId
  isOpen?: boolean
  onClose?: () => void
  onNavigate?: (id: NavItemId) => void
  onProfileClick?: () => void
  onLogout?: () => void
  user?: SideMenuUser
}

/** Páginas de gestão restritas à Coordenação (o back-end também bloqueia o acesso). */
const COORDINATION_ONLY: NavItemId[] = ['profissionais', 'setores', 'disponibilidade', 'configuracoes']

const DEFAULT_USER: SideMenuUser = {
  name: 'Paloma Ferreira',
  role: 'Coordenação',
  initials: 'PF',
}

export function SideMenu({
  activeItem,
  isOpen = false,
  onClose,
  onNavigate,
  onProfileClick,
  onLogout,
  user = DEFAULT_USER,
}: SideMenuProps) {
  const items = NAV_ITEMS.filter(
    (item) => item.id !== 'configuracoes' && (user.isCoordination !== false || !COORDINATION_ONLY.includes(item.id)),
  )
  const settingsItem = user.isCoordination !== false ? NAV_ITEMS.find((item) => item.id === 'configuracoes') : undefined

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon
    const isActive = item.id === activeItem

    return (
      <li key={item.id}>
        <a
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            onNavigate?.(item.id)
            onClose?.()
          }}
          className={`flex h-[42px] items-center gap-2.5 overflow-hidden rounded-xl px-3 text-[14px] transition-all duration-200 ${
            isActive
              ? 'bg-secondary font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(46,120,61,0.04)]'
              : 'font-medium text-text hover:bg-neutral'
          }`}
        >
          <Icon
            className={`size-[17px] shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}`}
            strokeWidth={1.9}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="flex size-[18px] items-center justify-center rounded-full bg-badge-red text-[9px] font-semibold text-badge-red-text">
              {item.badge}
            </span>
          ) : null}
        </a>
      </li>
    )
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 md:hidden"
          aria-label="Fechar menu"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[250px] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar shadow-[6px_0_24px_rgba(22,29,24,0.04)] md:static md:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } transition-transform duration-200`}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <img src={logo} alt="NurseFlow" className="size-10 shrink-0 object-contain" />
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-text">NurseFlow</p>
            <p className="text-[10.5px] text-text-muted">Gestão de escalas</p>
          </div>
        </div>

        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold tracking-[0.12em] text-text-muted">
          GESTÃO
        </p>

        <nav className="flex-1 overflow-y-auto px-2" aria-label="Navegação principal">
          <ul className="flex flex-col gap-1">{items.map(renderItem)}</ul>
          {settingsItem ? (
            <div className="mt-3 border-t border-border pt-3">
              <ul className="flex flex-col gap-1">{renderItem(settingsItem)}</ul>
            </div>
          ) : null}
        </nav>

        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => {
              onProfileClick?.()
              onClose?.()
            }}
            title="Meu perfil"
            aria-label={`Abrir perfil de ${user.name}`}
            aria-current={activeItem === 'perfil' ? 'page' : undefined}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(16,24,16,0.03)] transition-colors ${
              activeItem === 'perfil'
                ? 'border-primary/20 bg-secondary'
                : 'border-border bg-white hover:bg-neutral'
            }`}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[12px] font-bold text-primary shadow-[inset_0_0_0_1px_rgba(46,120,61,0.08)]">
              {user.initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-text">{user.name}</span>
              <span className="mt-1 block truncate text-[10px] text-text-muted">{user.role}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-text-muted" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Sair da sessão"
            aria-label="Sair da sessão"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-text-muted transition-colors hover:bg-neutral hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LogOut className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </aside>
    </>
  )
}
