import type { Professional } from '../Professionals/types'
import type { ScheduledShift, ShiftBatchChange, ShiftOption } from '../../services/scales'

export type ProfessionalWithId = Professional & { id: string }

const isProfessionalWithId = (person: Professional): person is ProfessionalWithId =>
  typeof person.id === 'string'

export function assignedLeaderId(shift: ScheduledShift | null): string | undefined {
  return shift?.profissionais.find((person) => person.lideranca)?.id
}

export function formationFor(person: Professional): 'enfermeiro' | 'tecnico' {
  return person.formation === 'Técnico' ? 'tecnico' : 'enfermeiro'
}

export function professionalsAvailableToAdd(professionals: Professional[], selectedIds: string[]): ProfessionalWithId[] {
  return professionals.filter(
    (person): person is ProfessionalWithId =>
      person.status && isProfessionalWithId(person) && !selectedIds.includes(person.id),
  )
}

export function searchProfessionals(professionals: ProfessionalWithId[], query: string): ProfessionalWithId[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  if (!normalizedQuery) return professionals
  return professionals.filter((person) => person.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
}

export const SHIFT_CHOICES = [
  { value: '24h', label: '24 horas', hours: '07h—07h' },
  { value: '12d', label: 'Diurno', hours: '07h—19h' },
  { value: '12n', label: 'Noturno', hours: '19h—07h' },
] as const satisfies ReadonlyArray<{ value: ShiftOption; label: string; hours: string }>

export const shiftChoice = (option: ShiftOption) => SHIFT_CHOICES.find((choice) => choice.value === option)!

export function optionForShift(shift: ScheduledShift): ShiftOption {
  if (shift.duracaoHoras === 24) return '24h'
  return shift.horarioInicio === '07:00' ? '12d' : '12n'
}

export interface DayMember {
  id: string
  option: ShiftOption
  leader: boolean
}

/** Equipe do setor no dia: cada profissional com o plantão em que está. Alterações ainda não salvas têm prioridade. */
export function seedDayMembers(
  sectorShifts: readonly ScheduledShift[],
  staged: readonly ShiftBatchChange[],
  sectorId: string,
  date: string,
): DayMember[] {
  const members = new Map<string, DayMember>()
  const add = (id: string, option: ShiftOption, leader: boolean) => {
    if (!members.has(id)) members.set(id, { id, option, leader })
  }
  for (const shift of sectorShifts) {
    const option = optionForShift(shift)
    const change = staged.find((item) => item.plantaoId === shift.id)
    if (change) change.equipe.forEach((person) => add(person.profissionalId, option, person.lideranca === true))
    else shift.profissionais.forEach((person) => add(person.id, option, person.lideranca))
  }
  for (const change of staged) {
    if (change.plantaoId || change.setorId !== sectorId || change.data !== date) continue
    change.equipe.forEach((person) => add(person.profissionalId, change.opcao, person.lideranca === true))
  }
  return [...members.values()]
}

const sameTeam = (members: readonly DayMember[], shift: ScheduledShift) =>
  members.length === shift.profissionais.length &&
  members.every((member) => shift.profissionais.some((person) => person.id === member.id && person.lideranca === member.leader))

/** Plantões existentes do setor que ficariam sem nenhum profissional (a API não remove plantões). */
export function emptiedShifts(sectorShifts: readonly ScheduledShift[], members: readonly DayMember[]): ScheduledShift[] {
  return sectorShifts.filter((shift) => !members.some((member) => member.option === optionForShift(shift)))
}

/** Um ajuste por plantão alterado ou novo; plantões existentes sem mudança não geram alteração. */
export function buildShiftChanges(input: {
  sectorId: string
  date: string
  sectorShifts: readonly ScheduledShift[]
  members: readonly DayMember[]
  formationOf: (id: string) => 'enfermeiro' | 'tecnico'
}): ShiftBatchChange[] {
  const changes: ShiftBatchChange[] = []
  for (const choice of SHIFT_CHOICES) {
    const team = input.members.filter((member) => member.option === choice.value)
    if (team.length === 0) continue
    const existing = input.sectorShifts.find((shift) => optionForShift(shift) === choice.value)
    if (existing && sameTeam(team, existing)) continue
    changes.push({
      setorId: input.sectorId,
      data: input.date,
      opcao: choice.value,
      tipo: existing?.tipo ?? 'regular',
      equipe: team.map((member) => ({
        profissionalId: member.id,
        funcao: input.formationOf(member.id),
        ...(member.leader ? { lideranca: true } : {}),
      })),
      ...(existing ? { plantaoId: existing.id } : {}),
    })
  }
  return changes
}
