import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIncomingExchangeCount, getMyShifts } from '../../services/my-shifts'
import { ProfessionalOverviewPage } from './ProfessionalOverviewPage'

vi.mock('../../services/my-shifts', () => ({
  getIncomingExchangeCount: vi.fn(),
  getMyShifts: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('professional overview page', () => {
  it('renders upcoming shifts and exchange count returned by the API', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const data = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-')

    vi.mocked(getMyShifts).mockResolvedValue({
      plantoes: [{
        id: 'shift-1',
        data,
        setor: 'Bloco A',
        horarioInicio: '07:00',
        horarioFim: '19:00',
        duracaoHoras: 12,
        tipo: 'regular',
        funcao: 'enfermeiro',
        lideranca: false,
        escala: { ano: tomorrow.getFullYear(), mes: tomorrow.getMonth() + 1 },
      }],
    })
    vi.mocked(getIncomingExchangeCount).mockResolvedValue({ recebidas: 2 })

    render(<ProfessionalOverviewPage userName="Ana" onNavigate={vi.fn()} />)

    expect(await screen.findByText('Olá, Ana.')).not.toBeNull()
    expect(await screen.findByText('Bloco A · Enfermagem')).not.toBeNull()
    expect(await screen.findByText('2 solicitação(ões) recebida(s)')).not.toBeNull()
    expect(getMyShifts).toHaveBeenCalledOnce()
    expect(getIncomingExchangeCount).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    expect(screen.getByRole('heading', { name: 'Informações do plantão' })).not.toBeNull()
    expect(screen.getByText('Observações')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Solicitar troca' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Voltar para meus plantões/ }))
    expect(screen.getByRole('heading', { name: 'Olá, Ana.' })).not.toBeNull()
  })

  it('switches the main card to its neutral style after the next shift passes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 6, 58))
    vi.mocked(getMyShifts).mockResolvedValue({
      plantoes: [{
        id: 'shift-1',
        data: '2026-01-01',
        setor: 'Bloco A',
        horarioInicio: '07:00',
        horarioFim: '19:00',
        duracaoHoras: 12,
        tipo: 'regular',
        funcao: 'enfermeiro',
        lideranca: false,
        escala: { ano: 2026, mes: 1 },
      }],
    })
    vi.mocked(getIncomingExchangeCount).mockResolvedValue({ recebidas: 0 })

    render(<ProfessionalOverviewPage userName="Ana" onNavigate={vi.fn()} />)
    await act(async () => {
      await Promise.resolve()
    })

    const mainCard = screen.getByRole('region', { name: 'Próximo plantão' })
    expect(mainCard.className).toContain('bg-[#07833b]')

    await act(async () => {
      vi.advanceTimersByTime(3 * 60_000)
    })

    expect(mainCard.className).toContain('bg-[#f1f3f0]')
    expect(screen.getByText('Nenhum plantão futuro encontrado')).not.toBeNull()
  })

  it('labels technician shifts as Técnico', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const data = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-')

    vi.mocked(getMyShifts).mockResolvedValue({
      plantoes: [{
        id: 'shift-technician',
        data,
        setor: 'Bloco B',
        horarioInicio: '19:00',
        horarioFim: '07:00',
        duracaoHoras: 12,
        tipo: 'regular',
        funcao: 'tecnico',
        lideranca: false,
        escala: { ano: tomorrow.getFullYear(), mes: tomorrow.getMonth() + 1 },
      }],
    })
    vi.mocked(getIncomingExchangeCount).mockResolvedValue({ recebidas: 0 })

    render(<ProfessionalOverviewPage userName="Daniela" onNavigate={vi.fn()} />)

    expect((await screen.findAllByText('Bloco B')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Técnico').length).toBeGreaterThan(0)
  })
})
