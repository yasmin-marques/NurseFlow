import { api } from './api'

export type MyExchangeTab = 'recebidas' | 'enviadas' | 'historico'
export type ShiftChoice = { vinculoId: string; plantaoId: string; data: string; horarioInicio: string; horarioFim: string; duracaoHoras: number; setorId: string; setor?: string; funcao: string; escalaId?: string; versaoOficial?: number; versaoOficialEsperada: number; profissional?: { id: string; nome: string } }
export type MyExchange = { id: string; status: string; direcao: 'recebida' | 'enviada'; criadaEm: string; solicitante: { nome: string }; profissionalSolicitado: { nome: string }; plantaoSolicitante: ShiftChoice | null; plantaoSolicitado: ShiftChoice | null; decisaoCoordenacao?: { resultado: string; justificativa?: string | null } | null; historico?: { acao: string; ocorridoEm: string }[] }
type Page = { itens: MyExchange[]; total: number; pagina: number; limite: number; totalPaginas: number }
const request = <T>(url: string, init?: RequestInit) => api<T>(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) })
export const listarMinhasTrocas = (aba: MyExchangeTab) => request<Page>(`/trocas/minhas?aba=${aba}&pagina=1&limite=50`)
export const obterMinhaTroca = (id: string) => request<MyExchange>(`/trocas/minhas/${id}`)
export const listarMeusPlantoes = () => request<{ itens: ShiftChoice[] }>('/trocas/minhas/plantoes')
export const listarCandidatosTroca = (vinculoId: string) => request<{ itens: ShiftChoice[] }>(`/trocas/minhas/plantoes/${vinculoId}/candidatos`, { signal: AbortSignal.timeout(45_000) })
export const criarMinhaTroca = (input: { vinculoSolicitanteId: string; vinculoSolicitadoId: string; versaoOficialEsperada: number; operacaoId: string }) => request<MyExchange>('/trocas/minhas', { method: 'POST', body: JSON.stringify(input) })
export const executarAcaoTroca = (id: string, acao: 'aceite' | 'recusar' | 'cancelar', operacaoId: string) => request<MyExchange>(`/trocas/minhas/${id}/${acao}`, { method: 'POST', body: JSON.stringify({ operacaoId }) })
