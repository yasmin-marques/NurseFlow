// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'

const {
  downloadPublishedScale,
  getExchangeHistory,
  getPublishedScalesHistory,
} = vi.hoisted(() => ({
  downloadPublishedScale: vi.fn(),
  getExchangeHistory: vi.fn(),
  getPublishedScalesHistory: vi.fn(),
}))

vi.mock('../../services/history', () => ({
  downloadPublishedScale,
  getExchangeHistory,
  getPublishedScalesHistory,
}))

const scaleItem = {
  escalaId: 'scale-1',
  ano: 2026,
  mes: 4,
  numeroVersao: 2,
  publicadoEm: '2026-03-28T12:00:00.000Z',
  totalPlantoes: 50,
  percentualCobertura: 100,
}

const exchangeItem = {
  id: 'exchange-1',
  decididaEm: '2026-06-17T12:00:00.000Z',
  solicitante: { nome: 'Fernanda Lima' },
  profissionalSolicitado: { nome: 'Pedro Mendes' },
  resultado: 'aprovada' as const,
  responsavel: { nome: 'Paloma Ferreira' },
}

beforeEach(() => {
  vi.clearAllMocks()
  getPublishedScalesHistory.mockImplementation((ano: number) => Promise.resolve({
    ano,
    itens: [{ ...scaleItem, ano }],
  }))
  getExchangeHistory.mockImplementation(({ ano, pagina }: { ano: number; pagina: number }) => Promise.resolve({
    ano,
    itens: pagina === 1 ? [exchangeItem] : [{ ...exchangeItem, id: 'exchange-2' }],
    pagina,
    limite: 1,
    total: 2,
    totalPaginas: 2,
  }))
  downloadPublishedScale.mockResolvedValue({ blob: new Blob(['pdf']), filename: 'escala.pdf' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HistoryPage', () => {
  it('loads published scales by year and downloads the selected month PDF', async () => {
    const createObjectURL = vi.fn(() => 'blob:history')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<HistoryPage />)

    const year = new Date().getFullYear()
    expect(await screen.findByText(`Abril ${year}`)).not.toBeNull()
    expect(screen.getByText('Publicado em 28 MAR · 50 plantões')).not.toBeNull()
    expect(screen.getByText('● 100%')).not.toBeNull()
    expect(getPublishedScalesHistory).toHaveBeenCalledWith(year, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: /Baixar PDF da escala de Abril/ }))
    await waitFor(() => expect(downloadPublishedScale).toHaveBeenCalledWith('scale-1'))
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
  })

  it('changes section and year, and paginates exchange decisions', async () => {
    const user = userEvent.setup()
    render(<HistoryPage />)

    const year = new Date().getFullYear()
    const scalesTab = screen.getByRole('tab', { name: 'Escalas publicadas' })
    scalesTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Histórico de trocas' }).getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByText(/Fernanda Lima/)).not.toBeNull()
    expect(screen.getByText(/Pedro Mendes/)).not.toBeNull()
    expect(screen.getByText('Por Paloma Ferreira')).not.toBeNull()
    expect(getExchangeHistory).toHaveBeenCalledWith({ ano: year, pagina: 1 }, expect.any(AbortSignal))

    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(getExchangeHistory).toHaveBeenLastCalledWith(
      { ano: year, pagina: 2 },
      expect.any(AbortSignal),
    ))
    expect(screen.getByText('Página 2 de 2')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
    await waitFor(() => expect(getExchangeHistory).toHaveBeenLastCalledWith(
      { ano: year - 1, pagina: 1 },
      expect.any(AbortSignal),
    ))
    expect(within(screen.getByRole('tabpanel')).getByText('Página 1 de 2')).not.toBeNull()
  })

  it('shows empty and error states with retry', async () => {
    const year = new Date().getFullYear()
    getPublishedScalesHistory
      .mockResolvedValueOnce({ ano: year, itens: [] })
      .mockRejectedValueOnce(new Error('API indisponível'))
      .mockResolvedValueOnce({ ano: year - 1, itens: [{ ...scaleItem, ano: year - 1 }] })
    const user = userEvent.setup()
    render(<HistoryPage />)

    expect(await screen.findByText(`Nenhuma escala publicada em ${year}.`)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ano anterior' }))
    expect(await screen.findByText(/Falha ao carregar o histórico: API indisponível/)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(`Abril ${year - 1}`)).not.toBeNull()
  })
})
