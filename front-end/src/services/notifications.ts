import { api } from './api'
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
