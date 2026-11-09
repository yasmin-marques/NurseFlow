const API_URL = (
  import.meta.env.VITE_API_URL || '/api'
).replace(/\/+$/, '')

const TOKEN_KEY = 'nurseflow.token'

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)

export const setToken = (token: string | null) =>
  token
    ? sessionStorage.setItem(TOKEN_KEY, token)
    : sessionStorage.removeItem(TOKEN_KEY)

export const UNAUTHORIZED_EVENT = 'nurseflow:unauthorized'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  let response: Response
  try {
    response = await fetch(
      `${API_URL}/${path.replace(/^\/+/, '')}`,
      {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
          ...init.headers,
        },
      },
    )
  } catch (cause) {
    const errorName = cause && typeof cause === 'object' && 'name' in cause ? String((cause as { name?: unknown }).name) : ''
    if (errorName === 'TimeoutError' || errorName === 'AbortError') {
      throw new ApiError(0, 'A solicitação expirou. Tente novamente.')
    }
    throw new ApiError(0, 'Não foi possível conectar ao servidor.')
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null)
      window.dispatchEvent(
        new Event(UNAUTHORIZED_EVENT),
      )
    }
  }
  return response
}

async function erroDaResposta(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null)
  const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message
  const details = Array.isArray(body?.erros)
    ? body.erros.filter((item: unknown): item is string => typeof item === 'string').join(' ')
    : ''
  const impedimentos = Array.isArray(body?.impedimentos)
    ? body.impedimentos.map((item: { mensagem?: unknown }) => typeof item?.mensagem === 'string' ? item.mensagem : '').filter(Boolean).join(' ')
    : ''
  return new ApiError(response.status, [message ?? 'Erro inesperado.', details, impedimentos].filter(Boolean).join(' '), body)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init)
  if (!response.ok) throw await erroDaResposta(response)
  return (await response.json().catch(() => null)) as T
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await request(path)
  if (!response.ok) throw await erroDaResposta(response)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1] ?? 'escala.pdf'
  return { blob: await response.blob(), filename }
}
