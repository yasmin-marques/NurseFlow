import { useState, type ReactNode } from 'react'
import { SideMenu } from './SideMenu'
import { TopBar } from './TopBar'
import type { NavItemId } from './navItems'

type AppLayoutProps = {
  title: string
  activeItem: NavItemId
  children: ReactNode
  onNavigate?: (id: NavItemId) => void
  onSearchChange?: (query: string) => void
}

export function AppLayout({
  title,
  activeItem,
  children,
  onNavigate,
  onSearchChange,
}: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-page text-text">
      <SideMenu
        activeItem={activeItem}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          key={title}
          title={title}
          onMenuClick={() => setMenuOpen(true)}
          onSearchChange={onSearchChange}
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</main>
      </div>
    </div>
  )
}
