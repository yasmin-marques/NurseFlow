type ProfessionalStatusIndicatorProps = {
  active: boolean
  label: string
}

export function ProfessionalStatusIndicator({ label }: ProfessionalStatusIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-text">
      <span className="size-2 rounded-full bg-success" aria-hidden="true" />
      {label}
    </span>
  )
}
