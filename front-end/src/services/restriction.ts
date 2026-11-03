import { api } from "./api";
import { listProfessionals } from "./professionals";
import type { Professional } from "../pages/Professionals/types";
import type {
  AvailabilityCategory,
  AvailabilityRecord,
} from "../pages/Disponibility/components/AvailabilityFormModal";

export type ProfessionalStatus = "ativo" | "desativado" | "afastado" | "ferias";

type RestrictionType =
  | "indisponivel"
  | "disponivel"
  | "ferias"
  | "ausencia"
  | "vinculo_externo";

type RestrictionApi = {
  _id: string;
  tipo: RestrictionType;
  inicio: string;
  fim: string;
  diaSemana?: number | null;
  diasSemana?: number[] | null;
  turno?: "diurno" | "noturno" | "flexivel" | null;
  motivo?: string | null;
  observacao?: string | null;
  instituicao?: string | null;
  tipoVinculo?: string | null;
};

type ProfessionalWithId = Professional & { id: string };
export type ProfessionalOption = { id: string; name: string };

export type ListedRecord = AvailabilityRecord & {
  professionalId: string;
  professionalStatus: ProfessionalStatus;
};

type RestrictionList = Record<AvailabilityCategory, ListedRecord[]>;

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;
const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map((weekday, index) => [weekday, index]),
);

const datePart = (dateIso: string) => dateIso.slice(0, 10);
const beginOfDay = (date: string) =>
  new Date(`${date}T00:00:00.000Z`).toISOString();
const endOfDay = (date: string) =>
  new Date(`${date}T23:59:59.999Z`).toISOString();

function normalizeApiShift(
  value?: string | null,
): "day" | "night" | "flexible" | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "diurno" || normalized === "day") return "day";
  if (normalized === "noturno" || normalized === "night") return "night";
  if (normalized === "flexivel" || normalized === "flexible") return "flexible";
  return undefined;
}

function normalizeAbsenceReason(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^ferias$/i.test(trimmed) || /^férias$/i.test(trimmed)) {
    return "ferias";
  }
  if (/^ausencia$/i.test(trimmed) || /^ausência$/i.test(trimmed)) {
    return "ausencia";
  }
  return trimmed;
}

function getAbsenceType(restriction: RestrictionApi): string | undefined {
  if (restriction.tipo === "ferias") return "ferias";
  const explicitReason = normalizeAbsenceReason(restriction.motivo);
  if (explicitReason !== undefined) return explicitReason;
  return undefined;
}

function addOptionalField(
  payload: Record<string, unknown>,
  key: string,
  value: unknown,
  clearEmpty = false,
) {
  if (value === undefined) return;
  if (value === null) {
    if (clearEmpty) payload[key] = null;
    return;
  }
  if (typeof value === "string" && value.trim() === "") {
    if (clearEmpty) payload[key] = null;
    return;
  }
  payload[key] = value;
}

function hasId(professional: Professional): professional is ProfessionalWithId {
  return (
    typeof professional.id === "string" && professional.id.trim().length > 0
  );
}

function getStatus(professional: Professional): ProfessionalStatus {
  return (
    professional.apiStatus ?? (professional.status ? "ativo" : "desativado")
  );
}

function getCategory(type: RestrictionType): AvailabilityCategory {
  if (type === "vinculo_externo") return "externalLinks";
  if (type === "ferias" || type === "ausencia") return "absences";
  return "restrictions";
}

function getLabel(type: RestrictionType): string {
  const labels: Record<RestrictionType, string> = {
    indisponivel: "Indisponível",
    disponivel: "Disponível",
    ferias: "Férias",
    ausencia: "Ausência",
    vinculo_externo: "Vínculo externo",
  };
  return labels[type];
}

function parseDays(restriction: RestrictionApi): number[] {
  if (Array.isArray(restriction.diasSemana)) return restriction.diasSemana;
  if (restriction.diaSemana === undefined || restriction.diaSemana === null)
    return [];
  return [restriction.diaSemana];
}

function formatWeekdays(days: number[]): string {
  return days
    .map((day) => WEEKDAYS[day] ?? "dia inválido")
    .filter(Boolean)
    .join(", ");
}

function formatShiftLabel(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "day" || normalized === "diurno") return "Diurno";
  if (normalized === "night" || normalized === "noturno") return "Noturno";
  if (normalized === "flexible" || normalized === "flexivel") return "Flexível";
  return undefined;
}

export async function fetchAllRestrictions(): Promise<{
  records: RestrictionList;
  professionals: ProfessionalOption[];
}> {
  const allProfessionals = (await listProfessionals()).filter(hasId);
  const professionals: ProfessionalOption[] = allProfessionals
    .filter((professional) => getStatus(professional) === "ativo")
    .map((professional) => ({ id: professional.id, name: professional.name }));

  const records: RestrictionList = {
    restrictions: [],
    externalLinks: [],
    absences: [],
  };

  await Promise.all(
    allProfessionals.map(async (professional) => {
      const restrictions = await api<RestrictionApi[]>(
        `/profissionais/${professional.id}/restricoes`,
      );

      for (const restriction of restrictions) {
        const category = getCategory(restriction.tipo);
        const label = getLabel(restriction.tipo);
        const diasSemana = parseDays(restriction);

        const rule =
          restriction.tipo === "vinculo_externo" && restriction.instituicao
            ? `${restriction.instituicao} · ${restriction.tipoVinculo ?? "vínculo externo"}`
            : restriction.observacao?.trim()
              ? `${label} · ${restriction.observacao.trim()}`
              : label;

        const normalizedShift = normalizeApiShift(restriction.turno);
        const shiftLabel = formatShiftLabel(normalizedShift);
        const absenceType = getAbsenceType(restriction);
        records[category].push({
          id: restriction._id,
          professionalId: professional.id,
          professionalStatus: getStatus(professional),
          category,
          name: professional.name,
          role: professional.formation,
          rule,
          period: `${datePart(restriction.inicio)} a ${datePart(restriction.fim)}${
            diasSemana.length ? ` · ${formatWeekdays(diasSemana)}` : ""
          }${shiftLabel ? ` · ${shiftLabel}` : ""}`,
          details: {
            note: restriction.observacao ?? undefined,
            startDate: datePart(restriction.inicio),
            endDate: datePart(restriction.fim),
            validFrom: datePart(restriction.inicio),
            validTo: datePart(restriction.fim),
            days: diasSemana.map((day) => WEEKDAYS[day]).filter(Boolean),
            institution: restriction.instituicao ?? undefined,
            linkType: restriction.tipoVinculo ?? undefined,
            linkShift: normalizedShift,
            absenceType,
            shift: normalizedShift,
            ruleType:
              restriction.tipo === "disponivel" ? "allowedShift" : undefined,
            noteEdited: false,
          },
        });
      }
    }),
  );

  for (const category of Object.keys(records) as AvailabilityCategory[]) {
    records[category].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }

  return { records, professionals };
}

function resolveProfessionalId(
  record: AvailabilityRecord,
  professionals: ProfessionalOption[],
): string {
  const explicitId = record.professionalId?.trim();
  if (explicitId) return explicitId;

  const trimmedName = record.name.trim();
  const matches = professionals.filter(
    (item) => item.name.trim() === trimmedName,
  );

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(
      "Há mais de um profissional com esse nome. Selecione o profissional correto.",
    );
  }

  throw new Error("Escolha um profissional ativo cadastrado na lista.");
}

function toApiShift(
  value?: string,
): "diurno" | "noturno" | "flexivel" | undefined {
  const normalized = value?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "day" || normalized === "diurno") return "diurno";
  if (normalized === "night" || normalized === "noturno") return "noturno";
  return "flexivel";
}

function buildRestrictionPayload(
  record: AvailabilityRecord,
  professionalId: string,
  clearEmptyFields = false,
): { professionalId: string; payload: Record<string, unknown> } {
  const details = record.details ?? {};
  if (
    record.category === "restrictions" &&
    details.ruleType === "allowedShift" &&
    !details.shift
  ) {
    throw new Error("Disponibilidade por turno exige o turno.");
  }

  const noteWasEdited = Boolean(details.noteEdited);
  if (clearEmptyFields && noteWasEdited && (details.note ?? "").length > 300) {
    throw new Error("A observação deve ter no máximo 300 caracteres.");
  }

  const type: RestrictionType =
    record.category === "externalLinks"
      ? "vinculo_externo"
      : record.category === "absences"
        ? /férias|ferias/i.test(details.absenceType ?? "")
          ? "ferias"
          : "ausencia"
        : details.ruleType === "allowedShift"
          ? "disponivel"
          : "indisponivel";

  if (record.category === "restrictions" && details.validity === "recurring") {
    throw new Error(
      "A API não aceita vigência recorrente aberta. Informe um período definido.",
    );
  }

  const start =
    record.category === "restrictions" ? details.validFrom : details.startDate;
  const end =
    record.category === "restrictions" ? details.validTo : details.endDate;

  if (
    (record.category === "restrictions" && (!start || !end)) ||
    (record.category === "absences" && (!start || !end)) ||
    (record.category === "externalLinks" && (!start || !end))
  ) {
    throw new Error(
      "Informe a data de início e a data de término para a vigência.",
    );
  }

  const inicio = beginOfDay(start as string);
  const fim = endOfDay(end as string);
  const recurrence =
    record.category === "restrictions" && details.ruleType !== "allowedShift"
      ? details.days
      : record.category === "externalLinks"
        ? details.days
        : undefined;

  const diasSemana = (recurrence ?? []).map((weekday) => {
    if (WEEKDAY_INDEX[weekday] === undefined) {
      throw new Error("Dia da semana inválido.");
    }
    return WEEKDAY_INDEX[weekday];
  });

  const motivo =
    record.category === "absences"
      ? normalizeAbsenceReason(details.absenceType)
      : record.category === "externalLinks"
        ? undefined
        : details.ruleType === "allowedShift"
          ? "disponibilidade"
          : undefined;
  const turnoRaw =
    record.category === "restrictions"
      ? details.shift
      : record.category === "externalLinks"
        ? details.linkShift
        : undefined;
  const turno = toApiShift(turnoRaw);
  const observacao = (details.note ?? "").trim();
  if (record.category === "externalLinks" && (!start || !end)) {
    throw new Error(
      "Vínculo externo exige vigência definida com data de início e data de fim.",
    );
  }

  const payload: Record<string, unknown> = {
    tipo: type,
    inicio,
    fim,
  };

  if (diasSemana.length) {
    payload.diasSemana = [...new Set(diasSemana)];
  } else if (
    clearEmptyFields &&
    (record.category === "restrictions" || record.category === "externalLinks")
  ) {
    payload.diasSemana = null;
  }

  addOptionalField(
    payload,
    "turno",
    clearEmptyFields && typeof turnoRaw === "string" && turnoRaw.trim() === ""
      ? null
      : turno,
    clearEmptyFields,
  );
  addOptionalField(payload, "motivo", motivo, clearEmptyFields);
  if (!clearEmptyFields || noteWasEdited) {
    addOptionalField(
      payload,
      "observacao",
      clearEmptyFields && !observacao ? null : observacao || undefined,
      clearEmptyFields,
    );
    if (!clearEmptyFields && observacao) {
      payload.observacao = observacao;
    }
  }

  if (record.category === "externalLinks") {
    addOptionalField(
      payload,
      "instituicao",
      details.institution?.trim() || undefined,
      clearEmptyFields,
    );
    addOptionalField(
      payload,
      "tipoVinculo",
      details.linkType?.trim() || undefined,
      clearEmptyFields,
    );
  }

  return { professionalId, payload };
}

export async function createRestriction(
  record: AvailabilityRecord,
  professionals: ProfessionalOption[],
): Promise<void> {
  const professionalId = resolveProfessionalId(record, professionals);
  const { payload } = buildRestrictionPayload(record, professionalId);

  await api<RestrictionApi>(`/profissionais/${professionalId}/restricoes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRestriction(
  professionalId: string,
  restrictionId: string,
  record: AvailabilityRecord,
): Promise<void> {
  const resolvedProfessionalId =
    professionalId.trim() || resolveProfessionalId(record, []);
  const { payload } = buildRestrictionPayload(
    record,
    resolvedProfessionalId,
    true,
  );

  await api<RestrictionApi>(
    `/profissionais/${resolvedProfessionalId}/restricoes/${restrictionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteRestriction(
  professionalId: string,
  restrictionId: string,
): Promise<void> {
  await api(`/profissionais/${professionalId}/restricoes/${restrictionId}`, {
    method: "DELETE",
  });
}
