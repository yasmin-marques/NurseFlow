type ToastProps = {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 rounded-lg border border-border bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-text shadow-[0_8px_24px_rgba(37,41,37,0.12)]"
    >
      {message}
    </div>
  )
}
