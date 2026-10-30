import { useState } from 'react'
import { Drawer } from '../../components/ui/Drawer'
import { publishScale, type ScaleDetail } from '../../services/scales'
import { getPublicationSummary, hasNurseCoverage, isScalePublished } from './publication'

interface PublishScaleDialogProps {
  scale: ScaleDetail
  onClose: () => void
  onPublished: (scale: ScaleDetail) => void
}

export function PublishScaleDialog({ scale, onClose, onPublished }: PublishScaleDialogProps) {
  const summary = getPublicationSummary(scale)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (publishing || summary.blocked) return

    setPublishing(true)
    setError('')
    try {
      const published = await publishScale(
        scale.escala.id,
        scale.escala.revisao,
        summary.coverageOnly,
      )
      if (!isScalePublished(published)) {
        throw new Error('A API não confirmou a publicação da escala. Tente novamente.')
      }
      onPublished(published)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível publicar a escala.')
    } finally {
      setPublishing(false)
    }
  }

  const findings = [...scale.conflitos, ...scale.avisos]
  const ready = !summary.coverageOnly && !summary.blocked
  const percentage = summary.percentage ?? 0

  return (
    <Drawer
      id="publish-scale"
      title="Publicar escala"
      description="Resumo atualizado do rascunho atual"
      onClose={onClose}
      closeDisabled={publishing}
      footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={publishing} onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-page">
          Cancelar
        </button>
        <button
          type="button"
          disabled={publishing || summary.blocked}
          onClick={() => void submit()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishing ? 'Publicando...' : summary.blocked ? 'Corrija os conflitos' : summary.coverageOnly ? 'Publicar com pendências' : 'Confirmar publicação'}
        </button>
      </div>}
    >
      <div className="space-y-3">
        <section className="flex items-center gap-3 rounded-xl bg-soft-green p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{percentage}%</span>
          <div>
            <h3 className="text-sm font-bold text-text">{ready ? 'Escala pronta para publicação' : 'Escala com pontos para revisar'}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              {ready
                ? 'Cobertura, quantitativo e restrições foram validados novamente.'
                : 'Os indicadores abaixo refletem todas as alterações do rascunho atual.'}
            </p>
          </div>
        </section>

        {hasNurseCoverage(scale) ? (
          <section className="rounded-xl bg-highlight p-4 text-primary">
            <h3 className="text-xs font-bold">✓ &nbsp;Todos os plantões estão cobertos</h3>
            <p className="mt-1 pl-5 text-[11px]">Há pelo menos um enfermeiro escalado em cada plantão.</p>
          </section>
        ) : null}

        <section className="rounded-xl bg-highlight p-4 text-primary">
          <h3 className="text-xs font-bold">
            ✓ &nbsp;{ready ? 'Quantitativo mínimo atendido' : 'Cobertura atualizada'}
          </h3>
          <p className="mt-1 pl-5 text-[11px]">
            {summary.filledPositions !== null && summary.requiredPositions !== null
              ? `${summary.filledPositions} de ${summary.requiredPositions} posições estão preenchidas.`
              : 'Os dados de quantitativo não estão disponíveis.'}
          </p>
        </section>

        {summary.coverageOnly ? (
          <section className="rounded-xl bg-warning p-4 text-warning-text">
            <h3 className="text-xs font-bold">⚠ &nbsp;{summary.belowMinimumCount} {summary.belowMinimumCount === 1 ? 'cobertura' : 'coberturas'} abaixo do mínimo</h3>
            <p className="mt-1 pl-5 text-[11px]">Revise os setores e turnos indicados no calendário.</p>
          </section>
        ) : null}

        {!summary.blocked ? (
          <section className="rounded-xl bg-highlight p-4 text-primary">
            <h3 className="text-xs font-bold">✓ &nbsp;Sem conflitos de disponibilidade</h3>
            <p className="mt-1 pl-5 text-[11px]">Status, férias, afastamentos, restrições e descansos validados.</p>
          </section>
        ) : (
          <section role="alert" className="rounded-xl bg-error p-4 text-danger">
            <h3 className="text-xs font-bold">Conflitos que impedem a publicação</h3>
            <ul className="mt-2 space-y-1 text-[11px]">{findings.map((item, index) => <li key={`${item.tipo}-${index}`}>{item.tipo}: {item.motivo}</li>)}</ul>
          </section>
        )}

        <p className="rounded-xl bg-highlight p-3 text-[11px] text-primary">♧ &nbsp;Todos os enfermeiros serão notificados após a publicação.</p>
        {error ? <p role="alert" className="rounded-xl border border-error bg-error p-3 text-sm text-danger">{error}</p> : null}
      </div>
    </Drawer>
  )
}
