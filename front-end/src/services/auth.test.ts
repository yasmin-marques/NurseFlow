import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend } from '../test/fetchMock'
import { ApiError, UNAUTHORIZED_EVENT, getToken } from './api'
import { currentUser, login, logout } from './auth'

afterEach(() => vi.unstubAllGlobals())

const usuario = { id: '1', nome: 'Admin', email: 'admin@nurseflow.test', perfil: 'coordenacao' }
const profile = (p: string) => p as Parameters<typeof login>[0]
const form = (email: string, password: string) => ({ email, password }) as Parameters<typeof login>[1]

describe('services/auth', () => {
  it('autentica, envia o corpo esperado e guarda o token da sessão', async () => {
    const { calls, store } = mockBackend(() => ({ body: { accessToken: 'jwt-1', usuario } }))
    const result = await login(profile('coordenacao'), form(usuario.email, 'segredo'))
    expect(calls[0]).toMatchObject({
      url: '/api/auth/login',
      method: 'POST',
      body: { email: usuario.email, senha: 'segredo', perfil: 'coordenacao' },
    })
    expect(result).toEqual(usuario)
    expect(store.get('nurseflow.token')).toBe('jwt-1')
  })

  it('propaga o erro da API e não guarda token com credenciais inválidas', async () => {
    const { store } = mockBackend(() => ({ status: 401, body: { message: 'Credenciais inválidas.' } }))
    await expect(login(profile('enfermeiro'), form('a@b.c', 'x'))).rejects.toMatchObject({
      status: 401,
      message: 'Credenciais inválidas.',
    })
    expect(store.has('nurseflow.token')).toBe(false)
  })

  it('une mensagens de validação em lista', async () => {
    mockBackend(() => ({ status: 400, body: { message: ['e-mail inválido', 'senha obrigatória'] } }))
    await expect(login(profile('tecnico'), form('', ''))).rejects.toThrow('e-mail inválido senha obrigatória')
  })

  it('logout remove o token', () => {
    const { store } = mockBackend(() => ({}))
    store.set('nurseflow.token', 'jwt')
    logout()
    expect(getToken()).toBeNull()
  })

  it('currentUser retorna null sem token e consulta /auth/me com token', async () => {
    const { calls, store } = mockBackend(() => ({ body: usuario }))
    expect(await currentUser()).toBeNull()
    expect(calls).toHaveLength(0)
    store.set('nurseflow.token', 'jwt')
    expect(await currentUser()).toEqual(usuario)
    expect(calls[0].url).toBe('/api/auth/me')
    expect(calls[0].headers.Authorization).toBe('Bearer jwt')
  })

  it('401 com token ativo limpa a sessão e dispara o evento de não autorizado', async () => {
    const { store } = mockBackend(() => ({ status: 401, body: { message: 'Expirada' } }))
    store.set('nurseflow.token', 'velho')
    await expect(currentUser()).rejects.toBeInstanceOf(ApiError)
    expect(store.has('nurseflow.token')).toBe(false)
    const dispatch = window.dispatchEvent as unknown as ReturnType<typeof vi.fn>
    expect(dispatch.mock.calls[0][0].type).toBe(UNAUTHORIZED_EVENT)
  })
})
