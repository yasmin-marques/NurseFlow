import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentUser } from './services/auth'
import { getIncomingExchangeCount, getMyShifts } from './services/my-shifts'
import App from './App'

vi.mock('./services/auth', () => ({
  currentUser: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('./services/my-shifts', () => ({
  getIncomingExchangeCount: vi.fn(),
  getMyShifts: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App', () => {
  it('shows the professional dashboard and loads data for a technician session', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const data = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-')

    vi.mocked(currentUser).mockResolvedValue({
      id: 'technician-1',
      nome: 'Daniela Ferreira Alves',
      email: 'daniela@nurseflow.test',
      perfil: 'tecnico',
    })
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

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Olá, Daniela.' })).not.toBeNull()
    expect((await screen.findAllByText('Bloco B')).length).toBeGreaterThan(0)
    expect(getMyShifts).toHaveBeenCalledOnce()
    expect(getIncomingExchangeCount).toHaveBeenCalledOnce()
  })
})
