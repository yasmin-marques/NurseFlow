import { vi } from 'vitest'

type Reply = { status?: number; body?: unknown }
export type Call = { url: string; method: string; body: unknown; headers: Record<string, string> }

/** Substitui fetch/sessionStorage/window para exercitar os serviços sem navegador. */
export function mockBackend(handler: (call: Call) => Reply) {
  const calls: Call[] = []
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: Call = {
        url,
        method: init.method ?? 'GET',
        body: init.body ? JSON.parse(init.body as string) : undefined,
        headers: init.headers as Record<string, string>,
      }
      calls.push(call)
      const { status = 200, body = {} } = handler(call)
      return { ok: status < 400, status, json: async () => body }
    }),
  )
  return { calls, store }
}
