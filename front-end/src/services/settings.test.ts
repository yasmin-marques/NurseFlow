import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBackend } from '../test/fetchMock'
import { ApiError } from './api'
import { currentPeriod, fetchSettings, saveSettings } from './settings'

afterEach(() => vi.unstubAllGlobals())

describe('services/settings', () => {
  it('calcula o período a partir da data (mês 1-12)', () => {
    expect(currentPeriod(new Date(2026, 9, 12))).toEqual({ year: 2026, month: 10 })
  })

  it('carrega as configurações do período e mapeia os campos da API', async () => {
    const { calls } = mockBackend(() => ({
      body: {
        limiteTrocas: 4,
        maxExtrasConcursado: 3,
        maxExtrasClt: 1,
        cargas: {
          concursado_31: { plantoes24h: 6, plantoes12h: 1 },
          clt_31: { plantoes24h: 5, plantoes12h: 2 },
        },
      },
    }))
    const result = await fetchSettings({ year: 2026, month: 10 })
    expect(calls[0].url).toBe('/api/configuracoes?ano=2026&mes=10')
    expect(result).toEqual({
      swapLimitPerProfessional: 4,
      concursadoExtraLimit: 3,
      cltExtraLimit: 1,
      concursadoShift24h: 6,
      concursadoShift12h: 1,
      cltShift24h: 5,
      cltShift12h: 2,
    })
  })

  it('usa 0 quando a API ainda não tem os máximos de extras', async () => {
    mockBackend(() => ({ body: { limiteTrocas: 3 } }))
    expect(await fetchSettings({ year: 2026, month: 1 })).toMatchObject({
      concursadoExtraLimit: 0,
      cltExtraLimit: 0,
    })
  })

  it('consulta períodos de anos e meses diferentes sem restringir ao mês atual', async () => {
    const { calls } = mockBackend(() => ({ body: { limiteTrocas: 3 } }))
    await fetchSettings({ year: 2099, month: 12 })
    await fetchSettings({ year: 2000, month: 1 })

    expect(calls.map((call) => call.url)).toEqual([
      '/api/configuracoes?ano=2099&mes=12',
      '/api/configuracoes?ano=2000&mes=01',
    ])
  })

  it('salva via PATCH /configuracoes/limites com o token da sessão', async () => {
    const { calls, store } = mockBackend((call) => {
      const body = call.body as {
        limiteTrocas: number
        maxExtrasConcursado: number
        maxExtrasClt: number
        cargas: Array<{
          vinculo: string
          diasMes: number
          plantoes24h: number
          plantoes12h: number
        }>
      }
      return {
        body: {
          limiteTrocas: body.limiteTrocas,
          maxExtrasConcursado: body.maxExtrasConcursado,
          maxExtrasClt: body.maxExtrasClt,
          cargas: Object.fromEntries(body.cargas.map((carga) => [
            `${carga.vinculo}_${carga.diasMes}`,
            { plantoes24h: carga.plantoes24h, plantoes12h: carga.plantoes12h },
          ])),
        },
      }
    })
    store.set('nurseflow.token', 'jwt-123')
    const result = await saveSettings(
      {
        swapLimitPerProfessional: 2,
        concursadoExtraLimit: 5,
        cltExtraLimit: 6,
        concursadoShift24h: 4,
        concursadoShift12h: 3,
        cltShift24h: 2,
        cltShift12h: 5,
      },
      { year: 2026, month: 3 },
    )
    expect(calls[0]).toMatchObject({
      url: '/api/configuracoes/limites?ano=2026&mes=03',
      method: 'PATCH',
      body: {
        limiteTrocas: 2,
        maxExtrasConcursado: 5,
        maxExtrasClt: 6,
        cargas: [
          { vinculo: 'concursado', diasMes: 31, plantoes24h: 4, plantoes12h: 3 },
          { vinculo: 'clt', diasMes: 31, plantoes24h: 2, plantoes12h: 5 },
        ],
      },
    })
    expect(calls[0].headers.Authorization).toBe('Bearer jwt-123')
    expect(result).toEqual({
      swapLimitPerProfessional: 2,
      concursadoExtraLimit: 5,
      cltExtraLimit: 6,
      concursadoShift24h: 4,
      concursadoShift12h: 3,
      cltShift24h: 2,
      cltShift12h: 5,
    })
  })

  it('propaga a mensagem de erro do servidor (ex.: 403 para perfis sem permissão)', async () => {
    mockBackend(() => ({ status: 403, body: { message: 'Acesso negado.' } }))
    await expect(fetchSettings({ year: 2026, month: 10 })).rejects.toMatchObject({
      status: 403,
      message: 'Acesso negado.',
    })
    await expect(fetchSettings()).rejects.toBeInstanceOf(ApiError)
  })
})
