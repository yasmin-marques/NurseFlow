import { describe, expect, it } from 'vitest'
import { validateGenerationSelection } from './generation-form'

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

  it('valida os limites de ano e mês da API', () => {
    expect(validateGenerationSelection({ ...valid, year: 2101 })).toMatch(/ano/i)
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
