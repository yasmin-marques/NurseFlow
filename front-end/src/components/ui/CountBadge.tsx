type CountBadgeProps = {
  count: number
  label?: string
  className?: string
  showZero?: boolean
  size?: 'sm' | 'md'
}

export function CountBadge({ count, label, className = '', showZero = false, size = 'sm' }: CountBadgeProps) {
  if (count < 0 || count === 0 && !showZero) return null
  const displayed = count > 99 ? '99+' : String(count)
  const heightClass = size === 'md' ? 'h-5' : 'h-[18px]'
  const widthClass = size === 'md' ? 'w-5' : 'w-[18px]'
  const minWidthClass = size === 'md' ? 'min-w-5' : 'min-w-[18px]'
  const shapeClass = count < 10 ? widthClass : `w-auto ${minWidthClass}`

  return (
    <span
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`box-border inline-flex ${heightClass} ${shapeClass} shrink-0 items-center justify-center rounded-full bg-badge-red p-0 text-center text-[10px] font-bold leading-[1] text-badge-red-text ${count >= 10 ? 'px-1.5' : 'px-0'} ${className}`}
    >
      <span className="flex h-full w-full items-center justify-center leading-[1]">{displayed}</span>
    </span>
  )
}
