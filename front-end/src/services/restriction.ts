import { api } from './api'
import { listProfessionals } from './professionals'
import type { Professional } from '../pages/Professionals/types'
import type {
  AvailabilityCategory,
  AvailabilityRecord,
} from '../pages/Disponibility/components/AvailabilityFormModal'

export type ProfessionalStatus = 'ativo' | 'desativado' | 'afastado' | 'ferias'

type RestrictionType = 'indisponivel' | 'disponivel' | 'ferias' | 'ausencia' | 'vinculo_externo'

type RestrictionApi = {
  _id: string
  tipo: RestrictionType
  inicio: string
  fim: string
  diaSemana?: number | null
  observacao?: string
}

type ProfessionalWithId = Professional & { id: string }
export type ProfessionalOption = { id: string; name: string }

export type ListedRecord = AvailabilityRecord & {
  professionalId: string
  professionalStatus: ProfessionalStatus
}

type RestrictionList = Record<AvailabilityCategory, ListedRecord[]>

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const
const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map((weekday, index) => [weekday, index]),
)

const datePart = (dateIso: string) => dateIso.slice(0, 10)
const beginOfDay = (date: string) => new Date(`${date}T00:00:00.000Z`).toISOString()
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999Z`).toISOString()

// Os valores-padrão são usados somente para representar regras recorrentes
// enquanto não existe uma vigência específica no formulário.
const currentYear = new Date().getFullYear()
const recurringStart = `${currentYear}-01-01`
const recurringEnd = `${currentYear + 5}-12-31`

function hasId(professional: Professional): professional is ProfessionalWithId {
  return typeof professional.id === 'string' && professional.id.trim().length > 0
}

function getStatus(professional: Professional): ProfessionalStatus {
  return professional.apiStatus ?? (professional.status ? 'ativo' : 'desativado')
}

function getCategory(type: RestrictionType): AvailabilityCategory {
  if (type === 'vinculo_externo') return 'externalLinks'
  if (type === 'ferias' || type === 'ausencia') return 'absences'
  return 'restrictions'
}

function getLabel(type: RestrictionType): string {
  const labels: Record<RestrictionType, string> = {
    indisponivel: 'Indisponível',
    disponivel: 'Disponível',
    ferias: 'Férias',
    ausencia: 'Ausência',
    vinculo_externo: 'Vínculo externo',
  }
  return labels[type]
}

export async function fetchAllRestrictions(): Promise<{
  records: RestrictionList
  professionals: ProfessionalOption[]
}> {
  const allProfessionals = (await listProfessionals()).filter(hasId)
  const professionals: ProfessionalOption[] = allProfessionals
    .filter((professional) => getStatus(professional) === 'ativo')
    .map((professional) => ({ id: professional.id, name: professional.name }))

  const records: RestrictionList = {
    restrictions: [],
    externalLinks: [],
    absences: [],
  }

  await Promise.all(
    allProfessionals.map(async (professional) => {
      const restrictions = await api<RestrictionApi[]>(
        `/profissionais/${professional.id}/restricoes`,
      )

      for (const restriction of restrictions) {
        const category = getCategory(restriction.tipo)
        const label = getLabel(restriction.tipo)

        records[category].push({
          id: restriction._id,
          professionalId: professional.id,
          professionalStatus: getStatus(professional),
          category,
          name: professional.name,
          role: professional.formation,
          rule: restriction.observacao
            ? `${label} · ${restriction.observacao}`
            : label,
          period: `${datePart(restriction.inicio)} a ${datePart(restriction.fim)}${
            restriction.diaSemana == null
              ? ''
              : ` · ${WEEKDAYS[restriction.diaSemana] ?? 'dia inválido'}`
          }`,
          details: {
            note: restriction.observacao,
            startDate: datePart(restriction.inicio),
            endDate: datePart(restriction.fim),
          },
        })
      }
    }),
  )

  for (const category of Object.keys(records) as AvailabilityCategory[]) {
    records[category].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }

  return { records, professionals }
}

export async function createRestriction(
  record: AvailabilityRecord,
  professionals: ProfessionalOption[],
): Promise<void> {
  const professional = professionals.find((item) => item.name === record.name)
  if (!professional) {
    throw new Error('Escolha um profissional ativo cadastrado na lista.')
  }

  const details = record.details ?? {}
  const type: RestrictionType =
    record.category === 'externalLinks'
      ? 'vinculo_externo'
      : record.category === 'absences'
        ? /férias|ferias/i.test(details.absenceType ?? '')
          ? 'ferias'
          : 'ausencia'
        : details.ruleType === 'allowedShift'
          ? 'disponivel'
          : 'indisponivel'

  if (record.category === 'restrictions' && details.ruleType === 'allowedShift') {
    throw new Error('O backend ainda não representa disponibilidade por turno.')
  }
  if (
    record.category === 'externalLinks' &&
    details.linkShift &&
    details.linkShift !== 'flexible'
  ) {
    throw new Error('O backend ainda não representa horários de vínculos externos. Selecione horário flexível.')
  }

  const start = record.category === 'restrictions' ? details.validFrom : details.startDate
  const end = record.category === 'restrictions' ? details.validTo : details.endDate
  const inicio = beginOfDay(start || recurringStart)
  const fim = endOfDay(end || recurringEnd)
  const recurrence =
    record.category === 'restrictions' || record.category === 'externalLinks'
      ? details.days
      : undefined

  const weekdays: Array<string | undefined> = recurrence?.length ? recurrence : [undefined]
  const observations =
    record.category === 'externalLinks'
      ? `${details.linkType ?? ''} · ${details.institution ?? ''} ${details.note ?? ''}`
      : record.category === 'absences'
        ? `${details.absenceType ?? ''} ${details.note ?? ''}`
        : details.note ?? ''

  for (const weekday of weekdays) {
    if (weekday !== undefined && WEEKDAY_INDEX[weekday] === undefined) {
      throw new Error('Dia da semana inválido.')
    }
    await api<RestrictionApi>(`/profissionais/${professional.id}/restricoes`, {
      method: 'POST',
      body: JSON.stringify({
        tipo: type,
        inicio,
        fim,
        ...(weekday === undefined ? {} : { diaSemana: WEEKDAY_INDEX[weekday] }),
        observacao: observations.trim().slice(0, 300),
      }),
    })
  }
}

export async function deleteRestriction(professionalId: string, restrictionId: string): Promise<void> {
  await api(`/profissionais/${professionalId}/restricoes/${restrictionId}`, {
    method: 'DELETE',
  })
}