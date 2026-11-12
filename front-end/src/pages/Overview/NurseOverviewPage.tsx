import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Building2, CalendarDays, CalendarPlus, ChevronRight, Clock, Users } from '../../components/icons'
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

function ShiftDetailPage({
  shift,
  onBack,
  onRequestExchange,
}: {
  shift: MyShift
  onBack: () => void
  onRequestExchange: () => void
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
      <button type="button" onClick={onBack} className="w-fit text-sm font-bold text-primary hover:underline">
        <span aria-hidden="true">‹</span> Voltar para meus plantões
      </button>

      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-white p-7 shadow-(--shadow-soft) sm:flex-row sm:items-center sm:px-10 sm:py-8">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <span className="flex size-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#dcefe0] text-center text-primary">
            <span className="text-xs font-bold uppercase">{shiftDate(shift, { month: 'short' }).replace('.', '')}</span>
            <span className="text-4xl font-semibold leading-none">{shiftDate(shift, { day: '2-digit' })}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase">{shiftDate(shift, { weekday: 'short' }).replace('.', '')}</span>
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Escala {shift.tipo}
            </span>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">
              {shift.horarioInicio}—{shift.horarioFim}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {shiftDate(shift, { day: 'numeric', month: 'long' })} · Jornada de {shift.duracaoHoras} horas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequestExchange}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#169b4e] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#128343] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeftRight size={16} />
          Solicitar troca
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="shift-information-title" className="min-h-64 rounded-2xl border border-border bg-white p-6 shadow-(--shadow-soft) sm:p-7">
          <h2 id="shift-information-title" className="text-lg font-bold text-text">Informações do plantão</h2>
          <dl className="mt-3 divide-y divide-border">
            <div className="flex items-center gap-4 py-4">
              <Building2 size={18} className="shrink-0 text-primary" />
              <div><dt className="text-xs text-text-muted">Setor</dt><dd className="mt-0.5 text-sm font-semibold text-text">{shift.setor}</dd></div>
            </div>
            <div className="flex items-center gap-4 py-4">
              <Users size={18} className="shrink-0 text-primary" />
              <div><dt className="text-xs text-text-muted">Função</dt><dd className="mt-0.5 text-sm font-semibold text-text">{shift.funcao === 'enfermeiro' ? 'Enfermagem' : 'Assistência'}</dd></div>
            </div>
            <div className="flex items-center gap-4 py-4">
              <Clock size={18} className="shrink-0 text-primary" />
              <div><dt className="text-xs text-text-muted">Horário</dt><dd className="mt-0.5 text-sm font-semibold text-text">{shift.horarioInicio}—{shift.horarioFim}</dd></div>
            </div>
          </dl>
        </section>

        <section aria-labelledby="shift-observations-title" className="min-h-64 rounded-2xl border border-border bg-white p-6 shadow-(--shadow-soft) sm:p-7">
          <h2 id="shift-observations-title" className="text-lg font-bold text-text">Observações</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Apresentar-se à liderança do setor 10 minutos antes do início. Conferir passagem de plantão e materiais da unidade.
          </p>
          <p className="mt-5 rounded-lg bg-[#f1f3f0] px-4 py-3 text-xs text-text-muted">
            Origem: Escala {shift.tipo}
          </p>
        </section>
      </div>
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
  const [selectedShift, setSelectedShift] = useState<MyShift | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

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
  const hasShiftCardContent = shiftLoading || Boolean(shiftError) || Boolean(nextShift)
  const visibleShifts = showAllShifts ? upcomingShifts : upcomingShifts.slice(0, 3)
  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  if (selectedShift) {
    return (
      <ShiftDetailPage
        shift={selectedShift}
        onBack={() => setSelectedShift(null)}
        onRequestExchange={() => onNavigate('trocas')}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">{todayLabel}</p>
        <h2 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-text">Olá, {userName}.</h2>
        <p className="mt-2 text-base text-text-muted">
          {nextShift
            ? `Seu próximo plantão começa ${nextShiftMessage(nextShift, now)}.`
            : 'Acompanhe aqui seus próximos plantões.'}
        </p>
      </header>

      <section
        aria-label="Próximo plantão"
        className={`flex min-h-36 flex-col gap-6 rounded-2xl p-7 shadow-[0_12px_30px_rgba(4,119,51,0.12)] sm:flex-row sm:items-center sm:px-10 sm:py-8 ${hasShiftCardContent ? 'bg-[#07833b] text-white' : 'bg-[#f1f3f0] text-text'}`}
      >
        {shiftLoading ? (
          <p role="status" className="text-sm text-white/85">Carregando seu próximo plantão...</p>
        ) : shiftError ? (
          <p role="alert" className="text-sm text-white">Não foi possível carregar seus plantões: {shiftError}</p>
        ) : nextShift ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <span className="flex size-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 text-center">
                <span className="text-xs font-bold uppercase">{shiftDate(nextShift, { month: 'short' }).replace('.', '')}</span>
                <span className="text-4xl font-semibold leading-none">{shiftDate(nextShift, { day: '2-digit' })}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase">{shiftDate(nextShift, { weekday: 'short' }).replace('.', '')}</span>
              </span>
              <div className="min-w-0">
                <span className="inline-flex rounded bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide">
                  Próximo plantão · {countdown(shiftStart(nextShift), now)}
                </span>
                <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {nextShift.horarioInicio} <span className="text-white/50">—</span> {nextShift.horarioFim}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
                  <span className="inline-flex items-center gap-1.5"><Building2 size={16} />{nextShift.setor}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={16} />{nextShift.funcao === 'enfermeiro' ? 'Enfermagem' : 'Assistência'}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-row gap-3 sm:flex-col">
              <button
                type="button"
                onClick={() => setSelectedShift(nextShift)}
                className="min-h-12 rounded-lg bg-[#169b4e] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#128343] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Ver detalhes
              </button>
              <button
                type="button"
                onClick={() => onNavigate('trocas')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
              >
                <ArrowLeftRight size={16} />
                Solicitar troca
              </button>
            </div>
          </>
        ) : (
          <div className="py-2">
            <p className="text-lg font-semibold">Nenhum plantão futuro encontrado</p>
            <p className="mt-2 text-sm text-text-muted">Quando uma escala oficial for publicada para você, ela aparecerá aqui.</p>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section id="proximos-plantoes" aria-labelledby="upcoming-title" className="min-h-64 overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
          <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
            <div>
              <h3 id="upcoming-title" className="text-lg font-bold text-text">Meus próximos plantões</h3>
              <p className="mt-1 text-xs text-text-muted">
                {upcomingShifts[0] ? `Escala de ${shiftDate(upcomingShifts[0], { month: 'long' })}` : 'Plantões da sua escala oficial'}
              </p>
            </div>
            {upcomingShifts.length > 3 ? (
              <button type="button" onClick={() => setShowAllShifts((value) => !value)} className="text-xs font-bold text-primary hover:underline">
                {showAllShifts ? 'Ver menos' : 'Ver todos'}
              </button>
            ) : null}
          </header>
          <div className="divide-y divide-border px-6">
            {shiftLoading ? <p role="status" className="py-5 text-sm text-text-muted">Carregando plantões...</p> : null}
            {!shiftLoading && shiftError ? <p role="alert" className="py-5 text-sm text-danger">{shiftError}</p> : null}
            {!shiftLoading && !shiftError && visibleShifts.length === 0 ? (
              <p className="py-5 text-sm text-text-muted">Você ainda não tem plantões futuros publicados.</p>
            ) : null}
            {!shiftLoading && !shiftError && visibleShifts.map((shift) => (
              <div key={shift.id} className="flex items-center gap-4 py-4">
                <ShiftDetails shift={shift} compact />
                <span className="hidden shrink-0 text-xs text-text-muted sm:block">
                  {shiftDate(shift, { weekday: 'short' })}
                </span>
                <ChevronRight className="size-5 shrink-0 text-text-muted" />
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="quick-access-title" className="min-h-64 rounded-2xl border border-border bg-white p-6 shadow-(--shadow-soft) sm:p-7">
          <h3 id="quick-access-title" className="border-b border-border pb-4 text-lg font-bold text-text">Acesso rápido</h3>
          <div className="divide-y divide-border">
            <button type="button" onClick={() => onNavigate('escala')} className="group flex w-full items-center gap-4 py-4 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><CalendarDays size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Escala geral</span>
                <span className="mt-1 block text-xs text-text-muted">Veja seus plantões publicados</span>
              </span>
              <ChevronRight className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
            <button type="button" onClick={() => onNavigate('trocas')} className="group flex w-full items-center gap-4 py-4 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><ArrowLeftRight size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Minhas trocas</span>
                <span className="mt-1 block text-xs text-text-muted">
                  {exchangeError ?? (incomingExchanges === null ? 'Carregando solicitações...' : `${incomingExchanges} solicitação(ões) recebida(s)`)}
                </span>
              </span>
              {incomingExchanges ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-badge-red text-[10px] font-bold text-badge-red-text">{incomingExchanges}</span> : null}
              <ChevronRight className="size-5 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="flex items-center gap-4 py-4 opacity-60" aria-label="Google Agenda indisponível">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><CalendarPlus size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">Google Agenda</span>
                <span className="mt-1 block text-xs text-text-muted">Integração ainda não disponível</span>
              </span>
              <ChevronRight className="size-5 text-text-muted" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
