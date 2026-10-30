import { describe, expect, it } from 'vitest'
import type { ScheduledShift, ShiftBatchChange } from '../../services/scales'
import { canEditScale, canRemoveScaleDraft, groupShiftsByDateAndTurn, stageShiftChange } from './review'

const shift = (overrides: Partial<ScheduledShift>): ScheduledShift => ({
  id: 'shift-1',
  data: '2026-10-01',
  setor: { id: 'sector-1', nome: 'UTI' },
  horarioInicio: '07:00',
  horarioFim: '19:00',
  duracaoHoras: 12,
  tipo: 'regular',
  profissionais: [],
  ...overrides,
})

describe('groupShiftsByDateAndTurn', () => {
  it('agrupa por data e associa cada duração aos turnos que atende', () => {
    const groups = groupShiftsByDateAndTurn([
      shift({ id: 'night', data: '2026-10-02', horarioInicio: '19:00', horarioFim: '07:00' }),
      shift({ id: 'day' }),
      shift({ id: 'full-day', duracaoHoras: 24, horarioFim: '07:00' }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      date: '2026-10-01',
      total: 2,
      diurno: [{ id: 'day' }, { id: 'full-day' }],
      noturno: [{ id: 'full-day' }],
    })

    expect(groups[1]).toMatchObject({
      date: '2026-10-02',
      total: 1,
      diurno: [],
      noturno: [{ id: 'night' }],
    })
  })

  it('retorna vazio sem plantões', () => {
    expect(groupShiftsByDateAndTurn([])).toEqual([])
  })
})

describe('scale actions', () => {
  it('permite editar escalas em revisão e remover somente rascunhos', () => {
    expect(canEditScale('em_revisao')).toBe(true)
    expect(canEditScale('publicada')).toBe(false)
    expect(canEditScale('finalizada')).toBe(false)
    expect(canRemoveScaleDraft('rascunho')).toBe(true)
    expect(canRemoveScaleDraft('publicada')).toBe(false)
    expect(canRemoveScaleDraft('finalizada')).toBe(false)
  })

  describe('stageShiftChange', () => {
    const change = (plantaoId?: string): ShiftBatchChange => ({
      ...(plantaoId ? { plantaoId } : {}),
      setorId: 'sector-1',
      data: '2026-10-01',
      opcao: '12d',
      tipo: 'regular',
      equipe: [],
    })

    it('replaces an earlier staged edit for the same persisted shift', () => {
      const original = change('shift-1')
      const update = { ...change('shift-1'), data: '2026-10-02' }

      expect(stageShiftChange([original], update)).toEqual([update])
    })

    it('keeps other staged shifts and appends new shifts', () => {
      const existing = change('shift-1')
      const newShift = change()

      expect(stageShiftChange([existing], newShift)).toEqual([existing, newShift])
    })
  })
})
