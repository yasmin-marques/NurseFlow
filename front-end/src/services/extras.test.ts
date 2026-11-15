import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { cancelarExtra, criarExtra, editarExtra, listarExtras, obterResumoExtras } from './extras'

describe('extras API service', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('serializa período, busca, filtros e paginação na listagem real', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ itens: [], total: 0, pagina: 2, limite: 12, totalPaginas: 0 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })

    await listarExtras({ ano: 2026, mes: 6, busca: 'Carla', setorId: 'setor-1', motivo: 'ferias', situacao: 'programado', pagina: 2, limite: 12 })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/extras?')
    expect(url).toContain('ano=2026')
    expect(url).toContain('mes=6')
    expect(url).toContain('busca=Carla')
    expect(url).toContain('setorId=setor-1')
    expect(url).toContain('situacao=programado')
    expect(url).toContain('pagina=2')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('consulta indicadores mensais e preserva erros HTTP', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ano: 2026, mes: 6, totalExtrasAtivos: 3, totalHoras: 36, totalRpaAtivos: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Falha ao consultar extras' }), { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => undefined })

    await expect(obterResumoExtras(2026, 6)).resolves.toMatchObject({ totalExtrasAtivos: 3, totalHoras: 36 })
    await expect(listarExtras({ ano: 2026, mes: 6 })).rejects.toBeInstanceOf(ApiError)
  })

  it('envia registro, revisão esperada e cancelamento para a API real', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'extra-1', revisao: 1 }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'extra-1', revisao: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'extra-1', situacao: 'cancelado', revisao: 3 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('sessionStorage', { getItem: () => 'jwt-token', removeItem: () => undefined })

    await criarExtra({ data: '2026-06-18', opcao: '12n', setorId: 'setor-1', funcao: 'enfermeiro', substitutoId: 'p-1', motivo: 'reforco' })
    await editarExtra('extra-1', { revisaoEsperada: 1, observacao: 'ajuste' })
    await cancelarExtra('extra-1', { revisaoEsperada: 2, justificativa: 'cancelado' })

    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ['/api/extras', 'POST'], ['/api/extras/extra-1', 'PATCH'], ['/api/extras/extra-1/cancelar', 'POST'],
    ])
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({ revisaoEsperada: 1 })
  })
})
