import type { ScaleDetail } from '../../services/scales'

export function isScalePublished(scale: ScaleDetail): boolean {
  return scale.escala.status === 'publicada' || scale.escala.status === 'finalizada'
}

export function hasNurseCoverage(scale: ScaleDetail): boolean {
  return scale.plantoes.length > 0 &&
    !scale.pendencias.some((vacancy) => vacancy.funcao === 'enfermeiros') &&
    scale.plantoes.every((shift) =>
      shift.profissionais.some((professional) => professional.formacao === 'enfermeiro'),
    )
}

// Restrições já respeitadas na geração: informam, mas não impedem a publicação.
const INFORMATIVE_CONFLICT_TYPES = new Set([
  'CARGA_ABAIXO_DO_ESPERADO',
  'PROFISSIONAL_INDISPONIVEL',
  'INDISPONIBILIDADE',
  'DESCANSO_MES_ANTERIOR',
])

export function getPublicationSummary(scale: ScaleDetail) {
  const blockingFindings = [
    ...scale.conflitos.filter((item) => !INFORMATIVE_CONFLICT_TYPES.has(item.tipo)),
    ...scale.avisos,
  ]
  const notices = scale.conflitos.filter((item) => INFORMATIVE_CONFLICT_TYPES.has(item.tipo))
  const coverage = scale.cobertura ?? scale.escala.validacao?.cobertura ?? null
  const filledPositions = coverage?.posicoesPreenchidas ?? null
  const requiredPositions = coverage?.posicoesExigidas ?? null
  const percentage = coverage?.percentual ??
    (coverage && coverage.posicoesExigidas > 0
      ? Math.round((coverage.posicoesPreenchidas / coverage.posicoesExigidas) * 100)
      : null)
  const belowMinimumCount = new Set(
    scale.pendencias.map((item) => `${item.setorId}:${item.data}:${item.turno}:${item.funcao}`),
  ).size
  const coverageOnly = scale.pendencias.length > 0 && blockingFindings.length === 0 && percentage !== null && percentage < 100
  const blocked =
    blockingFindings.length > 0 ||
    percentage === null ||
    (percentage < 100 && scale.pendencias.length === 0) ||
    (percentage === 100 && scale.pendencias.length > 0)

  return {
    percentage,
    filledPositions,
    requiredPositions,
    belowMinimumCount,
    coverageOnly,
    blocked,
    blockingFindings,
    notices,
    requiresConfirmation: scale.pendencias.length > 0 || notices.length > 0,
  }
}
