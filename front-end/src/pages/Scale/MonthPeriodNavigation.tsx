import { calendarDate } from './calendar'

type MonthPeriodNavigationProps = {
  selectedDate: Date
  onChange: (date: Date) => void
  title?: string
  yearId?: string
  yearAriaLabel?: string
  yearOptions?: number[]
}

export function monthLabel(date: Date) {
  const month = date.toLocaleDateString('pt-BR', { month: 'long' })
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${date.getFullYear()}`
}

export function MonthPeriodNavigation({
  selectedDate,
  onChange,
  title,
  yearId = 'month-year',
  yearAriaLabel = 'Ano',
  yearOptions,
}: MonthPeriodNavigationProps) {
  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth() + 1
  const options = yearOptions ?? Array.from({ length: 11 }, (_, index) => year - 5 + index)
    .filter((item) => item >= 1 && item <= 9999)

  const changeMonth = (direction: -1 | 1) => {
    const next = calendarDate(year, month - 1 + direction, 1)
    if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) onChange(next)
  }

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:justify-start">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => changeMonth(-1)}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-lg font-semibold hover:bg-page"
      >
        ‹
      </button>
      <p aria-live="polite" className="min-w-0 text-center text-base font-bold text-text sm:min-w-45">
        {title ?? monthLabel(selectedDate)}
      </p>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => changeMonth(1)}
        className="flex size-9 items-center justify-center rounded-lg border border-border text-lg font-semibold hover:bg-page"
      >
        ›
      </button>
      <div className="relative ml-1">
        <label className="sr-only" htmlFor={yearId}>{yearAriaLabel}</label>
        <select
          id={yearId}
          aria-label={yearAriaLabel}
          value={year}
          onChange={(event) => {
            const next = calendarDate(Number(event.target.value), month - 1, 1)
            onChange(next)
          }}
          className="h-9 appearance-none rounded-lg border border-border bg-white pl-2 pr-9 text-xs font-semibold text-text"
        >
          {options.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </div>
    </div>
  )
}
