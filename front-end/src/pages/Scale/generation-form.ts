import type { ScaleShift } from '../../services/scales'
import { daysInMonth } from './calendar'

export function isScaleReplaceable(status: string | null | undefined): boolean {
  return status === 'rascunho' || status === 'em_revisao'
}

export interface GenerationSelection {
  year: number
  month: number
  startDate: string
  endDate: string
  sectorIds: readonly string[]
  shifts: readonly ScaleShift[]
}

export function validateGenerationSelection(selection: GenerationSelection): string | null {
  const start = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selection.startDate)
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selection.endDate)
  if (!start || !end) return 'Informe a data inicial e a data final.'

  if (!Number.isInteger(selection.year) || selection.year < 1 || selection.year > 9999) {
    return 'Informe um ano entre 0001 e 9999.'
  }
  if (!Number.isInteger(selection.month) || selection.month < 1 || selection.month > 12) {
    return 'Informe um mês entre 1 e 12.'
  }
  const year = String(selection.year).padStart(4, '0')
  const expectedStart = `${year}-${String(selection.month).padStart(2, '0')}-01`
  const lastDay = daysInMonth(selection.year, selection.month)
  const expectedEnd = `${year}-${String(selection.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  if (
    selection.startDate !== expectedStart ||
    selection.endDate !== expectedEnd ||
    start[1] !== end[1] ||
    start[2] !== end[2] ||
    start[3] !== '01'
  ) {
    return 'A data inicial e a data final devem cobrir um mês completo.'
  }
  if (selection.sectorIds.length === 0) {
    return 'Selecione ao menos um setor.'
  }
  if (selection.shifts.length === 0) {
    return 'Selecione ao menos um turno.'
  }
  return null
}
