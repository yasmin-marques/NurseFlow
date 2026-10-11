import { useEffect, useRef, useState } from 'react'
import { Bell, Menu, Search, X } from '../icons'

type TopBarProps = {
  title: string
  userInitials?: string
  onMenuClick?: () => void
  onSearchChange?: (query: string) => void
}

export function TopBar({
  title,
  userInitials = 'PF',
  onMenuClick,
  onSearchChange,
}: TopBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchQuery('')
    onSearchChange?.('')
  }

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-page px-5 sm:px-7 lg:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-white/80 text-text shadow-sm md:hidden"
          aria-label="Abrir menu"
          onClick={onMenuClick}
        >
          <Menu className="size-4" strokeWidth={1.8} />
        </button>
        <h1 className="text-[20px] font-bold leading-none tracking-[-0.03em] text-text">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="search"
          className={`flex h-10 shrink-0 items-center overflow-hidden rounded-xl border transition-[width,background-color,box-shadow] duration-300 ease-out ${
            isSearchOpen
              ? 'w-[min(20rem,50vw)] border-border bg-white pl-3 pr-1 shadow-[0_8px_24px_rgba(22,29,24,0.08)]'
              : 'w-10 border-transparent bg-transparent'
          }`}
        >
          {isSearchOpen ? (
            <>
              <Search className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  onSearchChange?.(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch()
                }}
                placeholder={`Procurar em ${title}...`}
                aria-label={`Procurar em ${title}`}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 text-[13px] text-text outline-none placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-page hover:text-text"
                aria-label="Fechar pesquisa"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white/80 text-text-muted shadow-sm transition-all duration-200 hover:bg-white hover:text-primary hover:shadow-md"
              aria-label="Abrir pesquisa"
              aria-expanded={false}
            >
              <Search className="size-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white/80 text-text-muted shadow-sm transition-colors hover:bg-white"
          aria-label="Notificações"
        >
          <Bell className="size-4" strokeWidth={1.8} />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-danger" aria-hidden />
        </button>
        <span
          className="ml-1 flex size-10 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary shadow-sm"
          aria-hidden
        >
          {userInitials}
        </span>
      </div>
    </header>
  )
}
