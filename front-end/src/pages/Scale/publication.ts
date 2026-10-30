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

export function getPublicationSummary(scale: ScaleDetail) {
  const findings = [...scale.conflitos, ...scale.avisos]
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
  const coverageOnly = scale.pendencias.length > 0 && findings.length === 0 && percentage !== null && percentage < 100
  const blocked =
    findings.length > 0 ||
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
  }
}
