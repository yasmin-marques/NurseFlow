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
      body: { limiteTrocas: 4, maxExtrasConcursado: 3, maxExtrasClt: 1 },
    }))
    const result = await fetchSettings({ year: 2026, month: 10 })
    expect(calls[0].url).toBe('/api/configuracoes?ano=2026&mes=10')
    expect(result).toEqual({ swapLimitPerProfessional: 4, concursadoExtraLimit: 3, cltExtraLimit: 1 })
  })

  it('usa 0 quando a API ainda não tem os máximos de extras', async () => {
    mockBackend(() => ({ body: { limiteTrocas: 3 } }))
    expect(await fetchSettings({ year: 2026, month: 1 })).toMatchObject({
      concursadoExtraLimit: 0,
      cltExtraLimit: 0,
    })
  })

  it('salva via PATCH /configuracoes/limites com o token da sessão', async () => {
    const { calls, store } = mockBackend((call) => ({ body: call.body }))
    store.set('nurseflow.token', 'jwt-123')
    const result = await saveSettings(
      { swapLimitPerProfessional: 2, concursadoExtraLimit: 5, cltExtraLimit: 6 },
      { year: 2026, month: 3 },
    )
    expect(calls[0]).toMatchObject({
      url: '/api/configuracoes/limites?ano=2026&mes=3',
      method: 'PATCH',
      body: { limiteTrocas: 2, maxExtrasConcursado: 5, maxExtrasClt: 6 },
    })
    expect(calls[0].headers.Authorization).toBe('Bearer jwt-123')
    expect(result).toEqual({ swapLimitPerProfessional: 2, concursadoExtraLimit: 5, cltExtraLimit: 6 })
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
