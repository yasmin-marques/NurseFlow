import { describe, expect, it } from 'vitest'
import type { ScheduleProfessional, ScheduledShift } from '../../services/scales'
import { describeShift, describeShiftBadge, groupDailyTeam } from './weeklyTeam'

const leader: ScheduleProfessional = {
  id: 'leader',
  nome: 'Ana Ribeiro',
  formacao: 'enfermeiro',
  vinculo: 'clt',
  lideranca: true,
  origemCobertura: 'regular',
}
const nurse: ScheduleProfessional = {
  id: 'nurse',
  nome: 'Bruna Costa',
  formacao: 'enfermeiro',
  vinculo: 'clt',
  lideranca: false,
  origemCobertura: 'regular',
}
const restrictedTechnician: ScheduleProfessional = {
  id: 'restricted-tech',
  nome: 'Caio Mendes',
  formacao: 'tecnico',
  vinculo: 'clt',
  lideranca: false,
  origemCobertura: 'restricao',
}
const complementaryTechnician: ScheduleProfessional = {
  id: 'complementary-tech',
  nome: 'Dora Lima',
  formacao: 'tecnico',
  vinculo: 'clt',
  lideranca: false,
  origemCobertura: 'complementar',
}

const shifts: ScheduledShift[] = [
  {
    id: 'shift-a',
    data: '2025-06-08',
    setor: { id: 'a', nome: 'Setor A' },
    horarioInicio: '07:00',
    horarioFim: '07:00',
    duracaoHoras: 24,
    tipo: 'regular',
    profissionais: [leader, nurse, restrictedTechnician],
  },
  {
    id: 'shift-emergency',
    data: '2025-06-08',
    setor: { id: 'emergency', nome: 'Emergência' },
    horarioInicio: '19:00',
    horarioFim: '07:00',
    duracaoHoras: 12,
    tipo: 'regular',
    profissionais: [leader, complementaryTechnician],
  },
]

describe('weekly team presentation', () => {
  it('groups unique professionals, sectors and technician coverage by shift', () => {
    const team = groupDailyTeam(shifts)

    expect(team.leaders.map(({ professional }) => professional.nome)).toEqual(['Ana Ribeiro'])
    expect(team.nurses.map(({ professional }) => professional.nome)).toEqual(['Bruna Costa'])
    expect(team.technicians.map(({ professional }) => professional.nome)).toEqual(['Caio Mendes', 'Dora Lima'])
    expect(team.responsibleSectors).toEqual(['Setor A', 'Emergência'])
    expect(team.leaders[0].sectors).toEqual(['Setor A', 'Emergência'])
    expect(team.technicianCoverage.map(({ setor, count }) => [setor, count])).toEqual([
      ['Setor A', 1],
      ['Emergência', 1],
    ])
  })

  it('describes leadership coverage and restriction/complementary labels from service data', () => {
    expect(describeShift(shifts[0])).toBe('24 horas · 07h—07h')
    expect(describeShiftBadge(restrictedTechnician, shifts[0])).toEqual({
      label: 'Baixa · 07h—07h · restrição',
      tone: 'covered',
    })
    expect(describeShiftBadge(complementaryTechnician, shifts[1])).toEqual({
      label: 'Retorna · 19h—07h · cobertura',
      tone: 'info',
    })
  })
})
