import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { aprovarTroca, listarTrocas, recusarTroca } from './trocas'

describe('exchange API service', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('serializes filters and uses the authenticated request helper', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ itens: [], contadores: { pendentes: 0, aprovadas: 0, recusadas: 0, aguardandoCoordenacao: 0 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })
    await listarTrocas({ status: 'pendentes', ano: 2026, mes: 11, pagina: 2 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('status=pendentes&ano=2026&mes=11&pagina=2')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('omits the month filter when listing exchanges across the selected year', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ itens: [], contadores: { pendentes: 0, aprovadas: 0, recusadas: 0, aguardandoCoordenacao: 0 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })
    await listarTrocas({ status: 'pendentes', ano: 2026 })
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('status=pendentes&ano=2026&pagina=1&limite=50')
    expect(url).not.toContain('mes=')
  })

  it('sends decision DTOs and preserves conflict details for the interface', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'A escala foi atualizada.', impedimentos: [{ codigo: 'REVISAO_ABERTA', mensagem: 'A escala está em revisão.' }] }), { status: 409 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })
    const decision = { revisaoEsperada: 8, operacaoId: '123e4567-e89b-42d3-a456-426614174000', justificativa: 'Exceção autorizada', excecaoLimite: true }
    await expect(aprovarTroca('exchange-1', decision)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('A escala está em revisão.') })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(init.body))).toEqual(decision)
    await expect(recusarTroca('exchange-1', { revisaoEsperada: 8, operacaoId: decision.operacaoId, justificativa: 'Motivo' })).rejects.toBeInstanceOf(ApiError)
  })

  it('reports request timeout separately from a server conflict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')))
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => undefined })
    await expect(listarTrocas({ status: 'pendentes', ano: 2026, mes: 11 })).rejects.toMatchObject({ status: 0, message: 'A solicitação expirou. Tente novamente.' })
  })
})
