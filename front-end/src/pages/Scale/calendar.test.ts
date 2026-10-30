import { describe, expect, it } from 'vitest'
import type { ScaleDetail } from '../../services/scales'
import { calendarDays, dateKey, dayIndicators, formatWeek, summarizeDayShifts } from './calendar'

const scale: ScaleDetail = {
  escala: {
    id: 'scale-1',
    ano: 2026,
    mes: 10,
    status: 'rascunho',
    revisao: 1,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2026-09-01T00:00:00.000Z',
  },
  resumo: { plantoes: 1, extras: 1 },
  cobertura: { posicoesExigidas: 10, posicoesPreenchidas: 8, percentual: 80 },
  configuracaoUtilizada: null,
  escopo: null,
  plantoes: [
    {
      id: 'shift-1',
      data: '2026-10-06',
      setor: { id: 'sector-1', nome: 'UTI' },
      horarioInicio: '07:00',
      horarioFim: '19:00',
      duracaoHoras: 12,
      tipo: 'extra',
      profissionais: [
        { id: 'nurse-1', nome: 'Ana Ribeiro', formacao: 'enfermeiro', vinculo: 'concursado', lideranca: true, origemCobertura: 'regular' },
        { id: 'nurse-2', nome: 'Lucas Mendes', formacao: 'enfermeiro', vinculo: 'concursado', lideranca: false, origemCobertura: 'regular' },
        { id: 'tech-1', nome: 'Rafael Rocha', formacao: 'tecnico', vinculo: 'clt', lideranca: false, origemCobertura: 'restricao' },
        { id: 'tech-2', nome: 'João Alves', formacao: 'tecnico', vinculo: 'clt', lideranca: false, origemCobertura: 'regular' },
        { id: 'tech-3', nome: 'Marina Costa', formacao: 'tecnico', vinculo: 'clt', lideranca: false, origemCobertura: 'regular' },
      ],
    },
  ],
  pendencias: [
    {
      setorId: 'sector-1',
      setor: 'UTI',
      data: '2026-10-06',
      turno: 'diurno',
      funcao: 'tecnicos',
      necessario: 2,
      alocado: 0,
      faltam: 2,
      motivo: 'Equipe incompleta',
    },
  ],
  conflitos: [],
  avisos: [],
  cargas: [],
}

describe('calendar model', () => {
  it('switches between a complete month grid and the selected week', () => {
    const anchor = new Date(2026, 9, 6)
    const month = calendarDays('month', anchor)
    const week = calendarDays('week', anchor)

    expect(month.length).toBeGreaterThanOrEqual(28)
    expect(month.length % 7).toBe(0)
    expect(month.some((day) => dateKey(day) === '2026-10-06')).toBe(true)
    expect(week.map(dateKey)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
  })

  it('formats week intervals in Portuguese without redundant years within one month', () => {
    expect(formatWeek(calendarDays('week', new Date(2025, 5, 8)))).toBe('8–14 de junho')
    expect(formatWeek(calendarDays('week', new Date(2025, 6, 1)))).toBe('29 de jun.–5 de jul. de 2025')
    expect(formatWeek(calendarDays('week', new Date(2025, 11, 29)))).toBe('28 de dez. de 2025–3 de jan. de 2026')
  })

  it('distinguishes empty periods and reports daily coverage, extras and conflicts', () => {
    expect(dayIndicators(null, '2026-10-06')).toMatchObject({
      shiftCount: 0,
      missingPositions: 0,
      conflictCount: 0,
      state: 'empty',
    })
    expect(dayIndicators(scale, '2026-10-06')).toMatchObject({
      shiftCount: 1,
      extras: 1,
      missingPositions: 2,
      state: 'partial',
    })
    expect(
      dayIndicators({ ...scale, conflitos: [{ tipo: 'DESCANSO', motivo: 'Descanso insuficiente', data: '2026-10-06' }] }, '2026-10-06')
        .state,
    ).toBe('conflict')
    expect(dayIndicators({ ...scale, pendencias: [] }, '2026-10-06').state).toBe('restricted')
    expect(dayIndicators({ ...scale, pendencias: [], plantoes: scale.plantoes.map((shift) => ({
      ...shift,
      profissionais: shift.profissionais.map((professional) => ({ ...professional, origemCobertura: 'regular' })),
    })) }, '2026-10-06').state).toBe('covered')
  })

  it('summarizes the daily leader and unique nurse and technician counts', () => {
    expect(summarizeDayShifts(scale.plantoes)).toMatchObject({
      leader: { nome: 'Ana Ribeiro' },
      nurses: 2,
      technicians: 3,
    })
  })
})
