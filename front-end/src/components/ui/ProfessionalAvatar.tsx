type ProfessionalAvatarProps = {
  initials: string
  decorative?: boolean
}

export function ProfessionalAvatar({ initials, decorative = false }: ProfessionalAvatarProps) {
  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e4efe2] text-xs font-bold text-primary"
    >
      {initials}
    </span>
  )
}
