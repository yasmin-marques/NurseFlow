import { Minus, Plus } from '../icons'

type NumberStepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  label: string
}

export function NumberStepper({ value, onChange, min = 0, label }: NumberStepperProps) {
  const decrease = () => onChange(Math.max(min, value - 1))
  const increase = () => onChange(value + 1)

  return (
    <div
      className="inline-flex h-[38px] items-center overflow-hidden rounded-xl border border-border bg-[#f7f8f6] shadow-[inset_0_0_0_1px_rgba(16,24,16,0.02)]"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="flex h-full w-[34px] items-center justify-center text-text-muted transition-colors hover:bg-white disabled:opacity-40"
        onClick={decrease}
        disabled={value <= min}
        aria-label={`Diminuir ${label}`}
      >
        <Minus className="size-4" strokeWidth={2} />
      </button>
      <span className="min-w-[38px] px-2 text-center text-[14px] font-semibold text-text" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="flex h-full w-[34px] items-center justify-center text-text-muted transition-colors hover:bg-white"
        onClick={increase}
        aria-label={`Aumentar ${label}`}
      >
        <Plus className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}
