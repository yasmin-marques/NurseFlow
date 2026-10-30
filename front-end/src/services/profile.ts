import { api } from './api'
import type { SessionUser } from './auth'

export type UserProfile = SessionUser & {
  coren: string | null
  formacao: 'enfermeiro' | 'tecnico' | null
  tipoVinculo: 'concursado' | 'clt' | 'rpa' | null
  proximoSetor: string | null
  recebeNotificacoesEscala: boolean
}

export type UpdateUserProfile = {
  email?: string
  recebeNotificacoesEscala?: boolean
}

export function getUserProfile(): Promise<UserProfile> {
  return api<UserProfile>('/auth/me/perfil')
}

export function updateUserProfile(input: UpdateUserProfile): Promise<UserProfile> {
  return api<UserProfile>('/auth/me/perfil', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
