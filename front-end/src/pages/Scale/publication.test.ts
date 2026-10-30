import { describe, expect, it } from 'vitest'
import type { ScaleDetail } from '../../services/scales'
import { getPublicationSummary, hasNurseCoverage, isScalePublished } from './publication'

const scaleWith = (overrides: Partial<ScaleDetail>): ScaleDetail => ({
  escala: {
    id: 'scale-1',
    ano: 2026,
    mes: 10,
    status: 'validada',
    revisao: 1,
    validacao: null,
    administradorId: 'admin-1',
    dataCriacao: '2026-10-01T00:00:00.000Z',
  },
  resumo: { plantoes: 0 },
  cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 100, percentual: 100 },
  configuracaoUtilizada: null,
  escopo: null,
  plantoes: [],
  pendencias: [],
  conflitos: [],
  avisos: [],
  cargas: [],
  ...overrides,
})

describe('getPublicationSummary', () => {
  it('uses the service coverage percentage when the scale is ready', () => {
    expect(getPublicationSummary(scaleWith({}))).toEqual({
      percentage: 100,
      filledPositions: 100,
      requiredPositions: 100,
      belowMinimumCount: 0,
      coverageOnly: false,
      blocked: false,
    })

    describe('isScalePublished', () => {
      it('only treats persisted published lifecycle states as publication success', () => {
        expect(isScalePublished(scaleWith({}))).toBe(false)
        expect(isScalePublished(scaleWith({
          escala: { ...scaleWith({}).escala, status: 'publicada' },
        }))).toBe(true)
        expect(isScalePublished(scaleWith({
          escala: { ...scaleWith({}).escala, status: 'finalizada' },
        }))).toBe(true)
      })

      describe('hasNurseCoverage', () => {
        const nurseShift: ScaleDetail['plantoes'][number] = {
          id: 'shift-1',
          data: '2026-10-01',
          setor: { id: 'sector-1', nome: 'UTI' },
          horarioInicio: '07:00',
          horarioFim: '19:00',
          duracaoHoras: 12,
          tipo: 'regular',
          profissionais: [{
            id: 'nurse-1',
            nome: 'Ana',
            formacao: 'enfermeiro',
            vinculo: 'clt',
            lideranca: false,
            origemCobertura: 'regular',
          }],
        }

        it('only reports covered shifts when every shift has a nurse and no nurse vacancy exists', () => {
          expect(hasNurseCoverage(scaleWith({ plantoes: [nurseShift] }))).toBe(true)
          expect(hasNurseCoverage(scaleWith({
            plantoes: [nurseShift],
            pendencias: [{
              setorId: 'sector-1',
              setor: 'UTI',
              data: '2026-10-01',
              turno: 'noturno',
              funcao: 'enfermeiros',
              necessario: 1,
              alocado: 0,
              faltam: 1,
              motivo: 'Sem enfermeiro',
            }],
          }))).toBe(false)
          expect(hasNurseCoverage(scaleWith({ plantoes: [] }))).toBe(false)
        })
      })
    })
  })

  it('counts unique coverage gaps and permits only coverage-only publication', () => {
    const vacancy: ScaleDetail['pendencias'][number] = {
      setorId: 'sector-1',
      setor: 'Setor A',
      data: '2026-10-01',
      turno: 'diurno',
      funcao: 'tecnicos',
      necessario: 3,
      alocado: 2,
      faltam: 1,
      motivo: 'Cobertura incompleta',
    }

    expect(getPublicationSummary(scaleWith({
      cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 94, percentual: 94 },
      pendencias: [
        vacancy,
        { ...vacancy, faltam: 2 },
        { ...vacancy, setorId: 'sector-2', setor: 'Setor B', data: '2026-10-02', turno: 'noturno' },
      ],
    }))).toEqual({
      percentage: 94,
      filledPositions: 94,
      requiredPositions: 100,
      belowMinimumCount: 2,
      coverageOnly: true,
      blocked: false,
    })
  })

  it('blocks publication when any conflict or warning accompanies coverage gaps', () => {
    const conflicting = getPublicationSummary(scaleWith({
      conflitos: [{ tipo: 'DESCANSO', motivo: 'Descanso insuficiente' }],
    }))
    const warning = getPublicationSummary(scaleWith({
      cobertura: { posicoesExigidas: 100, posicoesPreenchidas: 94, percentual: 94 },
      pendencias: [{
        setorId: 'sector-1',
        setor: 'Setor A',
        data: '2026-10-01',
        turno: 'diurno',
        funcao: 'tecnicos',
        necessario: 3,
        alocado: 2,
        faltam: 1,
        motivo: 'Cobertura incompleta',
      }],
      avisos: [{ tipo: 'DISPONIBILIDADE', motivo: 'Verificação incompleta' }],
    }))

    expect(conflicting.coverageOnly).toBe(false)
    expect(conflicting.blocked).toBe(true)
    expect(warning.coverageOnly).toBe(false)
    expect(warning.blocked).toBe(true)
  })
})
