import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  id: string
  /** Nome acessível do diálogo. */
  label: string
  onClose: () => void
  /** Cabeçalho fixo (fica visível enquanto o corpo rola). */
  header: ReactNode
  children: ReactNode
}

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** Diálogo centralizado com cabeçalho fixo e corpo rolável; prende o foco e o devolve ao elemento de origem. */
export function Modal({ id, label, onClose, header, children }: ModalProps) {
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
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
        aria-label={label}
        data-modal-id={id}
        className="relative flex max-h-[min(52rem,calc(100dvh-2rem))] w-full max-w-[44rem] flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_24px_64px_rgba(22,29,24,0.24)] outline-none"
      >
        <div className="shrink-0">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="modal-body">{children}</div>
      </section>
    </div>
  )
}
