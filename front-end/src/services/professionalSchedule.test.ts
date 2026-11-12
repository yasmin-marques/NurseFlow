import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { getGeneralDay, getGeneralMonth, getMyShifts } from './professionalSchedule'

function stub(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })
  return fetchMock
}

describe('professional schedule service', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the own shifts with situation and paging, never a professional id', async () => {
    const fetchMock = stub(new Response(JSON.stringify({ itens: [], pagina: 2, limite: 20, total: 0, totalPaginas: 1 }), { status: 200 }))
    await getMyShifts('anteriores', 2)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/escala-profissional/meus-plantoes?situacao=anteriores&pagina=2&limite=20')
    expect(url).not.toContain('profissionalId')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('serializes the general month and day queries', async () => {
    const fetchMock = stub(new Response(JSON.stringify({ ano: 2026, mes: 11, publicada: false, versao: null, dias: [] }), { status: 200 }))
    await getGeneralMonth(2026, 11)
    await getGeneralDay('2026-11-10')
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain('/escala-profissional/geral?ano=2026&mes=11')
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain('/escala-profissional/geral/dia?data=2026-11-10')
  })

  it('surfaces API failures with their status', async () => {
    stub(new Response(JSON.stringify({ message: 'Esta consulta está disponível apenas para profissionais da escala.' }), { status: 403 }))
    await expect(getMyShifts('proximos')).rejects.toMatchObject({ status: 403 })
    await expect(getMyShifts('proximos')).rejects.toBeInstanceOf(ApiError)
  })
})
