import { api } from './api'

export type GoogleCalendarState = 'nao_conectada' | 'conectada' | 'desativada' | 'reconexao_necessaria'

export type GoogleCalendarSyncResult = {
  resultado: 'sucesso' | 'parcial' | 'falha'
  mensagem: string
  em: string
  criados: number
  atualizados: number
  removidos: number
  falhas: number
}

export type GoogleCalendarStatus = {
  configurada: boolean
  estado: GoogleCalendarState
  ultimaSincronizacaoEm: string | null
  pendentes: number
  reconexaoNecessaria: boolean
  ultimoResultado: GoogleCalendarSyncResult | null
}

export type GoogleCalendarSyncResponse = GoogleCalendarSyncResult & {
  reconexaoNecessaria: boolean
  estado: GoogleCalendarStatus
}

const BASE = '/integracoes/google-agenda'

export const getGoogleCalendarStatus = () => api<GoogleCalendarStatus>(BASE)

/** Devolve a URL de consentimento do Google; o OAuth acontece no backend e nenhum token chega ao navegador. */
export const startGoogleCalendarConnection = () => api<{ url: string }>(`${BASE}/conectar`, { method: 'POST' })

export const syncGoogleCalendar = () => api<GoogleCalendarSyncResponse>(`${BASE}/sincronizar`, { method: 'POST' })

export const disableGoogleCalendar = () => api<GoogleCalendarStatus>(`${BASE}/desativar`, { method: 'POST' })
