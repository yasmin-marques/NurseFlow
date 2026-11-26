import { Menu } from '../icons'
import { NotificationCenter } from './NotificationCenter'
import { UserAvatar } from '../ui/UserAvatar'

type TopBarProps = {
  userInitials?: string
  includeExchangeNotifications?: boolean
  onMenuClick?: () => void
  onProfileClick?: () => void
}

export function TopBar({
  userInitials = 'PF',
  includeExchangeNotifications = true,
  onMenuClick,
  onProfileClick,
}: TopBarProps) {
  return (
    <header className="flex h-[78px] shrink-0 items-center justify-between border-b border-border bg-page px-5 sm:px-7 lg:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-white/80 text-text shadow-sm md:hidden"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <Menu className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <NotificationCenter includeExchangeNotifications={includeExchangeNotifications} />
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Abrir meu perfil"
          title="Meu perfil"
          className="ml-1 flex size-9 items-center justify-center rounded-full shadow-sm transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UserAvatar initials={userInitials} sizeClassName="size-9" textClassName="text-[11px] font-bold text-primary" decorative />
        </button>
      </div>
    </header>
  )
}
