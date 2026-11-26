import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExtrasPage } from './ExtrasPage'

function resposta(body: unknown, status = 200) {
  return { status, ok: status < 400, json: async () => body, headers: { get: () => null } }
}

const summary = { ano: 2026, mes: 6, totalExtrasAtivos: 3, totalHoras: 36, totalRpaAtivos: 2 }
const page = {
  itens: [{
    id: 'extra-1', data: '2026-06-18', opcao: '12n', setorId: { nome: 'Emergência' }, funcao: 'enfermeiro', motivo: 'ferias', situacao: 'programado', statusVinculo: 'sem_escala', substitutoId: { nome: 'Carla Santos', tipoVinculo: 'rpa' }, cobertoId: { nome: 'Ana Ribeiro' }, revisao: 1,
  }], total: 1, pagina: 1, limite: 12, totalPaginas: 1,
}

describe('ExtrasPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('carrega indicadores reais, listagem e reage à busca', async () => {
    const calls: string[] = []
    vi.stubGlobal('sessionStorage', { getItem: () => 'token', removeItem: () => undefined })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      if (url.includes('/setores')) return resposta([])
      if (url.includes('/extras/resumo')) return resposta(summary)
      if (url.includes('/escalas')) return resposta([{ pendencias: [{ faltam: 2 }], resumo: { vagasDescobertas: 1 }, plantoes: [] }])
      return resposta(page)
    }))

    render(<ExtrasPage />)

    expect(await screen.findByText('Carla Santos')).toBeTruthy()
    expect(screen.getByText('36h')).toBeTruthy()
    expect(screen.getByText(/Emergência/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('2 plantões descobertos')

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome, COREN ou motivo'), { target: { value: 'Carla' } })
    await waitFor(() => expect(calls.some((url) => url.includes('busca=Carla'))).toBe(true))
  })

  it('apresenta erro recuperável e estado vazio', async () => {
    let fail = true
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => undefined })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/setores')) return resposta([])
      if (fail && url.includes('/extras?')) return resposta({ message: 'Servidor indisponível' }, 503)
      if (url.includes('/extras/resumo')) return resposta(summary)
      if (url.includes('/escalas')) return resposta([])
      return resposta({ itens: [], total: 0, pagina: 1, limite: 12, totalPaginas: 0 })
    }))

    render(<ExtrasPage />)
    expect((await screen.findByRole('alert')).textContent).toContain('Servidor indisponível')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum extra encontrado')).toBeTruthy()
  })

  it('altera os campos obrigatórios conforme o motivo e preserva o fluxo do drawer', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'token', removeItem: () => undefined })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/setores')) return resposta([])
      if (url.includes('/profissionais')) return resposta({ data: [], meta: { totalPages: 1 } })
      if (url.includes('/extras/resumo')) return resposta(summary)
      if (url.includes('/escalas')) return resposta([])
      return resposta({ itens: [], total: 0, pagina: 1, limite: 12, totalPaginas: 0 })
    }))

    render(<ExtrasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar extra' }))
    expect(screen.getByRole('dialog', { name: /Registrar extra/ })).toBeTruthy()
    expect(screen.queryByLabelText(/Profissional coberto/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'ferias' } })
    expect(screen.getByLabelText(/Profissional coberto/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Registrar extra/ })).toBeNull())
  })
})
