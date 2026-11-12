import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIncomingExchangeCount, getMyShifts } from '../../services/my-shifts'
import { NurseOverviewPage } from './NurseOverviewPage'

vi.mock('../../services/my-shifts', () => ({
  getIncomingExchangeCount: vi.fn(),
  getMyShifts: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('nurse overview page', () => {
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

    render(<NurseOverviewPage userName="Ana" onNavigate={vi.fn()} />)

    expect(await screen.findByText('Olá, Ana.')).not.toBeNull()
    expect(await screen.findByText('Bloco A · Enfermagem')).not.toBeNull()
    expect(await screen.findByText('2 solicitação(ões) recebida(s)')).not.toBeNull()
    expect(getMyShifts).toHaveBeenCalledOnce()
    expect(getIncomingExchangeCount).toHaveBeenCalledOnce()
  })
})
