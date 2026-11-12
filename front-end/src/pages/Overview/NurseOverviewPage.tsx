import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Building2, CalendarDays, CalendarPlus, ChevronRight, Clock } from '../../components/icons'
import type { NavItemId } from '../../components/layout/navItems'
import { getIncomingExchangeCount, getMyShifts, type MyShift } from '../../services/my-shifts'

type OverviewPageProps = {
  userName: string
  onNavigate: (id: NavItemId) => void
}

function shiftStart(shift: MyShift) {
  const [year, month, day] = shift.data.slice(0, 10).split('-').map(Number)
  const [hour, minute] = shift.horarioInicio.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

function shiftDate(shift: MyShift, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = shift.data.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(year, month - 1, day, 12))
}

function countdown(date: Date, now: Date) {
  const hours = Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 3_600_000))
  if (hours < 24) return `em ${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `em ${days}d ${remainingHours}h` : `em ${days} dias`
}

function nextShiftMessage(shift: MyShift, now: Date) {
  const start = shiftStart(shift)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const shiftDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const daysUntil = Math.round((shiftDay.getTime() - today.getTime()) / 86_400_000)
  const dayLabel = daysUntil === 0 ? 'hoje' : daysUntil === 1 ? 'amanhã' : `em ${daysUntil} dias`
  return `${dayLabel} às ${shift.horarioInicio}h`
}

function ShiftDetails({ shift, compact = false }: { shift: MyShift; compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${compact ? '' : 'text-white'}`}>
      <span className={`flex shrink-0 flex-col items-center justify-center rounded-xl text-center font-semibold ${compact ? 'size-11 bg-neutral text-text' : 'size-14 bg-white/10'}`}>
        <span className="text-base leading-none">{shiftDate(shift, { day: '2-digit' })}</span>
        <span className="mt-1 text-[9px] uppercase leading-none">{shiftDate(shift, { month: 'short' }).replace('.', '')}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold ${compact ? 'text-text' : 'text-white'}`}>
          {shift.horarioInicio}—{shift.horarioFim}
        </span>
        <span className={`mt-1 block truncate text-[10px] ${compact ? 'text-text-muted' : 'text-white/75'}`}>
          {shift.setor} · {shift.funcao === 'enfermeiro' ? 'Enfermagem' : 'Assistência'}
        </span>
      </span>
    </div>
  )
}

export function NurseOverviewPage({ userName, onNavigate }: OverviewPageProps) {
  const [shifts, setShifts] = useState<MyShift[]>([])
  const [shiftLoading, setShiftLoading] = useState(true)
  const [shiftError, setShiftError] = useState<string | null>(null)
  const [incomingExchanges, setIncomingExchanges] = useState<number | null>(null)
  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const [showAllShifts, setShowAllShifts] = useState(false)
  const [now] = useState(() => new Date())

  useEffect(() => {
    let active = true
    getMyShifts()
      .then(({ plantoes }) => {
        if (active) setShifts(plantoes)
      })
      .catch((error: unknown) => {
        if (active) setShiftError(error instanceof Error ? error.message : 'Não foi possível carregar seus plantões.')
      })
      .finally(() => {
        if (active) setShiftLoading(false)
      })
    getIncomingExchangeCount()
      .then(({ recebidas }) => {
        if (active) setIncomingExchanges(recebidas)
      })
      .catch((error: unknown) => {
        if (active) setExchangeError(error instanceof Error ? error.message : 'Não foi possível carregar as solicitações de troca.')
      })
    return () => {
      active = false
    }
  }, [])

  const upcomingShifts = useMemo(
    () => shifts.filter((shift) => shiftStart(shift) >= now).sort((a, b) => shiftStart(a).getTime() - shiftStart(b).getTime()),
    [now, shifts],
  )
  const nextShift = upcomingShifts[0]
  const visibleShifts = showAllShifts ? upcomingShifts : upcomingShifts.slice(0, 3)
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:px-10">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">{todayLabel}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-text">Olá, {userName}.</h2>
        <p className="mt-1 text-xs text-text-muted">
          {nextShift
            ? `Seu próximo plantão começa ${nextShiftMessage(nextShift, now)}.`
            : 'Acompanhe aqui seus próximos plantões.'}
        </p>
      </header>

      <section aria-label="Próximo plantão" className="flex flex-col gap-5 rounded-2xl bg-[#07833b] p-5 text-white shadow-[0_12px_30px_rgba(4,119,51,0.2)] sm:flex-row sm:items-center sm:px-8 sm:py-6">
        {shiftLoading ? (
          <p role="status" className="text-sm text-white/85">Carregando seu próximo plantão...</p>
        ) : shiftError ? (
          <p role="alert" className="text-sm text-white">Não foi possível carregar seus plantões: {shiftError}</p>
        ) : nextShift ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <span className="flex size-19 shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 text-center">
                <span className="text-[9px] font-bold uppercase">{shiftDate(nextShift, { month: 'short' }).replace('.', '')}</span>
                <span className="text-3xl font-semibold leading-none">{shiftDate(nextShift, { day: '2-digit' })}</span>
                <span className="mt-1 text-[8px] font-semibold uppercase">{shiftDate(nextShift, { weekday: 'short' }).replace('.', '')}</span>
              </span>
              <div className="min-w-0">
                <span className="inline-flex rounded bg-white/15 px-2 py-1 text-[8px] font-bold uppercase tracking-wide">
                  Próximo plantão · {countdown(shiftStart(nextShift), now)}
                </span>
                <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                  {nextShift.horarioInicio} <span className="text-white/50">—</span> {nextShift.horarioFim}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/80">
                  <span className="inline-flex items-center gap-1"><Building2 size={12} />{nextShift.setor}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} />{nextShift.funcao === 'enfermeiro' ? 'Enfermagem' : 'Assistência'}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
              <button
                type="button"
                onClick={() => document.getElementById('proximos-plantoes')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="rounded-lg border border-white/40 px-4 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ver detalhes
              </button>
              <button
                type="button"
                onClick={() => onNavigate('trocas')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[10px] font-semibold text-primary transition-colors hover:bg-white/90"
              >
                <ArrowLeftRight size={12} />
                Solicitar troca
              </button>
            </div>
          </>
        ) : (
          <div className="py-2">
            <p className="text-base font-semibold">Nenhum plantão futuro encontrado</p>
            <p className="mt-1 text-xs text-white/80">Quando uma escala oficial for publicada para você, ela aparecerá aqui.</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section id="proximos-plantoes" aria-labelledby="upcoming-title" className="overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 id="upcoming-title" className="text-sm font-bold text-text">Meus próximos plantões</h3>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {upcomingShifts[0] ? `Escala de ${shiftDate(upcomingShifts[0], { month: 'long' })}` : 'Plantões da sua escala oficial'}
              </p>
            </div>
            {upcomingShifts.length > 3 ? (
              <button type="button" onClick={() => setShowAllShifts((value) => !value)} className="text-[10px] font-bold text-primary hover:underline">
                {showAllShifts ? 'Ver menos' : 'Ver todos'}
              </button>
            ) : null}
          </header>
          <div className="divide-y divide-border px-4">
            {shiftLoading ? <p role="status" className="py-5 text-xs text-text-muted">Carregando plantões...</p> : null}
            {!shiftLoading && shiftError ? <p role="alert" className="py-5 text-xs text-danger">{shiftError}</p> : null}
            {!shiftLoading && !shiftError && visibleShifts.length === 0 ? (
              <p className="py-5 text-xs text-text-muted">Você ainda não tem plantões futuros publicados.</p>
            ) : null}
            {!shiftLoading && !shiftError && visibleShifts.map((shift) => (
              <div key={shift.id} className="flex items-center gap-3 py-2.5">
                <ShiftDetails shift={shift} compact />
                <span className="hidden shrink-0 text-[9px] text-text-muted sm:block">
                  {shiftDate(shift, { weekday: 'short' })}
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-muted" />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="quick-access-title" className="rounded-2xl border border-border bg-white p-4 shadow-(--shadow-soft)">
          <h3 id="quick-access-title" className="border-b border-border pb-3 text-sm font-bold text-text">Acesso rápido</h3>
          <div className="divide-y divide-border">
            <button type="button" onClick={() => onNavigate('escala')} className="group flex w-full items-center gap-3 py-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><CalendarDays size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text">Escala geral</span>
                <span className="mt-0.5 block text-[9px] text-text-muted">Veja seus plantões publicados</span>
              </span>
              <ChevronRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
            <button type="button" onClick={() => onNavigate('trocas')} className="group flex w-full items-center gap-3 py-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><ArrowLeftRight size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text">Minhas trocas</span>
                <span className="mt-0.5 block text-[9px] text-text-muted">
                  {exchangeError ?? (incomingExchanges === null ? 'Carregando solicitações...' : `${incomingExchanges} solicitação(ões) recebida(s)`)}
                </span>
              </span>
              {incomingExchanges ? <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-badge-red text-[9px] font-bold text-badge-red-text">{incomingExchanges}</span> : null}
              <ChevronRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="flex items-center gap-3 py-3 opacity-60" aria-label="Google Agenda indisponível">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><CalendarPlus size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-text">Google Agenda</span>
                <span className="mt-0.5 block text-[9px] text-text-muted">Integração ainda não disponível</span>
              </span>
              <ChevronRight className="size-4 text-text-muted" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
