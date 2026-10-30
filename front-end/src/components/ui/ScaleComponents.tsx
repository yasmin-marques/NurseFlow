import type { ReactNode } from 'react'
import { coverageBadgeClass, type CoverageState } from './coverageStyles'
type PersonStatusTone = 'covered' | 'partial' | 'conflict' | 'info' | 'empty'

const PERSON_STATUS: Record<PersonStatusTone, string> = {
  covered: 'bg-highlight text-primary',
  partial: 'bg-warning text-warning-text',
  conflict: 'bg-error text-danger',
  info: 'bg-badge-blue text-badge-blue-text',
  empty: 'bg-neutral text-text-muted',
}

export function SelectionChip({
  checked,
  onChange,
  disabled = false,
  children,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-primary bg-soft-green text-primary' : 'border-border bg-white text-text'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      <span>{children}</span>
    </label>
  )
}

export function CoverageBadge({ state, children }: { state: CoverageState; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${coverageBadgeClass(state)}`}>
      {children}
    </span>
  )
}

export function CoverageAlert({ state, children }: { state: 'partial' | 'restricted' | 'conflict'; children: ReactNode }) {
  return (
    <p
      role={state === 'conflict' ? 'alert' : 'status'}
      className={`rounded-lg px-3 py-2 text-xs font-semibold ${coverageBadgeClass(state)}`}
    >
      {children}
    </p>
  )
}

export function PersonCard({
  name,
  detail,
  statusLabel,
  statusTone = 'empty',
  badges = [],
  action,
}: {
  name: string
  detail?: string
  statusLabel?: string
  statusTone?: PersonStatusTone
  badges?: Array<{ label: string; tone: PersonStatusTone }>
  action?: ReactNode
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const visibleBadges = statusLabel ? [...badges, { label: statusLabel, tone: statusTone }] : badges

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft-green text-[9px] font-bold text-primary">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-text">{name}</span>
        {detail ? <span className="block truncate text-[11px] text-text-muted">{detail}</span> : null}
      </span>
      {visibleBadges.map((badge, index) => (
        <span key={`${badge.label}-${index}`} className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${PERSON_STATUS[badge.tone]}`}>
          {badge.label}
        </span>
      ))}
      {action}
    </div>
  )
}
