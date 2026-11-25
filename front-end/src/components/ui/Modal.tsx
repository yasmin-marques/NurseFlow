import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  id: string
  /** Nome acessível do diálogo. */
  label?: string
  labelledBy?: string
  onClose: () => void
  escapeDisabled?: boolean
  /** Largura máxima do painel (classe Tailwind). */
  widthClassName?: string
  /** Cabeçalho fixo (fica visível enquanto o corpo rola). */
  header: ReactNode
  children: ReactNode
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** Diálogo centralizado com cabeçalho fixo e corpo rolável; prende o foco e o devolve ao elemento de origem. */
export function Modal({ id, label, labelledBy, onClose, escapeDisabled = false, widthClassName = 'max-w-105', header, children }: ModalProps) {
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const escapeDisabledRef = useRef(escapeDisabled)

  useEffect(() => {
    onCloseRef.current = onClose
    escapeDisabledRef.current = escapeDisabled
  }, [onClose, escapeDisabled])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !escapeDisabledRef.current) onCloseRef.current()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/35 backdrop-blur-[3px]" aria-label="Fechar" onClick={onClose} />
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        data-modal-id={id}
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${widthClassName} flex-col overflow-hidden rounded-panel bg-surface shadow-[0_20px_48px_rgba(22,29,24,0.18)] outline-none animate-[modal-in_180ms_ease-out]`}
      >
        <div className="shrink-0">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="modal-body">{children}</div>
      </section>
    </div>
  )
}
