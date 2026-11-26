type ToastProps = {
  message: string | null
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  tone?: 'default' | 'danger'
}

export function Toast({ message, action, secondaryAction, tone = 'default' }: ToastProps) {
  if (!message) return null

  return (
    <div
      role={action || secondaryAction ? 'alertdialog' : 'status'}
      aria-live={action || secondaryAction ? undefined : 'polite'}
      className={`fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border px-3.5 py-3 text-[12.5px] font-medium shadow-[0_8px_24px_rgba(37,41,37,0.12)] ${
        tone === 'danger' ? 'border-red-200 bg-red-50 text-red-900' : 'border-border bg-white text-text'
      }`}
    >
      <p>{message}</p>
      {action || secondaryAction ? (
        <div className="mt-2.5 flex flex-wrap justify-end gap-2">
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-text hover:bg-neutral"
            >
              {secondaryAction.label}
            </button>
          ) : null}
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white ${tone === 'danger' ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'}`}
            >
              {action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
