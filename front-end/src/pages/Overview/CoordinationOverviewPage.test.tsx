// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoordinationOverviewPage } from './CoordinationOverviewPage'

const services = vi.hoisted(() => ({
  addShift: vi.fn(),
  createDraft: vi.fn(),
  exportScalePdf: vi.fn(),
  listScales: vi.fn(),
  startReview: vi.fn(),
  createProfessional: vi.fn(),
  listProfessionals: vi.fn(),
  fetchAllRestrictions: vi.fn(),
  listSectors: vi.fn(),
  listarTrocas: vi.fn(),
}))

vi.mock('../../services/scales', () => services)
vi.mock('../../services/professionals', () => ({
  createProfessional: services.createProfessional,
  listProfessionals: services.listProfessionals,
}))
vi.mock('../../services/restriction', () => ({ fetchAllRestrictions: services.fetchAllRestrictions }))
vi.mock('../../services/sectors', () => ({ listSectors: services.listSectors }))
vi.mock('../../services/trocas', () => ({ listarTrocas: services.listarTrocas }))

describe('CoordinationOverviewPage quick actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    services.listScales.mockResolvedValue([])
    services.listProfessionals.mockResolvedValue([])
    services.listSectors.mockResolvedValue([])
    services.listarTrocas.mockResolvedValue({ contadores: { aguardandoCoordenacao: 0 } })
    services.fetchAllRestrictions.mockResolvedValue({
      records: { restrictions: [], externalLinks: [], absences: [] },
      professionals: [],
    })
  })

  afterEach(() => cleanup())

  it('opens the existing professional, extra, and PDF forms from the dashboard', async () => {
    const user = userEvent.setup()
    render(<CoordinationOverviewPage userName="Paloma" onNavigate={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Bom dia, Paloma.' })

    await user.click(screen.getByRole('button', { name: /Novo profissional/ }))
    const professionalDialog = await screen.findByRole('dialog', { name: 'Cadastrar profissional' })
    await user.click(within(professionalDialog).getByRole('button', { name: 'Fechar perfil' }))

    await user.click(screen.getByRole('button', { name: /Registrar extra/ }))
    const extraDialog = await screen.findByRole('dialog', { name: 'Registrar Extra' })
    await user.click(within(extraDialog).getByRole('button', { name: 'Cancelar' }))

    await user.click(screen.getByRole('button', { name: /Exportar escala/ }))
    expect(await screen.findByRole('dialog', { name: 'Exportar PDF' })).toBeTruthy()
  })
})
