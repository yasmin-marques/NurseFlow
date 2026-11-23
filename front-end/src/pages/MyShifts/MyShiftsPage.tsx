import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarPlus } from '../../components/icons'
import { getMyShifts, type MyShift, type ShiftSituation } from '../../services/professionalSchedule'
import { dayNumber, timeRange, weekdayLabel } from '../professionalDates'

const TABS: { id: ShiftSituation; label: string }[] = [
  { id: 'proximos', label: 'Próximos' },
  { id: 'anteriores', label: 'Anteriores' },
]

const EMPTY_TEXT: Record<ShiftSituation, string> = {
  proximos: 'Você não tem plantões próximos na escala publicada.',
  anteriores: 'Você não tem plantões anteriores na escala publicada.',
}

function ShiftCard({ shift }: { shift: MyShift }) {
  const working = shift.status === 'trabalhando'
  const othersLabel = shift.funcao === 'tecnico' ? 'Outros técnicos' : 'Técnicos'
  const nursesLabel = shift.funcao === 'enfermeiro' ? 'Outros enfermeiros' : 'Enfermeiros'
  const names = (list: { nome: string }[]) => (list.length ? list.map((person) => person.nome).join(' · ') : '—')
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-surface shadow-(--shadow-soft)">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
        <div className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
          <span className="text-lg font-bold leading-none">{dayNumber(shift.data)}</span>
          <span className="mt-0.5 text-[9px] font-bold">{weekdayLabel(shift.data)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-warning px-2 py-0.5 text-[10px] font-bold text-warning-text">
              {shift.duracaoHoras} horas · {timeRange(shift.horarioInicio, shift.horarioFim)}
            </span>
            {shift.tipo === 'extra' ? (
              <span className="rounded-md bg-badge-blue px-2 py-0.5 text-[10px] font-bold text-badge-blue-text">Extra</span>
            ) : null}
          </div>
          <h2 className="mt-1.5 text-sm font-bold text-text">
            <span className="sr-only">{`${dayNumber(shift.data)}, ${weekdayLabel(shift.data)}: `}</span>
            {shift.setor.nome}
          </h2>
          {shift.chefe ? <p className="mt-0.5 text-[11px] text-text-muted">Enfermeiro chefe: {shift.chefe.nome}</p> : null}
        </div>
        <span
          className={`shrink-0 self-start rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:self-center ${
            working ? 'bg-secondary text-primary' : 'bg-badge-blue text-badge-blue-text'
          }`}
        >
          {working ? 'Trabalhando' : 'Trabalhado'}
        </span>
      </div>
      <dl className="grid gap-3 bg-neutral px-4 py-3 text-[11px] sm:grid-cols-2 sm:px-5 sm:pl-[86px]">
        <div>
          <dt className="font-bold uppercase tracking-wide text-text">{nursesLabel}</dt>
          <dd className="mt-1 text-text-muted">{names(shift.enfermeiros)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wide text-text">{othersLabel}</dt>
          <dd className="mt-1 text-text-muted">{names(shift.tecnicos)}</dd>
        </div>
      </dl>
    </li>
  )
}

export function MyShiftsPage() {
  const [tab, setTab] = useState<ShiftSituation>('proximos')
  const [items, setItems] = useState<MyShift[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const tabRefs = useRef<Record<ShiftSituation, HTMLButtonElement | null>>({ proximos: null, anteriores: null })

  /** Busca uma página; só atualiza o estado nos retornos assíncronos (seguro para efeitos). */
  const fetchPage = useCallback((situation: ShiftSituation, pageNumber: number) => {
    const current = ++requestId.current
    getMyShifts(situation, pageNumber)
      .then((result) => {
        if (current !== requestId.current) return
        setItems((previous) => (pageNumber === 1 ? result.itens : [...previous, ...result.itens]))
        setPage(result.pagina)
        setTotalPages(result.totalPaginas)
      })
      .catch((reason: unknown) => {
        if (current !== requestId.current) return
        setError(reason instanceof Error ? reason.message : '')
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false)
      })
  }, [])

  /** Inicia uma busca a partir de uma ação do usuário, sinalizando carregamento. */
  const load = useCallback((situation: ShiftSituation, pageNumber: number) => {
    setLoading(true)
    setError(null)
    fetchPage(situation, pageNumber)
  }, [fetchPage])

  useEffect(() => {
    fetchPage('proximos', 1)
    return () => {
      requestId.current += 1
    }
  }, [fetchPage])

  const selectTab = (next: ShiftSituation) => {
    if (next === tab) return
    setItems([])
    setPage(1)
    setTotalPages(1)
    setTab(next)
    load(next, 1)
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((item) => item.id === tab)
    const target = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length] : event.key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length] : null
    if (!target) return
    event.preventDefault()
    selectTab(target.id)
    tabRefs.current[target.id]?.focus()
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Minha escala</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text">Meus plantões</h1>
          <p className="mt-2 text-sm text-text-muted">Consulte seus próximos turnos em ordem cronológica.</p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Em breve"
          className="flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text opacity-60"
        >
          <CalendarPlus className="size-4" strokeWidth={1.8} />
          Google Agenda
          <span className="sr-only"> (em breve)</span>
        </button>
      </header>

      <div role="tablist" aria-label="Situação dos plantões" className="mt-6 flex gap-1 border-b border-border">
        {TABS.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element
              }}
              type="button"
              role="tab"
              id={`shifts-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="shifts-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={onTabKeyDown}
              className={`relative px-5 py-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                selected ? 'text-primary' : 'text-text-muted hover:text-text'
              }`}
            >
              {item.label}
              {selected ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" /> : null}
            </button>
          )
        })}
      </div>

      <div id="shifts-panel" role="tabpanel" aria-labelledby={`shifts-tab-${tab}`} aria-busy={loading} className="mt-6">
        {items.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {items.map((shift) => (
              <ShiftCard key={shift.plantaoId} shift={shift} />
            ))}
          </ul>
        ) : null}

        {loading ? <p role="status" className="py-8 text-center text-sm text-text-muted">Carregando plantões…</p> : null}

        {error !== null ? (
          <div role="alert" className="rounded-2xl border border-border bg-error p-5 text-sm text-text">
            <p>Não foi possível carregar seus plantões. {error}</p>
            <button
              type="button"
              onClick={() => load(tab, items.length > 0 ? page + 1 : 1)}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!loading && error === null && items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-text-muted">{EMPTY_TEXT[tab]}</p>
        ) : null}

        {!loading && error === null && page < totalPages ? (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => load(tab, page + 1)}
              className="rounded-xl border border-border bg-surface px-5 py-2.5 text-[13px] font-semibold text-primary hover:bg-neutral"
            >
              Carregar mais
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
