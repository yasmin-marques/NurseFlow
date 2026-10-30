import type { ScaleStatus, ScheduledShift, ShiftBatchChange } from '../../services/scales'

export interface ShiftReviewGroup {
  date: string
  diurno: ScheduledShift[]
  noturno: ScheduledShift[]
  total: number
}

export const canEditScale = (status: ScaleStatus) => status !== 'publicada' && status !== 'finalizada'

export const canRemoveScaleDraft = (status: ScaleStatus) => status === 'rascunho'

export function stageShiftChange(
  stagedChanges: readonly ShiftBatchChange[],
  change: ShiftBatchChange,
): ShiftBatchChange[] {
  const unchanged = change.plantaoId
    ? stagedChanges.filter((item) => item.plantaoId !== change.plantaoId)
    : [...stagedChanges]
  return [...unchanged, change]
}

export function groupShiftsByDateAndTurn(shifts: readonly ScheduledShift[]): ShiftReviewGroup[] {
  const groups = new Map<string, ShiftReviewGroup>()

  for (const shift of shifts) {
    let group = groups.get(shift.data)
    if (!group) {
      group = { date: shift.data, diurno: [], noturno: [], total: 0 }
      groups.set(shift.data, group)
    }

    group.total += 1
    if (shift.duracaoHoras === 24) {
      group.diurno.push(shift)
      group.noturno.push(shift)
    } else if (shift.horarioInicio === '07:00') {
      group.diurno.push(shift)
    } else {
      group.noturno.push(shift)
    }
  }

  return [...groups.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((group) => ({
      ...group,
      diurno: [...group.diurno].sort((left, right) => left.setor.nome.localeCompare(right.setor.nome)),
      noturno: [...group.noturno].sort((left, right) => left.setor.nome.localeCompare(right.setor.nome)),
    }))
}
