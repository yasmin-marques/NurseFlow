type UserAvatarProps = {
  initials: string
  sizeClassName: string
  textClassName: string
  className?: string
  decorative?: boolean
}

export function UserAvatar({
  initials,
  sizeClassName,
  textClassName,
  className = '',
  decorative = false,
}: UserAvatarProps) {
  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      className={`box-border flex shrink-0 items-center justify-center rounded-full border border-primary/50 bg-secondary ${textClassName} ${sizeClassName} ${className}`}
    >
      {initials}
    </span>
  )
}
