import type { ScaleDetail } from '../../services/scales'

export type CalendarView = 'month' | 'week'

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarDays(view: CalendarView, anchor: Date): Date[] {
  const start = startOfDay(anchor)
  if (view === 'week') {
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }

  const first = new Date(start.getFullYear(), start.getMonth(), 1)
  const offset = first.getDay()
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const total = Math.ceil((offset + count) / 7) * 7
  const firstVisible = new Date(first)
  firstVisible.setDate(first.getDate() - offset)
  return Array.from({ length: total }, (_, index) => {
    const day = new Date(firstVisible)
    day.setDate(firstVisible.getDate() + index)
    return day
  })
}

export function dayIndicators(scale: ScaleDetail | null, key: string) {
  const shifts = scale?.plantoes.filter((shift) => shift.data === key) ?? []
  const vacancies = scale?.pendencias.filter((vacancy) => vacancy.data === key) ?? []
  const conflicts = scale?.conflitos.filter((conflict) => conflict.data === key) ?? []
  const missingPositions = vacancies.reduce((total, vacancy) => total + vacancy.faltam, 0)
  const restrictionCoverage = shifts.some((shift) =>
    shift.profissionais.some((professional) => professional.origemCobertura === 'restricao'),
  )
  return {
    shiftCount: shifts.length,
    extras: shifts.filter((shift) => shift.tipo === 'extra').length,
    missingPositions,
    conflictCount: conflicts.length,
    restrictionCoverage,
    state: conflicts.length > 0
      ? 'conflict'
      : missingPositions > 0
        ? 'partial'
        : restrictionCoverage
          ? 'restricted'
          : shifts.length > 0
            ? 'covered'
            : 'empty',
  } as const
}

export function summarizeDayShifts(shifts: readonly ScaleDetail['plantoes'][number][]) {
  const professionals = new Map(
    shifts.flatMap((shift) => shift.profissionais).map((professional) => [professional.id, professional]),
  )
  const team = [...professionals.values()]

  return {
    leader: team.find((professional) => professional.lideranca),
    nurses: team.filter((professional) => professional.formacao === 'enfermeiro').length,
    technicians: team.filter((professional) => professional.formacao === 'tecnico').length,
  }
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export function formatWeek(days: Date[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const firstDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' }).format(first)
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  if (sameMonth) {
    const end = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(last)
    return `${firstDay}–${end}`
  }
  const start = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    ...(first.getFullYear() !== last.getFullYear() ? { year: 'numeric' } : {}),
  }).format(first)
  const end = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(last)
  return `${start}–${end}`
}
