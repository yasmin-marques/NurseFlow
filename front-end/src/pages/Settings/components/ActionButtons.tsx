import { Check } from '../../../components/icons'

type ActionButtonsProps = {
  isDirty: boolean
  isSaving: boolean
  onDiscard: () => void
  onSave: () => void
}

export function ActionButtons({ isDirty, isSaving, onDiscard, onSave }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap justify-end gap-3 pt-2 pb-7">
      <button
        type="button"
        onClick={onDiscard}
        disabled={!isDirty || isSaving}
        className="h-[42px] rounded-xl border border-border bg-white px-4 text-[14px] font-medium text-text shadow-sm transition-colors hover:bg-page disabled:opacity-50"
      >
        Descartar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="inline-flex h-[42px] items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(46,120,61,0.22)] transition-colors hover:bg-primary-hover disabled:opacity-70"
      >
        <Check className="size-4" strokeWidth={2.2} />
        {isSaving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}
