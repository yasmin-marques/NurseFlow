import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '../icons'

interface DrawerProps {
  id: string
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  closeDisabled?: boolean
  hideHeader?: boolean
}

export function Drawer({ id, title, description, onClose, children, footer, closeDisabled = false, hideHeader = false }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)

  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  }, [closeDisabled, onClose])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) onCloseRef.current()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[3px]" aria-label="Fechar painel" onClick={() => { if (!closeDisabled) onClose() }} />
      <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(29rem,100vw)] flex-col border-l border-border bg-surface shadow-[-16px_0_48px_rgba(22,29,24,0.16)] outline-none animate-[drawer-in_180ms_ease-out]">
        {hideHeader ? <div className="sr-only"><h2 id={`${id}-title`}>{title}</h2>{description ? <p id={`${id}-description`}>{description}</p> : null}</div> : <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div><h2 id={`${id}-title`} className="text-base font-bold tracking-tight text-text">{title}</h2>{description ? <p id={`${id}-description`} className="mt-1 text-xs text-text-muted">{description}</p> : null}</div>
          <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Fechar" className="flex size-9 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-neutral disabled:opacity-50"><X className="size-4" /></button>
        </header>}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-border bg-surface px-5 py-4">{footer}</footer> : null}
      </section>
    </div>
  )
}
