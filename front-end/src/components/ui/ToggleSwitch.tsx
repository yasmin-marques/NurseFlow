type ToggleSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[26px] w-[48px] shrink-0 items-center rounded-full transition-all duration-200 ${
        checked ? 'bg-primary shadow-[0_8px_18px_rgba(46,120,61,0.18)]' : 'bg-[#c9cdc6]'
      }`}
    >
      <span
        className={`absolute top-[3px] size-[20px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[24px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}
