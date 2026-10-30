import type { ScheduleProfessional, ScheduledShift } from '../../services/scales'

export interface DailyTeamMember {
  professional: ScheduleProfessional
  shifts: ScheduledShift[]
  sectors: string[]
}

function membersFor(
  shifts: readonly ScheduledShift[],
  predicate: (professional: ScheduleProfessional) => boolean,
): DailyTeamMember[] {
  const members = new Map<string, { professional: ScheduleProfessional; shifts: ScheduledShift[] }>()

  for (const shift of shifts) {
    for (const professional of shift.profissionais) {
      if (!predicate(professional)) continue
      const member = members.get(professional.id) ?? { professional, shifts: [] }
      if (!member.shifts.some((item) => item.id === shift.id)) member.shifts.push(shift)
      members.set(professional.id, member)
    }
  }

  return [...members.values()]
    .map(({ professional, shifts: assignments }) => ({
      professional,
      shifts: assignments,
      sectors: [...new Set(assignments.map((shift) => shift.setor.nome))],
    }))
    .sort((left, right) => left.professional.nome.localeCompare(right.professional.nome, 'pt-BR'))
}

export function groupDailyTeam(shifts: readonly ScheduledShift[]) {
  const leaders = membersFor(shifts, (professional) => professional.lideranca)
  const nurses = membersFor(
    shifts,
    (professional) => !professional.lideranca && professional.formacao === 'enfermeiro',
  )
  const technicians = membersFor(shifts, (professional) => professional.formacao === 'tecnico')
  const responsibleSectors = [...new Set(leaders.flatMap((member) => member.sectors))]
  const technicianCoverage = new Map<string, { setor: string; inicio: string; fim: string; ids: Set<string> }>()

  for (const shift of shifts) {
    const key = `${shift.setor.id}:${shift.horarioInicio}:${shift.horarioFim}`
    if (!technicianCoverage.has(key)) {
      technicianCoverage.set(key, {
        setor: shift.setor.nome,
        inicio: shift.horarioInicio,
        fim: shift.horarioFim,
        ids: new Set(),
      })
    }
    const coverage = technicianCoverage.get(key)!
    for (const professional of shift.profissionais) {
      if (professional.formacao === 'tecnico') coverage.ids.add(professional.id)
    }
  }

  return {
    leaders,
    nurses,
    technicians,
    responsibleSectors,
    technicianCoverage: [...technicianCoverage.values()].map(({ setor, inicio, fim, ids }) => ({
      setor,
      inicio,
      fim,
      count: ids.size,
    })),
  }
}

function hours(time: string) {
  return `${time.slice(0, 2)}h`
}

export function describeShift(shift: ScheduledShift) {
  const range = `${hours(shift.horarioInicio)}—${hours(shift.horarioFim)}`
  if (shift.duracaoHoras === 24) return `24 horas · ${range}`
  return `${shift.horarioInicio === '07:00' ? 'Diurno' : 'Noturno'} · ${range}`
}

export function describeShiftBadge(
  professional: ScheduleProfessional,
  shift: ScheduledShift,
) {
  const range = `${hours(shift.horarioInicio)}—${hours(shift.horarioFim)}`
  if (professional.origemCobertura === 'restricao') {
    return { label: `Baixa · ${range} · restrição`, tone: 'covered' as const }
  }
  if (professional.origemCobertura === 'complementar') {
    return { label: `Retorna · ${range} · cobertura`, tone: 'info' as const }
  }
  return { label: describeShift(shift), tone: 'covered' as const }
}
