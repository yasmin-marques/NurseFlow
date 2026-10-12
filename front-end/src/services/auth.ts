import { api, getToken, setToken } from './api'
import type { LoginFormValues, LoginProfile } from '../pages/Login/types'

export type SessionUser = { id: string; nome: string; email: string; perfil: string }

type LoginResponse = { accessToken: string; usuario: SessionUser }

export async function login(profile: LoginProfile, { email, password }: LoginFormValues) {
  const data = await api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: password, perfil: profile }),
  })
  setToken(data.accessToken)
  return data.usuario
}

export const logout = () => setToken(null)

export const currentUser = () => (getToken() ? api<SessionUser>('/auth/me') : Promise.resolve(null))
