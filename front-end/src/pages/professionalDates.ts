/** Datas da escala são dias de calendário (AAAA-MM-DD); tudo em UTC para não deslocar o dia pelo fuso local. */
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const monthName = (month: number) => MONTHS[month - 1]
export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function parseDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export const dayKey = (date: Date) => date.toISOString().slice(0, 10)
export const dayNumber = (key: string) => String(Number(key.slice(8, 10)))
export const weekdayLabel = (key: string) => WEEKDAYS[parseDay(key).getUTCDay()]

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86_400_000)
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getUTCDay())
}

/** Semana (domingo a sábado) que melhor representa o mês: a primeira cujo meio cai dentro dele. */
export function firstWeekOfMonth(year: number, month: number): Date {
  const start = startOfWeek(new Date(Date.UTC(year, month - 1, 1)))
  return addDays(start, 3).getUTCMonth() === month - 1 ? start : addDays(start, 7)
}

/** Mês exibido para uma semana: o do meio dela. */
export function monthOfWeek(weekStart: Date): { year: number; month: number } {
  const middle = addDays(weekStart, 3)
  return { year: middle.getUTCFullYear(), month: middle.getUTCMonth() + 1 }
}

export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const startMonth = monthName(weekStart.getUTCMonth() + 1)
  const endMonth = monthName(end.getUTCMonth() + 1)
  return weekStart.getUTCMonth() === end.getUTCMonth()
    ? `${weekStart.getUTCDate()}—${end.getUTCDate()} de ${endMonth}`
    : `${weekStart.getUTCDate()} de ${startMonth} — ${end.getUTCDate()} de ${endMonth}`
}

export const hourLabel = (time: string) => `${time.slice(0, 2)}h`
export const timeRange = (start: string, end: string) => `${hourLabel(start)}—${hourLabel(end)}`

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}
