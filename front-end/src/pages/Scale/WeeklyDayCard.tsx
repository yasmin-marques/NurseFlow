import { dayIndicators, dateKey } from './calendar'
import { CoverageBadge } from '../../components/ui/ScaleComponents'
import { coverageSurfaceClass } from '../../components/ui/coverageStyles'
import type { ScaleDetail } from '../../services/scales'
import { describeShift, describeShiftBadge, groupDailyTeam, type DailyTeamMember } from './weeklyTeam'

function formatList(items: string[]) {
  if (items.length < 2) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} e ${items[1]}`
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

function monthLabel(date: Date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function DailyTeamSection({
  title,
  members,
  role,
  emptyMessage,
  leadership = false,
}: {
  title: string
  members: DailyTeamMember[]
  role: string
  emptyMessage: string
  leadership?: boolean
}) {
  return <section className={`space-y-2 ${leadership ? 'rounded-lg bg-soft-green p-4' : ''}`}>
    <h5 className="text-[10px] font-bold tracking-wide text-primary">{title}</h5>
    {members.length ? <ul className="space-y-2">{members.map((member) => {
      const badges = [...new Map(member.shifts.map((shift) => {
        const badge = describeShiftBadge(member.professional, shift)
        return [badge.label, badge] as const
      })).values()]
      const detail = leadership
        ? 'Enfermeiro chefe'
        : `${role} · ${formatList(member.sectors)}`
      const leadershipDetails = [...new Set(member.shifts.map(describeShift))]

      const initials = member.professional.nome
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()

      return <li
        key={member.professional.id}
        className="flex flex-col gap-2 border-b border-border/70 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight text-[10px] font-bold text-primary">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-text">{member.professional.nome}</span>
            <span className="block truncate text-[10px] text-text-muted">
              {leadership ? detail : role}
              {leadership ? ` · Plantão ${formatList(leadershipDetails)} · Responsável pelos setores ${formatList(member.sectors)}` : ''}
            </span>
          </span>
        </div>
        {!leadership ? <span className="pl-11 text-[10px] text-text-muted sm:min-w-32 sm:pl-0">
          {formatList(member.sectors)}
        </span> : null}
        <div className="flex flex-wrap gap-1.5 pl-11 sm:shrink-0 sm:pl-0">
          {badges.map((badge) => <span
            key={badge.label}
            className={`rounded-md px-2 py-1 text-[9px] font-bold ${
              badge.tone === 'info' ? 'bg-badge-blue text-badge-blue-text' : 'bg-[#fff3df] text-[#a65300]'
            }`}
          >
            {badge.label}
          </span>)}
        </div>
      </li>
    })}</ul> : <p className="text-[11px] text-text-muted">{emptyMessage}</p>}
  </section>
}

export function WeeklyDayCard({
  date,
  dayScale,
  onEdit,
}: {
  date: Date
  dayScale: ScaleDetail | null
  onEdit?: () => void
}) {
  const key = dateKey(date)
  const dayShifts = dayScale?.plantoes.filter((shift) => shift.data === key) ?? []
  const indicator = dayIndicators(dayScale, key)
  const belowMinimumSectors = new Set(
    dayScale?.pendencias.filter((item) => item.data === key).map((item) => item.setorId) ?? [],
  ).size
  const coverage = indicator.state === 'conflict' || indicator.state === 'partial'
  const team = groupDailyTeam(dayShifts)
  const technicianCounts = team.technicianCoverage.map((item) => item.count)
  const minTechnicians = Math.min(...technicianCounts)
  const maxTechnicians = Math.max(...technicianCounts)
  const technicianCountLabel = minTechnicians === maxTechnicians
    ? `${minTechnicians}`
    : `${minTechnicians}–${maxTechnicians}`
  const weekdayShort = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const weekdayLong = date.toLocaleDateString('pt-BR', { weekday: 'long' })
  const attentionReason = belowMinimumSectors
    ? `${belowMinimumSectors} setor(es) abaixo do mínimo`
    : `${indicator.conflictCount} conflito(s) para revisar`

  return <article
    aria-label={`${weekdayLong}, ${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`}
    className={`overflow-hidden rounded-xl border bg-white ${
      coverage ? 'border-danger/50' : coverageSurfaceClass(indicator.state)
    }`}
  >
    <header className="flex flex-col gap-3 bg-[#f7f8f6] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-highlight text-primary">
          <span className="text-base font-bold leading-none">{date.toLocaleDateString('pt-BR', { day: 'numeric' })}</span>
          <span className="mt-1 text-[9px] font-bold uppercase leading-none">{weekdayShort}</span>
        </span>
        <div className="min-w-0">
          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold ${
            dayShifts.length ? 'bg-badge-blue text-badge-blue-text' : 'bg-neutral text-text-muted'
          }`}>
            {dayShifts.length ? 'Cobertura diária' : 'Sem plantões'}
          </span>
          <p className="mt-1 truncate text-[10px] font-semibold uppercase text-text-muted">{monthLabel(date)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        {coverage ? <CoverageBadge state="conflict">
          Revisar cobertura
        </CoverageBadge> : null}
        {dayScale && onEdit ? <button
          type="button"
          className="px-2 py-1 text-xs font-semibold text-primary hover:underline"
          onClick={onEdit}
        >
          Editar
        </button> : null}
      </div>
    </header>
    {coverage ? <div role="alert" className="flex items-start gap-3 border-t border-danger/15 bg-error px-4 py-3 text-danger">
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full border border-danger text-xs font-bold">!</span>
      <div>
        <p className="text-[11px] font-bold">Irregularidade na cobertura</p>
        <p className="mt-0.5 text-[10px]">{attentionReason}</p>
      </div>
    </div> : null}
    <div className="space-y-4 p-4">
      {dayShifts.length === 0 ? <p className="text-xs text-text-muted">Sem plantões registrados.</p> : <>
        <DailyTeamSection
          title="ENFERMEIRO CHEFE · LIDERANÇA GERAL"
          members={team.leaders}
          role="Enfermeiro chefe"
          emptyMessage="Nenhum enfermeiro chefe escalado para este dia."
          leadership
        />
        <DailyTeamSection
          title={`ENFERMEIROS · ${team.nurses.length} EM CAMPO`}
          members={team.nurses}
          role="Enfermeiro"
          emptyMessage="Nenhum enfermeiro em campo neste dia."
        />
        <DailyTeamSection
          title={`TÉCNICOS · ${technicianCountLabel} POR SETOR EM CADA TURNO`}
          members={team.technicians}
          role="Técnico"
          emptyMessage="Nenhum técnico escalado neste dia."
        />
      </>}
    </div>
  </article>
}
