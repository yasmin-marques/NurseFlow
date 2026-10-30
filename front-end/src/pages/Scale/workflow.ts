import type { ScaleStatus } from '../../services/scales'

export type WorkflowBadgeTone = 'neutral' | 'warning' | 'success' | 'info'

const STEPS = ['Gerar escala', 'Revisar', 'Validar conflitos', 'Publicar']

export function getScaleWorkflow(status: ScaleStatus | null, changesSaved: boolean) {
  const published = status === 'publicada' || status === 'finalizada'
  const badge = !status
    ? 'AGUARDANDO GERAÇÃO'
    : published
      ? 'PUBLICADA'
        : changesSaved && (status === 'em_revisao' || status === 'validada')
        ? 'ALTERAÇÕES SALVAS'
        : status === 'validada'
            ? 'ALTERAÇÕES SALVAS'
          : status === 'em_revisao'
            ? 'EM REVISÃO'
            : 'RASCUNHO'
  const tone: WorkflowBadgeTone = !status || status === 'rascunho'
    ? 'neutral'
    : published
      ? 'success'
      : badge === 'ALTERAÇÕES SALVAS'
        ? 'success'
        : status === 'validada'
          ? 'info'
          : 'warning'
  const currentStep = !status || status === 'rascunho'
    ? 0
    : published
      ? null
      : status === 'validada' || (changesSaved && status === 'em_revisao')
        ? 2
        : 1

  return {
    badge,
    tone,
    steps: STEPS.map((label, index) => ({
      label,
      complete: published || (currentStep !== null && index < currentStep),
      current: currentStep === index,
    })),
  }
}
