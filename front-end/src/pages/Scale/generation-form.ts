import type { ScaleShift } from '../../services/scales'

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

  if (!Number.isInteger(selection.year) || selection.year < 2020 || selection.year > 2100) {
    return 'Informe um ano entre 2020 e 2100.'
  }
  if (!Number.isInteger(selection.month) || selection.month < 1 || selection.month > 12) {
    return 'Informe um mês entre 1 e 12.'
  }
  const expectedStart = `${selection.year}-${String(selection.month).padStart(2, '0')}-01`
  const lastDay = new Date(selection.year, selection.month, 0).getDate()
  const expectedEnd = `${selection.year}-${String(selection.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
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
