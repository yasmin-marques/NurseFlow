import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, Clock, X } from "../../../components/icons";

export type AvailabilityCategory =
  | "restrictions"
  | "externalLinks"
  | "absences";
export type AvailabilityRuleType = "unavailableDays" | "allowedShift";
export type AvailabilityValidity = "recurring" | "definedPeriod";

export type AvailabilityRecordDetails = {
  ruleType?: AvailabilityRuleType;
  validity?: AvailabilityValidity;
  days?: string[];
  shift?: string;
  validFrom?: string;
  validTo?: string;
  institution?: string;
  linkType?: string;
  linkShift?: string;
  startDate?: string;
  endDate?: string;
  absenceType?: string;
  note?: string;
  noteEdited?: boolean;
};

export type AvailabilityRecord = {
  id: string;
  professionalId?: string;
  category: AvailabilityCategory;
  name: string;
  role: string;
  rule: string;
  period: string;
  details?: AvailabilityRecordDetails;
};

type AvailabilityFormModalProps = {
  category: AvailabilityCategory;
  record?: AvailabilityRecord;
  professionals?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (record: AvailabilityRecord) => void;
};

type FormErrors = Record<string, string>;

const DAYS = [
  { value: "segunda", label: "Seg" },
  { value: "terça", label: "Ter" },
  { value: "quarta", label: "Qua" },
  { value: "quinta", label: "Qui" },
  { value: "sexta", label: "Sex" },
  { value: "sábado", label: "Sáb" },
  { value: "domingo", label: "Dom" },
];

const DAY_NAMES: Record<string, string> = {
  segunda: "segundas-feiras",
  terça: "terças-feiras",
  quarta: "quartas-feiras",
  quinta: "quintas-feiras",
  sexta: "sextas-feiras",
  sábado: "sábados",
  domingo: "domingos",
};

const inputClassName =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text placeholder:text-text-muted/70 transition focus:border-primary focus:ring-2 focus:ring-primary/15";

function formatDays(days: string[]) {
  return days.map((day) => DAY_NAMES[day] ?? day).join(", ");
}

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatShiftLabel(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "day") return "Diurno";
  if (normalized === "night") return "Noturno";
  if (normalized === "flexible") return "Flexível";
  return "";
}

function normalizeLegacyAbsenceType(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLocaleLowerCase("pt-BR");
  const knownValues: Record<string, string> = {
    ferias: "Férias",
    férias: "Férias",
    licenca: "Licença",
    licença: "Licença",
    ausencia: "Ausência",
    ausência: "Ausência",
    "ausencia pontual": "Ausência pontual",
    "ausência pontual": "Ausência pontual",
  };

  return knownValues[normalized] ?? trimmed;
}

function getProfessionalLabel(
  professional: { id: string; name: string },
  professionals: Array<{ id: string; name: string }>,
) {
  const duplicateCount = professionals.filter(
    (candidate) => candidate.name.trim() === professional.name.trim(),
  ).length;

  if (duplicateCount <= 1) return professional.name;
  return `${professional.name} (${professional.id})`;
}

function getInitialRuleType(record?: AvailabilityRecord): AvailabilityRuleType {
  if (record?.details?.ruleType) return record.details.ruleType;
  return record?.rule.toLocaleLowerCase("pt-BR").includes("somente turno")
    ? "allowedShift"
    : "unavailableDays";
}

function getInitialDays(record?: AvailabilityRecord) {
  if (record?.details?.days) return record.details.days;
  const rule = record?.rule.toLocaleLowerCase("pt-BR") ?? "";
  return DAYS.map((day) => day.value).filter((day) => rule.includes(day));
}

function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="block text-[13px] font-semibold text-text">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{hint}</p>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectionCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative flex min-h-19.5 w-full flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-primary bg-[#f1f7ef] shadow-[inset_0_0_0_1px_rgba(46,120,61,0.12)]"
          : "border-border bg-white hover:border-[#b9cfb6] hover:bg-[#fbfcfa]"
      }`}
    >
      <span
        className={`text-sm font-semibold ${selected ? "text-primary" : "text-text"}`}
      >
        {title}
      </span>
      <span className="mt-1 text-xs leading-relaxed text-text-muted">
        {description}
      </span>
      {selected ? (
        <span className="absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-3" strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  );
}

function InfoCard({
  title,
  children,
  icon = "check",
}: {
  title: string;
  children: ReactNode;
  icon?: "check" | "clock";
}) {
  const Icon = icon === "clock" ? Clock : Check;

  return (
    <aside className="flex items-start gap-3 rounded-xl border border-[#dcebd9] bg-[#edf5eb] px-4 py-3.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dcebd8] text-primary">
        <Icon className="size-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[#285f34]">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-[#53705a]">
          {children}
        </div>
      </div>
    </aside>
  );
}

export function AvailabilityFormModal({
  category,
  record,
  professionals = [],
  onClose,
  onSave,
}: AvailabilityFormModalProps) {
  const initialRuleType = getInitialRuleType(record);
  const [professionalId, setProfessionalId] = useState(
    record?.professionalId ??
      professionals.find((item) => item.name === record?.name)?.id ??
      "",
  );
  const [name, setName] = useState(
    record?.name ??
      professionals.find((item) => item.id === professionalId)?.name ??
      "",
  );
  const [ruleType, setRuleType] =
    useState<AvailabilityRuleType>(initialRuleType);
  const [validity, setValidity] = useState<AvailabilityValidity>(
    record?.details?.validity === "recurring"
      ? "definedPeriod"
      : (record?.details?.validity ?? "definedPeriod"),
  );
  const [days, setDays] = useState<string[]>(getInitialDays(record));
  const [shift, setShift] = useState(
    record?.details?.shift ??
      (initialRuleType === "allowedShift" &&
      record?.rule.toLocaleLowerCase("pt-BR").includes("diurno")
        ? "day"
        : ""),
  );
  const [validFrom, setValidFrom] = useState(record?.details?.validFrom ?? "");
  const [validTo, setValidTo] = useState(record?.details?.validTo ?? "");
  const [institution, setInstitution] = useState(
    record?.details?.institution ??
      record?.rule.replace(/^Vínculo no /i, "") ??
      "",
  );
  const [linkType, setLinkType] = useState(
    record?.details?.linkType ??
      (record?.rule.startsWith("Vínculo no ")
        ? "Vínculo profissional"
        : record
          ? "Compromisso externo"
          : ""),
  );
  const [linkDays, setLinkDays] = useState<string[]>(
    record?.details?.days ?? [],
  );
  const [linkShift, setLinkShift] = useState(record?.details?.linkShift ?? "");
  const [linkStartDate, setLinkStartDate] = useState(
    record?.details?.startDate ?? "",
  );
  const [linkEndDate, setLinkEndDate] = useState(
    record?.details?.endDate ?? "",
  );
  const [absenceType, setAbsenceType] = useState(
    normalizeLegacyAbsenceType(record?.details?.absenceType ?? ""),
  );
  const [absenceStartDate, setAbsenceStartDate] = useState(
    record?.details?.startDate ?? "",
  );
  const [absenceEndDate, setAbsenceEndDate] = useState(
    record?.details?.endDate ?? "",
  );
  const [note, setNote] = useState(record?.details?.note ?? "");
  const [noteEdited, setNoteEdited] = useState(
    Boolean(record?.details?.noteEdited),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const hasDuplicateProfessionalNames =
    new Set(
      professionals
        .map((professional) => professional.name.trim())
        .filter((name, index, names) => names.indexOf(name) !== index),
    ).size > 0;

  useEffect(() => {
    if (!record) return;
    setProfessionalId(
      record.professionalId ??
        professionals.find((item) => item.name === record.name)?.id ??
        "",
    );
    setName(record.name ?? "");
    setAbsenceType(
      normalizeLegacyAbsenceType(record.details?.absenceType ?? ""),
    );
  }, [record, professionals]);

  useEffect(() => {
    if (!professionalId) {
      setName(record?.name ?? "");
      return;
    }

    const selectedProfessional = professionals.find(
      (item) => item.id === professionalId,
    );
    if (selectedProfessional) {
      setName(selectedProfessional.name);
    }
  }, [professionalId, professionals, record?.name]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateField = (field: string, update: () => void) => {
    update();
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const toggleDay = (
    day: string,
    selectedDays: string[],
    update: (value: string[]) => void,
  ) => {
    update(
      selectedDays.includes(day)
        ? selectedDays.filter((selectedDay) => selectedDay !== day)
        : [...selectedDays, day],
    );
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!professionalId) next.name = "Selecione o profissional.";

    if (noteEdited && note.length > 300) {
      next.note = "A observação deve ter no máximo 300 caracteres.";
    }

    if (category === "restrictions") {
      if (ruleType === "unavailableDays" && days.length === 0) {
        next.days = "Selecione ao menos um dia indisponível.";
      }
      if (ruleType === "allowedShift" && !shift)
        next.shift = "Selecione o turno permitido.";
      if (validity === "definedPeriod") {
        if (!validFrom) next.validFrom = "Informe a data de início.";
        if (!validTo) next.validTo = "Informe a data de fim.";
        if (validFrom && validTo && validTo < validFrom) {
          next.validTo = "A data de fim deve ser igual ou posterior ao início.";
        }
      }
    } else if (category === "externalLinks") {
      if (!institution.trim())
        next.institution = "Informe a instituição ou local externo.";
      if (!linkType) next.linkType = "Selecione o tipo de vínculo.";
      if (!linkStartDate) next.linkStartDate = "Informe a data de início.";
      if (!linkEndDate) next.linkEndDate = "Informe a data de término.";
      if (linkStartDate && linkEndDate && linkEndDate < linkStartDate) {
        next.linkDates =
          "A data de término deve ser igual ou posterior ao início.";
      }
    } else {
      if (!absenceType) next.absenceType = "Selecione o tipo de ausência.";
      if (!absenceStartDate)
        next.absenceStartDate = "Informe a data de início.";
      if (!absenceEndDate) next.absenceEndDate = "Informe a data de término.";
      if (
        absenceStartDate &&
        absenceEndDate &&
        absenceEndDate < absenceStartDate
      ) {
        next.absenceEndDate =
          "A data de término deve ser igual ou posterior ao início.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    let rule = "";
    let period = "";
    let details: AvailabilityRecord["details"];

    const nextNote = noteEdited ? note.trim() : undefined;

    if (category === "restrictions") {
      rule =
        ruleType === "unavailableDays"
          ? `Não disponível às ${formatDays(days)}`
          : `Somente turno ${formatShiftLabel(shift) || "turno"}`;
      period = `${formatDate(validFrom)} a ${formatDate(validTo)}`;
      details = {
        ruleType,
        validity: "definedPeriod",
        days,
        shift,
        validFrom,
        validTo,
        note: nextNote,
        noteEdited,
      };
    } else if (category === "externalLinks") {
      rule = `${linkType} · ${institution.trim()}`;
      const periodParts = [
        linkDays.length ? formatDays(linkDays) : "",
        linkShift ? formatShiftLabel(linkShift) : "",
        linkStartDate && linkEndDate
          ? `${formatDate(linkStartDate)} a ${formatDate(linkEndDate)}`
          : "",
      ].filter(Boolean);
      period = periodParts.join(" · ") || "Vigência não definida";
      details = {
        institution: institution.trim(),
        linkType,
        days: linkDays,
        linkShift,
        startDate: linkStartDate,
        endDate: linkEndDate,
        note: nextNote,
        noteEdited,
      };
    } else {
      rule = absenceType;
      period = `${formatDate(absenceStartDate)} a ${formatDate(absenceEndDate)}`;
      details = {
        absenceType,
        startDate: absenceStartDate,
        endDate: absenceEndDate,
        note: nextNote,
        noteEdited,
      };
    }

    onSave({
      id: record?.id ?? crypto.randomUUID(),
      professionalId: professionalId || undefined,
      category,
      name: name.trim(),
      role: record?.role ?? "Enfermagem",
      rule,
      period,
      details,
    });
  };

  const title =
    category === "restrictions"
      ? record
        ? "Editar restrição"
        : "Nova restrição"
      : category === "externalLinks"
        ? record
          ? "Editar vínculo externo"
          : "Novo vínculo externo"
        : record
          ? "Editar férias ou ausência"
          : "Registrar férias ou ausência";
  const subtitle =
    category === "restrictions"
      ? "Defina quando o profissional não pode ser escalado"
      : category === "externalLinks"
        ? "Registre um compromisso profissional fora da instituição"
        : "Informe o período em que o profissional estará ausente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-3 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-form-title"
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_80px_rgba(22,29,24,0.2)] sm:max-h-[calc(100dvh-2.5rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h2
              id="availability-form-title"
              className="text-xl font-bold tracking-tight text-text"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-page hover:text-text"
          >
            <X className="size-5" />
          </button>
        </header>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {category === "restrictions" ? (
              <InfoCard title="Regra de disponibilidade" icon="clock">
                Esta informação será considerada ao gerar novas escalas.
              </InfoCard>
            ) : category === "externalLinks" ? (
              <InfoCard title="Vínculo externo">
                Registre os dados do compromisso para consulta durante a
                elaboração da escala.
              </InfoCard>
            ) : (
              <InfoCard title="Registro de ausência">
                O período informado ficará associado ao profissional nesta lista
                de disponibilidade.
              </InfoCard>
            )}

            <section className="space-y-4" aria-label="Dados do profissional">
              <h3 className="text-sm font-bold text-text">Profissional</h3>
              <Field label="Profissional" required error={errors.name}>
                {record ? (
                  <select
                    value={professionalId}
                    disabled
                    aria-label="Profissional em edição"
                    className={`${inputClassName} cursor-not-allowed bg-page text-text-muted`}
                  >
                    {professionals
                      .filter(
                        (professional) => professional.id === professionalId,
                      )
                      .map((professional) => (
                        <option key={professional.id} value={professional.id}>
                          {hasDuplicateProfessionalNames
                            ? getProfessionalLabel(professional, professionals)
                            : professional.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <select
                    autoFocus
                    value={professionalId}
                    onChange={(event) =>
                      updateField("name", () => {
                        setProfessionalId(event.target.value);
                      })
                    }
                    aria-invalid={Boolean(errors.name)}
                    className={`${inputClassName} ${errors.name ? "border-danger" : ""}`}
                  >
                    <option value="">Selecione o profissional</option>
                    {professionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {hasDuplicateProfessionalNames
                          ? getProfessionalLabel(professional, professionals)
                          : professional.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </section>

            {category === "restrictions" ? (
              <>
                <section className="space-y-3" aria-label="Tipo de regra">
                  <Field label="Tipo de regra" required>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <SelectionCard
                        title="Dias indisponíveis"
                        description="Não escalar nos dias marcados"
                        selected={ruleType === "unavailableDays"}
                        onClick={() => {
                          setRuleType("unavailableDays");
                          setShift("");
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.shift;
                            delete next.days;
                            return next;
                          });
                        }}
                      />
                      <SelectionCard
                        title="Turno permitido"
                        description="Escalar apenas no turno escolhido"
                        selected={ruleType === "allowedShift"}
                        onClick={() => {
                          setRuleType("allowedShift");
                          setDays([]);
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.days;
                            delete next.shift;
                            return next;
                          });
                        }}
                      />
                    </div>
                  </Field>
                </section>

                {ruleType === "unavailableDays" ? (
                  <section
                    className="space-y-3"
                    aria-label="Dias indisponíveis"
                  >
                    <Field
                      label="Dias indisponíveis"
                      required
                      hint="Selecione todos os dias em que o profissional não poderá ser escalado."
                      error={errors.days}
                    >
                      <div className="mt-2 flex flex-wrap gap-2">
                        {DAYS.map((day) => {
                          const isSelected = days.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateField("days", () =>
                                  toggleDay(day.value, days, setDays),
                                )
                              }
                              className={`h-10 min-w-11 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary text-white"
                                  : "border-border bg-white text-text-muted hover:border-[#b9cfb6] hover:text-primary"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </section>
                ) : (
                  <Field label="Turno permitido" required error={errors.shift}>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {[
                        { value: "day", label: "Diurno · 07h–19h" },
                        { value: "night", label: "Noturno · 19h–07h" },
                      ].map((option) => {
                        const isSelected = shift === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateField("shift", () => setShift(option.value))
                            }
                            className={`flex h-12 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors ${
                              isSelected
                                ? "border-primary bg-[#f1f7ef] text-primary"
                                : "border-border bg-white text-text-muted hover:border-[#b9cfb6]"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                <section
                  className="space-y-3"
                  aria-label="Validade da restrição"
                >
                  <Field label="Validade" required error={errors.validity}>
                    <div className="mt-2">
                      <SelectionCard
                        title="Período definido"
                        description="Com início e fim"
                        selected={validity === "definedPeriod"}
                        onClick={() => {
                          setValidity("definedPeriod");
                          setErrors((current) => {
                            const next = { ...current };
                            delete next.validity;
                            return next;
                          });
                        }}
                      />
                    </div>
                  </Field>
                  {validity === "definedPeriod" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Início da validade"
                        required
                        error={errors.validFrom}
                      >
                        <input
                          type="date"
                          value={validFrom}
                          onChange={(event) =>
                            updateField("validFrom", () => {
                              setValidFrom(event.target.value);
                              setErrors((current) => {
                                if (!current.validTo) return current;
                                const next = { ...current };
                                delete next.validTo;
                                return next;
                              });
                            })
                          }
                          aria-invalid={Boolean(errors.validFrom)}
                          className={`${inputClassName} ${errors.validFrom ? "border-danger" : ""}`}
                        />
                      </Field>
                      <Field
                        label="Fim da validade"
                        required
                        error={errors.validTo}
                      >
                        <input
                          type="date"
                          min={validFrom || undefined}
                          value={validTo}
                          onChange={(event) =>
                            updateField("validTo", () =>
                              setValidTo(event.target.value),
                            )
                          }
                          aria-invalid={Boolean(errors.validTo)}
                          className={`${inputClassName} ${errors.validTo ? "border-danger" : ""}`}
                        />
                      </Field>
                    </div>
                  ) : null}
                </section>

                <Field
                  label="Observação"
                  hint="Opcional · Contexto adicional destinado à coordenação"
                >
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteEdited(true);
                    }}
                    placeholder="Adicione um contexto para a coordenação"
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-text placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  {noteEdited && note.length > 300 ? (
                    <p
                      className="mt-1.5 text-xs font-medium text-danger"
                      role="alert"
                    >
                      A observação deve ter no máximo 300 caracteres.
                    </p>
                  ) : null}
                </Field>

                <InfoCard title="Resumo da regra">
                  {ruleType === "unavailableDays"
                    ? days.length
                      ? `Indisponível às ${formatDays(days)}.`
                      : "Selecione os dias em que o profissional estará indisponível."
                    : shift
                      ? `Disponível apenas no turno ${formatShiftLabel(shift) || "selecionado"}.`
                      : "Selecione o turno em que o profissional poderá ser escalado."}{" "}
                  {validFrom && validTo
                    ? `Válida de ${formatDate(validFrom)} a ${formatDate(validTo)}.`
                    : "Informe o período de validade."}
                </InfoCard>
              </>
            ) : null}

            {category === "externalLinks" ? (
              <>
                <section
                  className="space-y-4"
                  aria-label="Dados do vínculo externo"
                >
                  <h3 className="text-sm font-bold text-text">
                    Dados do vínculo
                  </h3>
                  <Field
                    label="Instituição ou local externo"
                    required
                    error={errors.institution}
                  >
                    <input
                      value={institution}
                      onChange={(event) =>
                        updateField("institution", () =>
                          setInstitution(event.target.value),
                        )
                      }
                      placeholder="Ex.: Hospital, clínica ou instituição"
                      maxLength={100}
                      aria-invalid={Boolean(errors.institution)}
                      className={`${inputClassName} ${errors.institution ? "border-danger" : ""}`}
                    />
                  </Field>
                  <Field
                    label="Tipo de vínculo"
                    required
                    error={errors.linkType}
                  >
                    <select
                      value={linkType}
                      onChange={(event) =>
                        updateField("linkType", () =>
                          setLinkType(event.target.value),
                        )
                      }
                      aria-invalid={Boolean(errors.linkType)}
                      className={`${inputClassName} ${errors.linkType ? "border-danger" : ""}`}
                    >
                      <option value="">Selecione o tipo de vínculo</option>
                      <option value="Vínculo profissional">
                        Vínculo profissional
                      </option>
                      <option value="Outro emprego">Outro emprego</option>
                      <option value="Compromisso externo">
                        Compromisso externo
                      </option>
                    </select>
                  </Field>
                  <Field
                    label="Dias da semana"
                    hint="Opcional · Selecione os dias em que ocorre o compromisso."
                  >
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const isSelected = linkDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() =>
                              toggleDay(day.value, linkDays, setLinkDays)
                            }
                            className={`h-10 min-w-11 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-white text-text-muted hover:border-[#b9cfb6] hover:text-primary"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field
                    label="Turno ou horário"
                    hint="Opcional · Indique o período do compromisso."
                  >
                    <select
                      value={linkShift}
                      onChange={(event) => setLinkShift(event.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Não especificado</option>
                      <option value="day">Diurno · 07h–19h</option>
                      <option value="night">Noturno · 19h–07h</option>
                      <option value="flexible">Flexível</option>
                    </select>
                  </Field>
                </section>

                <section className="space-y-3" aria-label="Vigência do vínculo">
                  <Field
                    label="Vigência"
                    hint="Obrigatório · informe o início e o término do vínculo."
                    error={errors.linkDates}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <span className="text-xs font-medium text-text-muted">
                          Data de início
                        </span>
                        <input
                          type="date"
                          value={linkStartDate}
                          onChange={(event) => {
                            setLinkStartDate(event.target.value);
                            setErrors((current) => {
                              const next = { ...current };
                              delete next.linkDates;
                              return next;
                            });
                          }}
                          className={`${inputClassName} mt-1`}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-text-muted">
                          Data de término
                        </span>
                        <input
                          type="date"
                          min={linkStartDate || undefined}
                          value={linkEndDate}
                          onChange={(event) => {
                            setLinkEndDate(event.target.value);
                            setErrors((current) => {
                              const next = { ...current };
                              delete next.linkDates;
                              return next;
                            });
                          }}
                          className={`${inputClassName} mt-1`}
                        />
                      </div>
                    </div>
                  </Field>
                </section>

                <Field label="Observação" hint="Opcional">
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteEdited(true);
                    }}
                    placeholder="Informações adicionais sobre o vínculo"
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-text placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  {noteEdited && note.length > 300 ? (
                    <p
                      className="mt-1.5 text-xs font-medium text-danger"
                      role="alert"
                    >
                      A observação deve ter no máximo 300 caracteres.
                    </p>
                  ) : null}
                </Field>
              </>
            ) : null}

            {category === "absences" ? (
              <>
                <section className="space-y-4" aria-label="Dados da ausência">
                  <h3 className="text-sm font-bold text-text">
                    Dados da ausência
                  </h3>
                  <Field
                    label="Tipo de ausência"
                    required
                    error={errors.absenceType}
                  >
                    <select
                      value={absenceType}
                      onChange={(event) =>
                        updateField("absenceType", () =>
                          setAbsenceType(
                            normalizeLegacyAbsenceType(event.target.value),
                          ),
                        )
                      }
                      aria-invalid={Boolean(errors.absenceType)}
                      className={`${inputClassName} ${errors.absenceType ? "border-danger" : ""}`}
                    >
                      <option value="">Selecione o tipo de ausência</option>
                      {[
                        "Férias",
                        "Licença",
                        "Ausência",
                        "Ausência pontual",
                        ...(absenceType &&
                        ![
                          "Férias",
                          "Licença",
                          "Ausência",
                          "Ausência pontual",
                        ].includes(absenceType)
                          ? [absenceType]
                          : []),
                      ].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Data de início"
                      required
                      error={errors.absenceStartDate}
                    >
                      <input
                        type="date"
                        value={absenceStartDate}
                        onChange={(event) =>
                          updateField("absenceStartDate", () =>
                            setAbsenceStartDate(event.target.value),
                          )
                        }
                        aria-invalid={Boolean(errors.absenceStartDate)}
                        className={`${inputClassName} ${errors.absenceStartDate ? "border-danger" : ""}`}
                      />
                    </Field>
                    <Field
                      label="Data de término"
                      required
                      error={errors.absenceEndDate}
                    >
                      <input
                        type="date"
                        min={absenceStartDate || undefined}
                        value={absenceEndDate}
                        onChange={(event) =>
                          updateField("absenceEndDate", () =>
                            setAbsenceEndDate(event.target.value),
                          )
                        }
                        aria-invalid={Boolean(errors.absenceEndDate)}
                        className={`${inputClassName} ${errors.absenceEndDate ? "border-danger" : ""}`}
                      />
                    </Field>
                  </div>
                </section>
                <Field label="Observação ou justificativa" hint="Opcional">
                  <textarea
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteEdited(true);
                    }}
                    placeholder="Adicione informações adicionais, se necessário"
                    rows={3}
                    className="mt-1.5 w-full resize-y rounded-xl border border-border bg-white px-3.5 py-3 text-sm text-text placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  {noteEdited && note.length > 300 ? (
                    <p
                      className="mt-1.5 text-xs font-medium text-danger"
                      role="alert"
                    >
                      A observação deve ter no máximo 300 caracteres.
                    </p>
                  ) : null}
                </Field>
                <InfoCard title="Período informado" icon="clock">
                  {absenceStartDate && absenceEndDate
                    ? `${absenceType || "Ausência"} de ${formatDate(absenceStartDate)} a ${formatDate(absenceEndDate)}.`
                    : "Informe as datas para conferir o período da ausência."}
                </InfoCard>
              </>
            ) : null}

            <p className="text-xs text-text-muted">
              <span className="font-semibold text-danger">*</span> Campos
              obrigatórios
            </p>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-text transition-colors hover:bg-page"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover"
            >
              <Check className="size-4" strokeWidth={2.3} />
              {category === "restrictions"
                ? "Salvar restrição"
                : category === "externalLinks"
                  ? "Salvar vínculo"
                  : "Salvar ausência"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
