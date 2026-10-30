import { useState } from 'react'
import type { FormEvent } from 'react'
import { removeDraft, type ScaleDetail } from '../../services/scales'

interface RemoveDraftDialogProps {
  scale: ScaleDetail
  onClose: () => void
  onRemoved: () => void
}

export function RemoveDraftDialog({ scale, onClose, onRemoved }: RemoveDraftDialogProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!confirmed || removing) return

    setRemoving(true)
    setError('')
    try {
      await removeDraft(scale.escala.id, scale.escala.revisao)
      onRemoved()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o rascunho.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-scale-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_80px_rgba(22,29,24,0.2)]"
      >
        <header className="border-b border-border px-5 py-4 sm:px-7 sm:py-5">
          <h2 id="remove-scale-title" className="text-xl font-bold tracking-tight text-text">Remover rascunho</h2>
          <p className="mt-1 text-sm text-text-muted">
            Escala de {String(scale.escala.mes).padStart(2, '0')}/{scale.escala.ano}
          </p>
        </header>
        <form onSubmit={submit} noValidate className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-sm text-text">
            Esta ação remove o rascunho e todos os plantões relacionados. Ela não pode ser desfeita.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-error bg-error p-3 text-sm text-danger">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={removing}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 accent-danger"
            />
            <span>Confirmo a remoção deste rascunho.</span>
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!removing ? (
              <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-page">
                Cancelar
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!confirmed || removing}
              className="rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? 'Removendo...' : 'Remover rascunho'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
