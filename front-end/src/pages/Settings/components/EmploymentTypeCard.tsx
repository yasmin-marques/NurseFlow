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
    <article className="flex h-full min-h-[220px] flex-col rounded-[18px] border border-border bg-white p-6 shadow-[0_6px_18px_rgba(16,24,16,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-bold tracking-[-0.02em] text-text">{title}</h3>
        <span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-[0.06em] ${badgeClass}`}>
          {badge}
        </span>
      </div>
      <p className="text-[15px] font-medium leading-relaxed text-text">{headline}</p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-text-muted">{detail}</p>
      <div className="mt-auto pt-6">{children}</div>
    </article>
  )
}
