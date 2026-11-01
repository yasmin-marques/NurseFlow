import { api } from './api'

const trocarApi = <T>(path: string, init?: RequestInit) => api<T>(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) })

export type TrocaTab = 'pendentes' | 'aprovadas' | 'recusadas'
export type PlantaoTroca = {
  profissional: string
  funcao: string; lideranca: boolean; origemCobertura: string; data: string
  horarioInicio: string; horarioFim: string; duracaoHoras: number; tipo: string
  setor: string; escala: { ano: number; mes: number; status: string; revisao: number; versaoPublicada: number } | null
}
export type Troca = {
  id: string; status: string; criadaEm: string
  solicitante: { nome: string }
  profissionalSolicitado: { nome: string }
  aceite: { aceito: true; aceitoEm: string } | null
  decisaoCoordenacao: { resultado: string; decididaEm: string; justificativa: string | null; excecaoLimite: boolean; versoesEscala: { ano: number; mes: number; numero: number }[] } | null
  historico?: { resultado: string; decididaEm: string; justificativa: string | null; excecaoLimite: boolean; responsavel: string; versoesEscala: { ano: number; mes: number; numero: number }[] }[]
  plantaoSolicitante: PlantaoTroca | null
  plantaoSolicitado: PlantaoTroca | null
}
export type TrocasPage = { itens: Troca[]; pagina: number; limite: number; total: number; totalPaginas: number; contadores: { pendentes: number; aprovadas: number; recusadas: number; aguardandoCoordenacao: number } }

export function listarTrocas(input: { status: TrocaTab; ano: number; mes: number; pagina?: number }) {
  const query = new URLSearchParams({ status: input.status, ano: String(input.ano), mes: String(input.mes), pagina: String(input.pagina ?? 1), limite: '50' })
  return trocarApi<TrocasPage>(`/trocas?${query}`)
}
export function obterTroca(id: string) { return trocarApi<Troca>(`/trocas/${id}`) }
export type ValidacaoTroca = { apta: boolean; impedimentos: { codigo: string; mensagem: string }[]; avisos: { codigo: string; mensagem: string }[]; revisaoEsperada: number }
export function validarTroca(id: string) { return trocarApi<ValidacaoTroca>(`/trocas/${id}/validacao`) }
export function aprovarTroca(id: string, input: { revisaoEsperada: number; operacaoId: string; excecaoLimite?: boolean; justificativa?: string }) {
  return trocarApi<Troca>(`/trocas/${id}/aprovar`, { method: 'POST', body: JSON.stringify(input) })
}
export function recusarTroca(id: string, input: { revisaoEsperada: number; operacaoId: string; justificativa: string }) {
  return trocarApi<Troca>(`/trocas/${id}/recusar`, { method: 'POST', body: JSON.stringify(input) })
}
