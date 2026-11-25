import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScaleShiftDialog } from './ScaleShiftDialog'
import { listProfessionals } from '../../services/professionals'
import { listSectors } from '../../services/sectors'
import {
  assignedLeaderId,
  buildShiftChanges,
  emptiedShifts,
  searchProfessionals,
  seedDayMembers,
  professionalsAvailableToAdd,
} from './shift-dialog.helpers'
import { stageShiftChanges } from './review'
import type { ScheduledShift, ShiftBatchChange } from '../../services/scales'
import type { Professional } from '../Professionals/types'

vi.mock('../../services/sectors', () => ({
  listSectors: vi.fn(async () => [{
    id: 'sector-1',
    name: 'Setor A',
    description: '',
    active: true,
    minimum: { nurses: 0, technicians: 0 },
    hasSubsectors: false,
    subsectors: [],
    techniciansWithoutSubsector: 0,
  }]),
}))

vi.mock('../../services/professionals', () => ({
  listProfessionals: vi.fn(async () => []),
}))

const shift: ScheduledShift = {
  id: 'shift-1',
  data: '2026-06-08',
  setor: { id: 'sector-1', nome: 'Setor A' },
  horarioInicio: '07:00',
  horarioFim: '19:00',
  duracaoHoras: 12,
  tipo: 'regular',
  profissionais: [
    { id: 'nurse-1', nome: 'Rafael Rocha', formacao: 'enfermeiro', vinculo: 'clt', lideranca: false, origemCobertura: 'regular' },
    { id: 'tech-1', nome: 'Bianca Silva', formacao: 'tecnico', vinculo: 'clt', lideranca: false, origemCobertura: 'regular' },
  ],
}

describe('ScaleShiftDialog leader selection', () => {
  it('does not infer the chief nurse from team order when leadership is not recorded', () => {
    expect(assignedLeaderId(shift)).toBeUndefined()
  })

  it('preserves the explicitly recorded chief nurse', () => {
    expect(assignedLeaderId({
      ...shift,
      profissionais: shift.profissionais.map((professional) => ({
        ...professional,
        lideranca: professional.id === 'nurse-1',
      })),
    })).toBe('nurse-1')
  })
})

describe('ScaleShiftDialog technician search', () => {
  const professionals: Professional[] = [
    { id: 'tech-1', name: 'Rafael Lima', formation: 'Técnico', status: true, bond: 'CLT', cpf: '', email: '', coren: '' },
    { id: 'tech-2', name: 'Bianca Silva', formation: 'Técnico', status: true, bond: 'CLT', cpf: '', email: '', coren: '' },
    { id: 'nurse-1', name: 'Ana Souza', formation: 'Enfemeiro', status: true, bond: 'CLT', cpf: '', email: '', coren: '' },
    { id: 'tech-inactive', name: 'Técnico Inativo', formation: 'Técnico', status: false, bond: 'CLT', cpf: '', email: '', coren: '' },
  ]

  it('offers active, unassigned nurses and technicians', () => {
    expect(professionalsAvailableToAdd(professionals, ['tech-2']).map((person) => person.id)).toEqual(['tech-1', 'nurse-1'])
  })

  it('filters eligible technicians by name without case sensitivity', () => {
    const eligible = professionalsAvailableToAdd(professionals, [])
    expect(searchProfessionals(eligible, 'RAFAEL').map((person) => person.id)).toEqual(['tech-1'])
  })
})

describe('ScaleShiftDialog day team', () => {
  it('shows a technician subsetor in the shift editor', async () => {
    const shiftWithSubsector: ScheduledShift = {
      ...shift,
      profissionais: shift.profissionais.map((person) => person.id === 'tech-1'
        ? { ...person, subsetor: { id: 'sub-a', nome: 'Clínica médica' } }
        : person),
    }
    render(
      <ScaleShiftDialog
        scale={{
          escala: {
            id: 'scale-1',
            ano: 2026,
            mes: 6,
            status: 'em_revisao',
            revisao: 2,
            validacao: null,
            administradorId: 'admin-1',
            dataCriacao: '2026-06-01T00:00:00.000Z',
          },
          resumo: { plantoes: 1 },
          cobertura: null,
          configuracaoUtilizada: null,
          escopo: null,
          plantoes: [shiftWithSubsector],
          pendencias: [],
          conflitos: [],
          avisos: [],
          cargas: [],
        }}
        dayShifts={[shiftWithSubsector]}
        initialDate="2026-06-08"
        stagedChanges={[]}
        onClose={() => undefined}
        onStaged={() => undefined}
      />,
    )

    expect(await screen.findByText(/Clínica médica/)).toBeTruthy()
  })

  it('groups available professionals and shows the assigned technicians in each dynamic subsetor', async () => {
    vi.mocked(listSectors).mockResolvedValue([{
      id: 'sector-1',
      name: 'Setor A',
      description: '',
      active: true,
      minimum: { nurses: 1, technicians: null },
      hasSubsectors: true,
      subsectors: [
        { id: 'sub-a', sectorId: 'sector-1', name: 'Subsetor A', description: '', active: true, minimumTechnicians: 1 },
        { id: 'sub-b', sectorId: 'sector-1', name: 'Subsetor B', description: '', active: true, minimumTechnicians: 1 },
      ],
      techniciansWithoutSubsector: 0,
    }])
    vi.mocked(listProfessionals).mockResolvedValue([
      { id: 'tech-1', name: 'Bianca Silva', formation: 'Técnico', status: true, bond: 'CLT', cpf: '', email: '', coren: '', sectorId: 'sector-1', subsectorId: 'sub-a', subsectorName: 'Clínica médica' },
      { id: 'tech-a', name: 'Técnica A', formation: 'Técnico', status: true, bond: 'CLT', cpf: '', email: '', coren: '', sectorId: 'sector-1', subsectorId: 'sub-a', subsectorName: 'Subsetor A' },
      { id: 'tech-b', name: 'Técnico B', formation: 'Técnico', status: true, bond: 'CLT', cpf: '', email: '', coren: '', sectorId: 'sector-1', subsectorId: 'sub-b', subsectorName: 'Subsetor B' },
      { id: 'nurse-2', name: 'Enfermeira C', formation: 'Enfemeiro', status: true, bond: 'CLT', cpf: '', email: '', coren: '', sectorId: 'sector-1' },
    ])
    render(
      <ScaleShiftDialog
        scale={{
          escala: {
            id: 'scale-1',
            ano: 2026,
            mes: 6,
            status: 'em_revisao',
            revisao: 2,
            validacao: null,
            administradorId: 'admin-1',
            dataCriacao: '2026-06-01T00:00:00.000Z',
          },
          resumo: { plantoes: 1 },
          cobertura: null,
          configuracaoUtilizada: null,
          escopo: null,
          plantoes: [shift],
          pendencias: [],
          conflitos: [],
          avisos: [],
          cargas: [],
        }}
        dayShifts={[shift]}
        initialDate="2026-06-08"
        stagedChanges={[]}
        onClose={() => undefined}
        onStaged={() => undefined}
      />,
    )

    const distribution = await screen.findByLabelText('Profissionais por subsetor')
    expect(screen.getByText('Subsetor B')).toBeTruthy()
    expect(distribution.textContent).toContain('Subsetor ABianca Silva')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar profissional ao setor/ }))

    const subsetorA = screen.getByRole('button', { name: /Subsetor A/ })
    expect(subsetorA.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(subsetorA)
    const eligibleA = screen.getByLabelText('Profissionais elegíveis: Subsetor A')
    expect(within(eligibleA).getByText('Técnica A')).toBeTruthy()
    expect(within(eligibleA).queryByText('Técnico B')).toBeNull()

    fireEvent.click(subsetorA)
    expect(screen.queryByLabelText('Profissionais elegíveis: Subsetor A')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Subsetor B/ }))
    const eligibleB = screen.getByLabelText('Profissionais elegíveis: Subsetor B')
    expect(within(eligibleB).getByText('Técnico B')).toBeTruthy()
    expect(within(eligibleB).queryByText('Técnica A')).toBeNull()
  })

  const night: ScheduledShift = {
    ...shift,
    id: 'shift-2',
    horarioInicio: '19:00',
    horarioFim: '07:00',
    profissionais: [
      { id: 'nurse-2', nome: 'Carla Dias', formacao: 'enfermeiro', vinculo: 'clt', lideranca: true, origemCobertura: 'regular' },
    ],
  }
  const led: ScheduledShift = {
    ...shift,
    profissionais: shift.profissionais.map((person) => ({ ...person, lideranca: person.id === 'nurse-1' })),
  }
  const formationOf = (id: string) => id.startsWith('nurse') ? 'enfermeiro' as const : 'tecnico' as const
  const base = { sectorId: 'sector-1', date: '2026-06-08', sectorShifts: [led, night], formationOf }

  it('lists every professional of the sector for the day with their own shift', () => {
    const members = seedDayMembers([led, night], [], 'sector-1', '2026-06-08')
    expect(members).toEqual([
      { id: 'nurse-1', option: '12d', leader: true },
      { id: 'tech-1', option: '12d', leader: false },
      { id: 'nurse-2', option: '12n', leader: true },
    ])
  })

  it('does not emit changes when nothing was edited', () => {
    const members = seedDayMembers([led, night], [], 'sector-1', '2026-06-08')
    expect(buildShiftChanges({ ...base, members })).toEqual([])
  })

  it('emits a change only for the shift whose team changed and creates missing shifts', () => {
    const members = [
      ...seedDayMembers([led, night], [], 'sector-1', '2026-06-08').filter((member) => member.id !== 'tech-1'),
      { id: 'tech-9', option: '24h' as const, leader: false },
    ]
    const changes = buildShiftChanges({ ...base, members })
    expect(changes.map((change) => [change.opcao, change.plantaoId])).toEqual([
      ['24h', undefined],
      ['12d', 'shift-1'],
    ])
    expect(changes[1].equipe).toEqual([{ profissionalId: 'nurse-1', funcao: 'enfermeiro', lideranca: true }])
  })

  it('flags existing shifts that would be left without professionals', () => {
    const members = seedDayMembers([led, night], [], 'sector-1', '2026-06-08').filter((member) => member.option !== '12n')
    expect(emptiedShifts([led, night], members).map((item) => item.id)).toEqual(['shift-2'])
  })

  it('reloads pending edits and replaces them for the same sector and day when staging again', () => {
    const pending: ShiftBatchChange = {
      setorId: 'sector-1',
      data: '2026-06-08',
      opcao: '12d',
      tipo: 'regular',
      plantaoId: 'shift-1',
      equipe: [{ profissionalId: 'nurse-1', funcao: 'enfermeiro', lideranca: true }],
    }
    const members = seedDayMembers([led, night], [pending], 'sector-1', '2026-06-08')
    expect(members.filter((member) => member.option === '12d').map((member) => member.id)).toEqual(['nurse-1'])

    const restaged = stageShiftChanges([pending], [], { setorId: 'sector-1', data: '2026-06-08', plantaoIds: ['shift-1', 'shift-2'] })
    expect(restaged).toEqual([])
  })
})
