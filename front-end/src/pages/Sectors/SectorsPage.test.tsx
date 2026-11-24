import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectorsPage } from './SectorsPage'
import { EditSectorMinimumModal } from './components/EditSectorMinimumModal'
import { minimumSummary } from './sectorForm'
import type { Sector } from './types'

const services = vi.hoisted(() => ({ listSectors: vi.fn(), updateSectorMinimum: vi.fn() }))
vi.mock('../../services/sectors', async (original) => ({
  ...(await original<typeof import('../../services/sectors')>()),
  listSectors: services.listSectors,
  updateSectorMinimum: services.updateSectorMinimum,
}))

const apiUti = {
  id: 's1',
  nome: 'UTI',
  ativo: true,
  possuiSubsetores: true,
  plantao24h: { enfermeiros: 2, tecnicos: null },
  tecnicosSemSubsetor: 0,
  subsetores: [
    { id: 'u1', setorId: 's1', nome: 'UTI Adulto', ativo: true, plantao24h: { tecnicos: 2 } },
    { id: 'u2', setorId: 's1', nome: 'UTI Intermediária', ativo: true, plantao24h: { tecnicos: 1 } },
  ],
}
const apiClinica = { id: 's2', nome: 'Clínica Médica', ativo: true, possuiSubsetores: false, plantao24h: { enfermeiros: 2, tecnicos: 3 }, subsetores: [] }

const fromApiSector = (s: typeof apiUti | typeof apiClinica): Sector => ({
  id: s.id,
  name: s.nome,
  description: '',
  active: s.ativo,
  hasSubsectors: s.possuiSubsetores,
  minimum: { nurses: s.plantao24h.enfermeiros, technicians: s.plantao24h.tecnicos },
  techniciansWithoutSubsector: 0,
  subsectors: s.subsetores.map((sub) => ({
    id: sub.id, sectorId: s.id, name: sub.nome, description: '', active: sub.ativo, minimumTechnicians: sub.plantao24h.tecnicos,
  })),
})

describe('SectorsPage', () => {
  it('exibe os mínimos persistidos: por subsetor no setor com subsetores e enfermeiros/técnicos no setor simples', async () => {
    services.listSectors.mockResolvedValue([apiUti, apiClinica].map(fromApiSector))
    render(<SectorsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /UTI/ }))
    expect(screen.getByText('2 enfermeiros · técnicos distribuídos por subsetor')).toBeTruthy()
    expect(screen.getByText('UTI Adulto').parentElement?.textContent).toContain('UTI Adulto')
    expect(screen.getByText('2 técnicos')).toBeTruthy()
    expect(screen.getByText('UTI Intermediária')).toBeTruthy()
    expect(screen.getByText('1 técnico')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Clínica Médica/ }))
    expect(screen.getByText('2 enfermeiros · 3 técnicos')).toBeTruthy()
  })

  it('"Editar mínimo" salva todos os mínimos de uma vez e a tela passa a mostrar os valores novos', async () => {
    const atualizado = {
      ...apiUti,
      plantao24h: { enfermeiros: 4, tecnicos: null },
      subsetores: [
        { ...apiUti.subsetores[0], plantao24h: { tecnicos: 3 } },
        { ...apiUti.subsetores[1], plantao24h: { tecnicos: 1 } },
      ],
    }
    services.listSectors.mockResolvedValue([fromApiSector(apiUti)])
    services.updateSectorMinimum.mockResolvedValue(fromApiSector(atualizado))
    render(<SectorsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /UTI/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar mínimo' }))

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aumentar enfermeiros' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aumentar enfermeiros' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aumentar técnicos de UTI Adulto' }))
    fireEvent.submit(within(dialog).getByRole('button', { name: 'Salvar quantitativos' }).closest('form')!)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(services.updateSectorMinimum).toHaveBeenCalledWith('s1', {
      nurses: 4,
      technicians: null,
      subsectors: [
        { id: 'u1', minimumTechnicians: 3 },
        { id: 'u2', minimumTechnicians: 1 },
      ],
    })
    expect(screen.getByText('4 enfermeiros · técnicos distribuídos por subsetor')).toBeTruthy()
    expect(screen.getByText('3 técnicos')).toBeTruthy()
  })
})

describe('EditSectorMinimumModal', () => {
  const base: Sector = {
    id: 's2', name: 'Clínica Médica', description: '', active: true, hasSubsectors: false,
    minimum: { nurses: 2, technicians: 3 }, subsectors: [], techniciansWithoutSubsector: 0,
  }

  it('setor sem subsetores edita enfermeiros e técnicos juntos', async () => {
    const onSave = vi.fn()
    render(<EditSectorMinimumModal sector={base} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir técnicos de enfermagem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar enfermeiros' }))
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar quantitativos' }).closest('form')!)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ nurses: 3, technicians: 2 }))
  })

  it('setor com subsetores não oferece técnicos do setor, só os de cada subsetor ativo', () => {
    const sector: Sector = {
      ...base, hasSubsectors: true, minimum: { nurses: 2, technicians: null },
      subsectors: [
        { id: 'u1', sectorId: 's2', name: 'Ala A', description: '', active: true, minimumTechnicians: 2 },
        { id: 'u2', sectorId: 's2', name: 'Ala B', description: '', active: false, minimumTechnicians: 1 },
      ],
    }
    render(<EditSectorMinimumModal sector={sector} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'técnicos de enfermagem' })).toBeNull()
    expect(screen.getByRole('group', { name: 'técnicos de Ala A' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'técnicos de Ala B' })).toBeNull()
  })

  it('minimumSummary usa singular e plural', () => {
    expect(minimumSummary({ ...base, minimum: { nurses: 1, technicians: 1 } })).toBe('1 enfermeiro · 1 técnico')
  })
})
