import { api } from './api'

export type ExchangeNotification = { id: string; solicitacaoId: string; eventKey: string; titulo: string; mensagem: string; criadaEm: string; lidaEm: string | null }
export type ExchangeNotificationList = { notificacoes: ExchangeNotification[]; naoLidas: number }
export function listExchangeNotifications() { return api<ExchangeNotificationList>('/notificacoes/trocas') }
export function markExchangeNotificationRead(id: string) { return api<{ id: string; lidaEm: string }>(`/notificacoes/trocas/${id}/lida`, { method: 'PATCH' }) }
import type { ScaleDetail } from './scales'

export interface ScaleNotification {
  id: string
  escalaId: string
  versao: number
  eventKey: string
  titulo: string
  mensagem: string
  criadoEm: string
  lidaEm: string | null
}

export interface ScaleNotificationList {
  notificacoes: ScaleNotification[]
  naoLidas: number
}

export interface NotifiedScaleVersion {
  versao: {
    numero: number
    ano: number
    mes: number
    publicadoPor: string
    publicadoEm: string
    pendenciasConfirmadas: boolean
  }
  snapshot: {
    visualizacao?: ScaleDetail
    pendencias?: ScaleDetail['pendencias']
  }
}

export function listScaleNotifications(): Promise<ScaleNotificationList> {
  return api<ScaleNotificationList>('/notificacoes/escalas')
}

export function markScaleNotificationRead(id: string): Promise<{ id: string; lidaEm: string }> {
  return api<{ id: string; lidaEm: string }>(`/notificacoes/escalas/${encodeURIComponent(id)}/lida`, {
    method: 'PATCH',
  })
}

export function getNotifiedScaleVersion(
  escalaId: string,
  numero: number,
): Promise<NotifiedScaleVersion> {
  return api<NotifiedScaleVersion>(
    `/notificacoes/escalas/${encodeURIComponent(escalaId)}/versoes/${numero}`,
  )
}
