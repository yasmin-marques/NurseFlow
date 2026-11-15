import { api } from './api'

export type ExtraOption = '12d' | '12n' | '24h'
export type ExtraSituation = 'programado' | 'cancelado'
export type ExtraLinkStatus = 'sem_escala' | 'pendente_conciliacao' | 'vinculado'
export type ExtraReason = 'ferias' | 'ausencia' | 'atestado' | 'reforco' | 'outro' | string
export type ProfessionalBond = 'concursado' | 'clt' | 'rpa'

export type ExtraPerson = {
  id?: string
  nome?: string
  email?: string
  coren?: string
  tipoVinculo?: ProfessionalBond
  formacao?: 'enfermeiro' | 'tecnico'
}

export type ScheduledExtra = {
  id: string
  data: string
  opcao: ExtraOption
  setorId: string | { _id?: string; nome?: string }
  funcao: 'enfermeiro' | 'tecnico'
  motivo: ExtraReason
  situacao: ExtraSituation
  statusVinculo: ExtraLinkStatus
  substitutoId: string | ExtraPerson
  cobertoId?: string | ExtraPerson | null
  observacao?: string | null
  revisao: number
  escalaId?: string | null
  plantaoId?: string | null
  plantaoProfissionalId?: string | null
  escalaStatus?: 'rascunho' | 'em_revisao' | 'validada' | 'publicada' | 'finalizada' | null
}

export type ExtrasPage = {
  itens: ScheduledExtra[]
  total: number
  pagina: number
  limite: number
  totalPaginas: number
}

export type ExtrasSummary = {
  ano: number
  mes: number
  totalExtrasAtivos: number
  totalHoras: number
  totalRpaAtivos: number
}

export type ExtraInput = {
  data: string
  opcao: ExtraOption
  setorId: string
  funcao: 'enfermeiro' | 'tecnico'
  substitutoId: string
  motivo: string
  cobertoId?: string
  observacao?: string
}

export type ExtraUpdate = Partial<ExtraInput> & { revisaoEsperada: number }

export type ExtraCancellation = {
  revisaoEsperada: number
  justificativa: string
}

export type ExtrasFilters = {
  ano: number
  mes: number
  busca?: string
  setorId?: string
  motivo?: string
  situacao?: ExtraSituation
  pagina?: number
  limite?: number
}

const extrasApi = <T>(path: string, init: RequestInit = {}) =>
  api<T>(path, { ...init, signal: init.signal ?? AbortSignal.timeout(15_000) })

function queryFrom(filters: ExtrasFilters) {
  const query = new URLSearchParams({
    ano: String(filters.ano),
    mes: String(filters.mes),
    pagina: String(filters.pagina ?? 1),
    limite: String(filters.limite ?? 12),
  })
  if (filters.busca?.trim()) query.set('busca', filters.busca.trim())
  if (filters.setorId) query.set('setorId', filters.setorId)
  if (filters.motivo) query.set('motivo', filters.motivo)
  if (filters.situacao) query.set('situacao', filters.situacao)
  return query
}

export function listarExtras(filters: ExtrasFilters) {
  return extrasApi<ExtrasPage>(`/extras?${queryFrom(filters)}`)
}

export function obterResumoExtras(ano: number, mes: number) {
  return extrasApi<ExtrasSummary>(`/extras/resumo?ano=${ano}&mes=${mes}`)
}

export function obterExtra(id: string) {
  return extrasApi<ScheduledExtra & { historico?: Array<{ evento: string; revisao: number; criadoEm: string }> }>(`/extras/${id}`)
}

export function criarExtra(input: ExtraInput) {
  return extrasApi<ScheduledExtra>('/extras', { method: 'POST', body: JSON.stringify(input) })
}

export function editarExtra(id: string, input: ExtraUpdate) {
  return extrasApi<ScheduledExtra>(`/extras/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function cancelarExtra(id: string, input: ExtraCancellation) {
  return extrasApi<ScheduledExtra>(`/extras/${id}/cancelar`, { method: 'POST', body: JSON.stringify(input) })
}

export function listarExtrasDoPeriodo(filters: Omit<ExtrasFilters, 'pagina'>) {
  return listarExtras({ ...filters, pagina: 1 })
}
