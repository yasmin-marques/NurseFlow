import { useState, type ReactNode } from 'react'
import { SideMenu } from './SideMenu'
import { TopBar } from './TopBar'
import type { SideMenuUser } from './SideMenu'
import type { NavItemId } from './navItems'

type AppLayoutProps = {
  title: string
  activeItem: NavItemId
  children: ReactNode
  onNavigate?: (id: NavItemId) => void
  onSearchChange?: (query: string) => void
  onProfileClick?: () => void
  user?: SideMenuUser
  onLogout?: () => void
}

export function AppLayout({
  title,
  activeItem,
  children,
  onNavigate,
  onSearchChange,
  onProfileClick,
  user,
  onLogout,
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
        onLogout={onLogout}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          key={title}
          title={title}
          userInitials={user?.initials}
          onMenuClick={() => setMenuOpen(true)}
          onProfileClick={onProfileClick}
          onSearchChange={onSearchChange}
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  )
}
