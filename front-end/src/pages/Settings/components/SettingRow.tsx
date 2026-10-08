import type { ReactNode } from 'react'

type SettingRowProps = {
  title: string
  description: string
  children: ReactNode
}

export function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex min-h-[96px] items-center justify-between gap-6 border-t border-border px-6 py-5 first:border-t-0 sm:px-8">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold leading-snug tracking-[-0.01em] text-text">{title}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  )
}
