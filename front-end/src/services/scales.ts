import { api, apiDownload } from './api'

export type ScaleStatus = 'rascunho' | 'em_revisao' | 'validada' | 'publicada' | 'finalizada'
export type ScaleShift = 'diurno' | 'noturno'
export type ShiftOption = '24h' | '12d' | '12n'
export type ShiftType = 'regular' | 'extra'
export type ShiftRole = 'enfermeiro' | 'tecnico'
export type CoverageOrigin = 'regular' | 'restricao' | 'complementar'

export interface CoverageSummary {
  posicoesExigidas: number
  posicoesPreenchidas: number
  percentual: number | null
}

export interface CoverageVacancy {
  setorId: string
  setor: string
  data: string
  turno: ScaleShift
  funcao: 'enfermeiros' | 'tecnicos'
  necessario: number
  alocado: number
  faltam: number
  motivo: string
}

export interface ScheduleProfessional {
  id: string
  nome: string
  formacao: ShiftRole
  vinculo: 'concursado' | 'clt' | 'rpa'
  lideranca: boolean
  origemCobertura: CoverageOrigin
}

export interface ScheduledShift {
  id: string
  data: string
  setor: { id: string; nome: string }
  horarioInicio: string
  horarioFim: string
  duracaoHoras: number
  tipo: ShiftType
  profissionais: ScheduleProfessional[]
}

export interface ScheduleFinding {
  tipo: string
  motivo: string
  profissionalId?: string
  profissional?: string
  setorId?: string
  setor?: string
  data?: string
  turno?: ScaleShift
}

export interface ProfessionalWorkload {
  profissionalId: string
  profissional: string
  vinculo: string
  esperada: { plantoes24h: number; plantoes12h: number }
  atribuida: { plantoes24h: number; plantoes12h: number }
  extras: number
}

export interface ScaleDetail {
  escala: {
    id: string
    ano: number
    mes: number
    status: ScaleStatus
    revisao: number
    versaoPublicada?: number
    validacao: {
      revisao: number
      validadoPor: string
      validadoEm: string
      cobertura: CoverageSummary
    } | null
    administradorId: string
    dataCriacao: string
  }
  resumo: {
    plantoes: number
    alocacoes?: number
    vagasDescobertas?: number
    extras?: number
    cobertura?: CoverageSummary
  }
  cobertura: CoverageSummary | null
  configuracaoUtilizada: Record<string, unknown> | null
  escopo: { setorIds: string[]; turnos: ScaleShift[] } | null
  plantoes: ScheduledShift[]
  pendencias: CoverageVacancy[]
  conflitos: ScheduleFinding[]
  avisos: ScheduleFinding[]
  cargas: ProfessionalWorkload[]
}

export interface ShiftAssignmentInput {
  profissionalId: string
  funcao: ShiftRole
  lideranca?: boolean
  origemCobertura?: CoverageOrigin
}

export interface ShiftInput {
  revisao: number
  setorId: string
  data: string
  opcao: ShiftOption
  tipo: ShiftType
  equipe: ShiftAssignmentInput[]
}

export type ShiftBatchChange = Omit<ShiftInput, 'revisao'> & { plantaoId?: string }

export interface ShiftBatchValidation {
  revisao: number
  valida: boolean
  erros: Array<{ tipo?: string; motivo?: string; [key: string]: unknown }>
}

export interface GenerateScaleInput {
  ano: number
  mes: number
  operacaoId?: string
  setorIds?: string[]
  turnos?: ScaleShift[]
  substituirRascunho?: boolean
}

interface ApiScheduleProfessional {
  id: string
  nome: string
  formacao: ShiftRole
  vinculo: ScheduleProfessional['vinculo']
  lideranca?: boolean
  origemCobertura?: CoverageOrigin
}

interface ApiScheduledShift {
  id: string
  data: string
  setor: { id: string; nome: string }
  horarioInicio: string
  horarioFim: string
  duracaoHoras: number
  tipo: ShiftType
  profissionais: ApiScheduleProfessional[]
}

type ApiScaleDetail = Omit<ScaleDetail, 'escala' | 'plantoes'> & {
  escala: ScaleDetail['escala']
  plantoes: ApiScheduledShift[]
}

const fromApi = (scale: ApiScaleDetail): ScaleDetail => ({
  ...scale,
  plantoes: scale.plantoes.map((shift) => ({
    ...shift,
    profissionais: shift.profissionais.map((professional) => ({
      ...professional,
      lideranca: professional.lideranca ?? false,
      origemCobertura: professional.origemCobertura ?? 'regular',
    })),
  })),
})

const toApiShift = (input: ShiftInput) => ({
  revisaoEsperada: input.revisao,
  setorId: input.setorId,
  data: input.data,
  opcao: input.opcao,
  tipo: input.tipo,
  equipe: input.equipe.map((person) => ({
    profissionalId: person.profissionalId,
    funcao: person.funcao,
    lideranca: person.lideranca ?? false,
    origemCobertura: person.origemCobertura ?? 'regular',
  })),
})

const toApiBatch = (revisaoEsperada: number, alteracoes: ShiftBatchChange[]) => ({
  revisaoEsperada,
  alteracoes: alteracoes.map(({ plantaoId, ...input }) => ({
    ...(plantaoId ? { plantaoId } : {}),
    setorId: input.setorId,
    data: input.data,
    opcao: input.opcao,
    tipo: input.tipo,
    equipe: input.equipe.map((person) => ({
      profissionalId: person.profissionalId,
      funcao: person.funcao,
      lideranca: person.lideranca ?? false,
      origemCobertura: person.origemCobertura ?? 'regular',
    })),
  })),
})

export function validateShiftBatch(scaleId: string, revisaoEsperada: number, alteracoes: ShiftBatchChange[]): Promise<ShiftBatchValidation> {
  return api<ShiftBatchValidation>(`/escalas/${scaleId}/plantoes/validar-lote`, {
    method: 'POST', body: JSON.stringify(toApiBatch(revisaoEsperada, alteracoes)),
  })
}

export async function saveShiftBatch(scaleId: string, revisaoEsperada: number, alteracoes: ShiftBatchChange[]): Promise<ScaleDetail> {
  return fromApi(await api<ApiScaleDetail>(`/escalas/${scaleId}/plantoes/lote`, {
    method: 'POST', body: JSON.stringify(toApiBatch(revisaoEsperada, alteracoes)),
  }))
}

export async function listScales(ano: number, mes: number): Promise<ScaleDetail[]> {
  const scales = await api<ApiScaleDetail[]>(`/escalas?ano=${ano}&mes=${mes}`)
  return scales.map(fromApi)
}

export async function getScale(id: string): Promise<ScaleDetail> {
  return fromApi(await api<ApiScaleDetail>(`/escalas/${id}`))
}

export async function createDraft(ano: number, mes: number): Promise<ScaleDetail> {
  return fromApi(await api<ApiScaleDetail>('/escalas', { method: 'POST', body: JSON.stringify({ ano, mes }) }))
}

export async function generateScale(input: GenerateScaleInput): Promise<ScaleDetail> {
  return fromApi(await api<ApiScaleDetail>('/escalas/gerar', { method: 'POST', body: JSON.stringify(input) }))
}

export async function cancelScaleGeneration(operacaoId: string): Promise<void> {
  await api<{ operacaoId: string; cancelamentoSolicitado: boolean }>(`/escalas/gerar/${encodeURIComponent(operacaoId)}`, {
    method: 'DELETE',
  })
}

export async function addShift(scaleId: string, input: ShiftInput): Promise<ScaleDetail> {
  return fromApi(
    await api<ApiScaleDetail>(`/escalas/${scaleId}/plantoes`, {
      method: 'POST',
      body: JSON.stringify(toApiShift(input)),
    }),
  )
}

export async function updateShift(scaleId: string, shiftId: string, input: ShiftInput): Promise<ScaleDetail> {
  return fromApi(
    await api<ApiScaleDetail>(`/escalas/${scaleId}/plantoes/${shiftId}`, {
      method: 'PATCH',
      body: JSON.stringify(toApiShift(input)),
    }),
  )
}

export async function startReview(scaleId: string, revisaoEsperada: number): Promise<ScaleDetail> {
  return fromApi(
    await api<ApiScaleDetail>(`/escalas/${scaleId}/revisao`, {
      method: 'POST',
      body: JSON.stringify({ revisaoEsperada }),
    }),
  )
}

export async function validateScale(scaleId: string, revisaoEsperada: number): Promise<ScaleDetail> {
  return fromApi(
    await api<ApiScaleDetail>(`/escalas/${scaleId}/validar`, {
      method: 'POST',
      body: JSON.stringify({ revisaoEsperada }),
    }),
  )
}

export async function publishScale(
  scaleId: string,
  revisaoEsperada: number,
  confirmarPendencias: boolean,
): Promise<ScaleDetail> {
  return fromApi(
    await api<ApiScaleDetail>(`/escalas/${scaleId}/publicar`, {
      method: 'POST',
      body: JSON.stringify({ revisaoEsperada, confirmarPendencias }),
    }),
  )
}

export async function exportScalePdf(
  scaleId: string,
  options?: { separarPorSetor: true } | { setorId: string },
): Promise<{ blob: Blob; filename: string }> {
  const query = options && 'separarPorSetor' in options
    ? '?separarPorSetor=true'
    : options && 'setorId' in options
      ? `?setorId=${encodeURIComponent(options.setorId)}`
      : ''
  return apiDownload(`/escalas/${scaleId}/pdf${query}`)
}

export async function removeDraft(scaleId: string, revisaoEsperada: number): Promise<void> {
  await api<void>(`/escalas/${scaleId}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirmar: true, revisaoEsperada }),
  })
}
