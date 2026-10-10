import type { ReactNode } from 'react'
import type { AppIcon } from '../../../components/icons'

type SettingsCardProps = {
  icon: AppIcon
  title: string
  subtitle: string
  children: ReactNode
}

export function SettingsCard({ icon: Icon, title, subtitle, children }: SettingsCardProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-[var(--shadow-soft)]">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-card-header px-6 py-5 sm:px-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary shadow-[inset_0_0_0_1px_rgba(46,120,61,0.08)]">
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
        <div className="leading-tight">
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-text">{title}</h2>
          <p className="mt-1.5 text-[13px] text-text-muted">{subtitle}</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}
