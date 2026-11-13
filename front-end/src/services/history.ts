import { api } from './api'
import { exportScalePdf } from './scales'

export interface PublishedScaleHistoryItem {
  escalaId: string
  ano: number
  mes: number
  numeroVersao: number
  publicadoEm: string
  totalPlantoes: number
  percentualCobertura: number | null
}

export interface PublishedScalesHistory {
  ano: number
  itens: PublishedScaleHistoryItem[]
}

export interface ExchangeHistoryItem {
  id: string
  decididaEm: string
  solicitante: { nome: string }
  profissionalSolicitado: { nome: string }
  resultado: 'aprovada' | 'recusada'
  responsavel: { nome: string }
}

export interface ExchangeHistoryPage {
  ano: number
  itens: ExchangeHistoryItem[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export function getPublishedScalesHistory(ano: number, signal?: AbortSignal) {
  return api<PublishedScalesHistory>(`/escalas/historico?ano=${ano}`, { signal })
}

export function getExchangeHistory(input: { ano: number; pagina: number; limite?: number }, signal?: AbortSignal) {
  const query = new URLSearchParams({
    ano: String(input.ano),
    pagina: String(input.pagina),
    limite: String(input.limite ?? 20),
  })
  return api<ExchangeHistoryPage>(`/trocas/historico?${query}`, { signal })
}

export function downloadPublishedScale(escalaId: string) {
  return exportScalePdf(escalaId)
}
