import type { ReactNode } from 'react'

type EmploymentTypeCardProps = {
  title: string
  badge: string
  badgeTone?: 'green' | 'blue'
  headline: string
  detail: string
  children: ReactNode
}

export function EmploymentTypeCard({
  title,
  badge,
  badgeTone = 'green',
  headline,
  detail,
  children,
}: EmploymentTypeCardProps) {
  const badgeClass =
    badgeTone === 'blue'
      ? 'bg-badge-blue text-badge-blue-text'
      : 'bg-secondary text-primary'

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[16px] border border-border bg-white pt-4 shadow-[0_6px_18px_rgba(16,24,16,0.04)]">
      <div className="mb-3 flex items-start px-4 justify-between gap-3">
        <h3 className="text-[16px] font-bold tracking-[-0.02em] text-text">{title}</h3>
        <span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-[0.06em] ${badgeClass}`}>
          {badge}
        </span>
      </div>
      <p className="px-4 text-[14px] font-medium leading-snug text-text">{headline}</p>
      <p className="mt-1 px-4 text-[12px] leading-snug text-text-muted">{detail}</p>
      <div className="mt-auto pt-3">{children}</div>
    </article>
  )
}
