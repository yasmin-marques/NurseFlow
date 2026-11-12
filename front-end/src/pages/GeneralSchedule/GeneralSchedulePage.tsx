import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, X } from '../../components/icons'
import { Modal } from '../../components/ui/Modal'
import {
  getGeneralDay,
  getGeneralMonth,
  type DayShift,
  type DayStaff,
  type GeneralDay,
  type GeneralDayDetails,
  type GeneralMonth,
} from '../../services/professionalSchedule'
import {
  addDays,
  capitalized,
  dayKey,
  dayNumber,
  firstWeekOfMonth,
  initials,
  monthName,
  monthOfWeek,
  parseDay,
  startOfWeek,
  timeRange,
  weekdayLabel,
  weekRangeLabel,
} from '../professionalDates'

const SHIFT_LABEL: Record<DayShift, string> = { diurno: 'DIURNO', noturno: 'NOTURNO', '24h': '24 HORAS' }

function today(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function monthsOfWeek(weekStart: Date): { ano: number; mes: number }[] {
  const seen = new Map<string, { ano: number; mes: number }>()
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(weekStart, offset)
    const entry = { ano: day.getUTCFullYear(), mes: day.getUTCMonth() + 1 }
    seen.set(`${entry.ano}-${entry.mes}`, entry)
  }
  return [...seen.values()]
}

function regimeStyle(regime: string): string {
  if (regime.includes('restrição')) return 'bg-secondary text-primary'
  if (regime.includes('cobertura')) return 'bg-badge-blue text-badge-blue-text'
  return 'bg-warning text-warning-text'
}

function StaffRow({ person }: { person: DayStaff }) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary">
        {initials(person.nome)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-text">{person.nome}</p>
        <p className="truncate text-[11px] text-text-muted">{person.cargo}</p>
      </div>
      <p className="col-start-2 text-[12px] text-text-muted sm:col-start-auto">{person.setores.join(' e ') || '—'}</p>
      <span className={`col-start-2 justify-self-start rounded-md px-2.5 py-1 text-[10px] font-bold sm:col-start-auto sm:justify-self-end ${regimeStyle(person.regime)}`}>
        {person.regime}
      </span>
    </li>
  )
}

function DayDetailsModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [details, setDetails] = useState<GeneralDayDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getGeneralDay(date)
      .then((result) => {
        if (active) setDetails(result)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '')
      })
    return () => {
      active = false
    }
  }, [date, attempt])

  const month = parseDay(date).getUTCMonth() + 1
  const year = parseDay(date).getUTCFullYear()
  const label = `Cobertura do dia ${dayNumber(date)} de ${monthName(month)} de ${year}`

  const header = (
    <div className="flex items-center gap-4 bg-card-header px-5 py-4">
      <div className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
        <span className="text-lg font-bold leading-none">{dayNumber(date)}</span>
        <span className="mt-0.5 text-[9px] font-bold">{weekdayLabel(date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="rounded-md bg-badge-blue px-2.5 py-1 text-[10px] font-bold text-badge-blue-text">Cobertura diária</span>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {monthName(month)} {year}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar detalhes do dia"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text hover:bg-neutral"
      >
        <X className="size-4" />
      </button>
    </div>
  )

  return (
    <Modal id="day-details" label={label} onClose={onClose} header={header}>
      {error !== null ? (
        <div role="alert" className="p-6 text-sm text-text">
          <p>Não foi possível carregar os detalhes do dia. {error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setAttempt((value) => value + 1)
            }}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            Tentar novamente
          </button>
        </div>
      ) : !details ? (
        <p role="status" className="p-6 text-sm text-text-muted">Carregando detalhes…</p>
      ) : !details.publicada || (!details.chefe && details.enfermeiros.length + details.tecnicos.length === 0) ? (
        <p className="p-6 text-sm text-text-muted">Não há escala publicada para este dia.</p>
      ) : (
        <>
          {details.chefe ? (
            <section className="flex items-center gap-3 bg-card-header px-5 py-4" aria-label="Enfermeiro chefe">
              <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary">
                {initials(details.chefe.nome)}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Enfermeiro chefe · Liderança geral</p>
                <p className="text-base font-bold text-text">{details.chefe.nome}</p>
                <p className="text-[11px] text-text-muted">
                  {details.chefe.regime}
                  {details.chefe.setores.length ? ` · Responsável pelos setores ${details.chefe.setores.join(', ')}` : ''}
                </p>
              </div>
            </section>
          ) : null}
          <section aria-labelledby="day-nurses">
            <h2 id="day-nurses" className="px-5 pt-4 text-[10px] font-bold uppercase tracking-wide text-primary">
              Enfermeiros · {details.contagens.enfermeiros}
            </h2>
            {details.enfermeiros.length ? (
              <ul className="divide-y divide-border">{details.enfermeiros.map((person) => <StaffRow key={`${person.nome}-${person.regime}`} person={person} />)}</ul>
            ) : (
              <p className="px-5 py-3 text-[12px] text-text-muted">Nenhum enfermeiro escalado.</p>
            )}
          </section>
          <section aria-labelledby="day-technicians" className="border-t border-border">
            <h2 id="day-technicians" className="px-5 pt-4 text-[10px] font-bold uppercase tracking-wide text-primary">
              Técnicos · {details.contagens.tecnicos}
            </h2>
            {details.tecnicos.length ? (
              <ul className="divide-y divide-border">{details.tecnicos.map((person) => <StaffRow key={`${person.nome}-${person.regime}`} person={person} />)}</ul>
            ) : (
              <p className="px-5 py-3 text-[12px] text-text-muted">Nenhum técnico escalado.</p>
            )}
          </section>
        </>
      )}
    </Modal>
  )
}

export function GeneralSchedulePage() {
  const [initialWeek] = useState(() => startOfWeek(today()))
  const [weekStart, setWeekStart] = useState(initialWeek)
  const [months, setMonths] = useState<Record<string, GeneralMonth>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const requestId = useRef(0)

  /** Busca os meses da semana; só atualiza o estado nos retornos assíncronos (seguro para efeitos). */
  const fetchWeek = useCallback((start: Date) => {
    const current = ++requestId.current
    Promise.all(monthsOfWeek(start).map(({ ano, mes }) => getGeneralMonth(ano, mes)))
      .then((results) => {
        if (current !== requestId.current) return
        setMonths(Object.fromEntries(results.map((result) => [`${result.ano}-${result.mes}`, result])))
      })
      .catch((reason: unknown) => {
        if (current === requestId.current) setError(reason instanceof Error ? reason.message : '')
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchWeek(initialWeek)
    return () => {
      requestId.current += 1
    }
  }, [fetchWeek, initialWeek])

  const goToWeek = (start: Date) => {
    setLoading(true)
    setError(null)
    setWeekStart(start)
    fetchWeek(start)
  }

  const shiftMonth = (delta: number) => {
    const { year, month } = monthOfWeek(weekStart)
    const index = year * 12 + (month - 1) + delta
    goToWeek(firstWeekOfMonth(Math.floor(index / 12), (index % 12) + 1))
  }

  const { year, month } = monthOfWeek(weekStart)
  const days = Array.from({ length: 7 }, (_, offset) => dayKey(addDays(weekStart, offset)))
  const dayMap = new Map<string, GeneralDay>()
  for (const entry of Object.values(months)) for (const day of entry.dias) dayMap.set(day.data, day)
  const anyPublished = Object.values(months).some((entry) => entry.publicada)

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Equipe</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">Escala geral</h1>
        <p className="mt-2 text-sm text-text-muted">Veja quem estará de plantão. Dados pessoais não são exibidos.</p>
      </header>

      <div className="mt-6 flex items-center justify-center gap-8 rounded-2xl border border-border bg-surface px-5 py-5 shadow-(--shadow-soft)">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mês anterior"
          className="flex size-8 items-center justify-center rounded-lg text-primary hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronRight className="size-4 rotate-180" />
        </button>
        <p aria-live="polite" className="min-w-40 text-center text-sm font-bold text-text">
          {capitalized(monthName(month))} de {year}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Próximo mês"
          className="flex size-8 items-center justify-center rounded-lg text-primary hover:bg-neutral focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between px-1 text-[13px]">
        <button type="button" onClick={() => goToWeek(addDays(weekStart, -7))} className="font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          ‹ Semana anterior
        </button>
        <p aria-live="polite" className="font-semibold text-text">{weekRangeLabel(weekStart)}</p>
        <button type="button" onClick={() => goToWeek(addDays(weekStart, 7))} className="font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
          Próxima semana ›
        </button>
      </div>

      <div className="mt-5" aria-busy={loading}>
        {loading ? <p role="status" className="py-6 text-center text-sm text-text-muted">Carregando escala…</p> : null}

        {error !== null ? (
          <div role="alert" className="rounded-2xl border border-border bg-error p-5 text-sm text-text">
            <p>Não foi possível carregar a escala geral. {error}</p>
            <button type="button" onClick={() => goToWeek(weekStart)} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!loading && error === null && !anyPublished ? (
          <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-text-muted">A escala deste período ainda não foi publicada.</p>
        ) : null}

        {!loading && error === null && anyPublished ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {days.map((key) => {
              const day = dayMap.get(key)
              const header = (
                <div className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
                  <span className="text-lg font-bold leading-none">{dayNumber(key).padStart(2, '0')}</span>
                  <span className="mt-0.5 text-[9px] font-bold">{weekdayLabel(key)}</span>
                </div>
              )
              return (
                <li key={key} className="sm:last:col-span-2">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 text-left shadow-(--shadow-soft) transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {header}
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{`${dayNumber(key)}, ${weekdayLabel(key)}. `}</span>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-primary">
                          {day.turnos.map((item) => `${SHIFT_LABEL[item.turno]} · ${timeRange(item.horarioInicio, item.horarioFim)}`).join('  /  ')}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-bold text-text">{day.chefe?.nome ?? 'Sem enfermeiro chefe definido'}</span>
                        <span className="block truncate text-[11px] text-text-muted">{day.setores.join(' · ')}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-text" aria-hidden="true" />
                      <span className="sr-only">Abrir detalhes do dia</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-4">
                      {header}
                      <p className="text-[12px] text-text-muted">
                        <span className="sr-only">{`${dayNumber(key)}, ${weekdayLabel(key)}. `}</span>
                        Sem escala publicada neste dia
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {selectedDay ? <DayDetailsModal date={selectedDay} onClose={() => setSelectedDay(null)} /> : null}
    </div>
  )
}
