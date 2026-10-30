import { describe, expect, it } from 'vitest'
import { isScaleReplaceable, validateGenerationSelection } from './generation-form'

describe('isScaleReplaceable', () => {
  it('permite regenerar rascunhos e escalas em revisão', () => {
    expect(isScaleReplaceable('rascunho')).toBe(true)
    expect(isScaleReplaceable('em_revisao')).toBe(true)
  })

  it('preserva escalas validadas, publicadas e finalizadas', () => {
    expect(isScaleReplaceable('validada')).toBe(false)
    expect(isScaleReplaceable('publicada')).toBe(false)
    expect(isScaleReplaceable('finalizada')).toBe(false)
    expect(isScaleReplaceable(null)).toBe(false)
  })
})

describe('validateGenerationSelection', () => {
  const valid = {
    year: 2026,
    month: 10,
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    sectorIds: ['sector-1'],
    shifts: ['diurno'] as const,
  }

  it('aceita período com setor e turno selecionados', () => {
    expect(validateGenerationSelection(valid)).toBeNull()
  })

  it('aceita os anos civis de quatro dígitos e valida mês inválido', () => {
    expect(validateGenerationSelection({
      ...valid,
      year: 1,
      startDate: '0001-10-01',
      endDate: '0001-10-31',
    })).toBeNull()
    expect(validateGenerationSelection({
      ...valid,
      year: 9999,
      startDate: '9999-10-01',
      endDate: '9999-10-31',
    })).toBeNull()
    expect(validateGenerationSelection({ ...valid, year: 0 })).toMatch(/ano/i)
    expect(validateGenerationSelection({ ...valid, month: 13 })).toMatch(/mês/i)
  })

  it('exige o mês completo por compatibilidade com a API mensal', () => {
    expect(validateGenerationSelection({ ...valid, startDate: '2026-10-02' })).toMatch(/mês completo/i)
    expect(validateGenerationSelection({ ...valid, endDate: '2026-11-01' })).toMatch(/mês completo/i)
  })

  it('exige ao menos um setor e um turno', () => {
    expect(validateGenerationSelection({ ...valid, sectorIds: [] })).toMatch(/setor/i)
    expect(validateGenerationSelection({ ...valid, shifts: [] })).toMatch(/turno/i)
  })
})
