import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadPublishedScale, getExchangeHistory, getPublishedScalesHistory } from './history'
import { mockBackend } from '../test/fetchMock'

afterEach(() => vi.unstubAllGlobals())

describe('services/history', () => {
  it('consulta escalas publicadas e trocas paginadas do ano selecionado', async () => {
    const { calls } = mockBackend((call) => ({
      body: call.url.includes('/trocas/')
        ? { ano: 2025, itens: [], pagina: 2, limite: 20, total: 25, totalPaginas: 2 }
        : { ano: 2025, itens: [] },
    }))

    await getPublishedScalesHistory(2025)
    const exchanges = await getExchangeHistory({ ano: 2025, pagina: 2 })

    expect(calls.map(({ url, method }) => [url, method])).toEqual([
      ['/api/escalas/historico?ano=2025', 'GET'],
      ['/api/trocas/historico?ano=2025&pagina=2&limite=20', 'GET'],
    ])
    expect(exchanges).toMatchObject({ pagina: 2, total: 25, totalPaginas: 2 })
  })

  it('baixa o PDF pela rota oficial já existente', async () => {
    const file = new Blob(['pdf'])
    const { calls } = mockBackend(() => ({
      blob: file,
      headers: { 'Content-Disposition': 'attachment; filename="escala-2025-01-geral.pdf"' },
    }))

    const result = await downloadPublishedScale('scale-1')

    expect(calls[0]).toMatchObject({ url: '/api/escalas/scale-1/pdf', method: 'GET' })
    expect(result).toEqual({ blob: file, filename: 'escala-2025-01-geral.pdf' })
  })
})
