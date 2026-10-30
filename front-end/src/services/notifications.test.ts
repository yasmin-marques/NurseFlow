import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNotifiedScaleVersion, listScaleNotifications, markScaleNotificationRead } from './notifications'
import { mockBackend } from '../test/fetchMock'

afterEach(() => vi.unstubAllGlobals())

describe('services/notifications', () => {
  it('lista notificações do usuário e o total não lido', async () => {
    const body = { notificacoes: [{ id: 'notice-1', versao: 2 }], naoLidas: 1 }
    const { calls } = mockBackend(() => ({ body }))

    await expect(listScaleNotifications()).resolves.toEqual(body)
    expect(calls[0]).toMatchObject({ url: '/api/notificacoes/escalas', method: 'GET' })
  })

  it('marca como lida e consulta somente uma versão notificada', async () => {
    const { calls } = mockBackend((call) =>
      call.method === 'PATCH'
        ? { body: { id: 'notice/1', lidaEm: '2026-10-29T12:00:00.000Z' } }
        : { body: { versao: { numero: 2 }, snapshot: {} } },
    )

    await markScaleNotificationRead('notice/1')
    await getNotifiedScaleVersion('scale/1', 2)

    expect(calls.map(({ url, method }) => ({ url, method }))).toEqual([
      { url: '/api/notificacoes/escalas/notice%2F1/lida', method: 'PATCH' },
      { url: '/api/notificacoes/escalas/scale%2F1/versoes/2', method: 'GET' },
    ])
  })
})
