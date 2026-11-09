import type { ReactNode } from 'react'

type SettingRowProps = {
  title: string
  description: string
  children: ReactNode
}

export function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-text">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  )
}
