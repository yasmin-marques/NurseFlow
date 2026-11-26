import { useState, type ReactNode } from 'react'
import { SideMenu } from './SideMenu'
import { TopBar } from './TopBar'
import type { SideMenuUser } from './SideMenu'
import type { NavItemId } from './navItems'

type AppLayoutProps = {
  activeItem: NavItemId
  children: ReactNode
  onNavigate?: (id: NavItemId) => void
  onProfileClick?: () => void
  user?: SideMenuUser
  onLogout?: () => void
  exchangeCount?: number | null
}

export function AppLayout({
  activeItem,
  children,
  onNavigate,
  onProfileClick,
  user,
  onLogout,
  exchangeCount,
}: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page text-text">
      <SideMenu
        activeItem={activeItem}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
        onProfileClick={onProfileClick}
        user={user}
        exchangeCount={exchangeCount}
        onLogout={onLogout}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          userInitials={user?.initials}
          includeExchangeNotifications={user?.isCoordination === true}
          coordinationNotifications={user?.isCoordination === true}
          onMenuClick={() => setMenuOpen(true)}
          onProfileClick={onProfileClick}
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  )
}
