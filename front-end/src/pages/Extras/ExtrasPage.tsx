import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "../../components/icons";
import { listScales, type ScaleDetail } from "../../services/scales";
import { listSectors } from "../../services/sectors";
import { listProfessionals } from "../../services/professionals";
import {
  listarExtras,
  obterExtra,
  obterResumoExtras,
  type ExtraReason,
  type ExtraSituation,
  type ExtrasPage as ExtrasPageResult,
  type ExtrasSummary,
  type ScheduledExtra,
} from "../../services/extras";
import {
  CancelExtraDrawer,
  ExtraFormDrawer,
  RpaDrawer,
  type ExtraProfessional,
} from "./ExtraDrawers";
import { accentCardClass } from "../../components/ui/AccentCard";

const REASONS: Array<{ value: string; label: string }> = [
  { value: "ferias", label: "Férias" },
  { value: "ausencia", label: "Ausências" },
  { value: "atestado", label: "Atestado médico" },
  { value: "reforco", label: "Reforços" },
  { value: "outro", label: "Outros" },
];

const reasonLabel = (reason: ExtraReason) =>
  REASONS.find((item) => item.value === reason)?.label ?? reason;

function monthLabel(year: number, month: number) {
  const value = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "pt-BR",
    { month: "long", timeZone: "UTC" },
  );
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCivilDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function shiftLabel(value: ScheduledExtra["opcao"]) {
  return { "12d": "07h—19h", "12n": "19h—07h", "24h": "07h—07h" }[value];
}

function personName(
  value: ScheduledExtra["substitutoId"] | ScheduledExtra["cobertoId"],
) {
  if (!value || typeof value === "string") return null;
  return value.nome ?? value.coren ?? null;
}

function sectorName(value: ScheduledExtra["setorId"]) {
  return typeof value === "string"
    ? value
    : (value.nome ?? "Setor não informado");
}

function Indicator({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <article className="min-w-0 border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-text">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[11px] text-text-muted">{detail}</p>
      ) : null}
    </article>
  );
}

function ExtraCard({
  extra,
  onEdit,
  onCancel,
}: {
  extra: ScheduledExtra;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const substitute =
    personName(extra.substitutoId) ?? "Profissional não informado";
  const covered = personName(extra.cobertoId);
  const bond =
    typeof extra.substitutoId === "object"
      ? extra.substitutoId.tipoVinculo?.toUpperCase()
      : undefined;
  return (
    <article
      className={`flex min-w-0 flex-col p-4 pl-5 shadow-(--shadow-soft) ${accentCardClass(extra.situacao === "cancelado" ? "neutral" : "warning", "rounded-2xl")} ${extra.situacao === "cancelado" ? "opacity-75" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-md bg-warning px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-warning-text">
            Extra programado
          </span>
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary"
            >
              {substitute
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-text">
                {substitute}
              </h3>
              <p className="truncate text-[11px] text-text-muted">
                {covered ? `Cobre ${covered}` : "Reforço de equipe"}
              </p>
            </div>
          </div>
        </div>
        {bond ? (
          <span className="shrink-0 rounded-md bg-neutral px-2 py-1 text-[9px] font-bold text-text-muted">
            {bond}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 rounded-xl bg-card-header p-3 text-[10px] text-text-muted">
        <span>
          ▣ {formatCivilDate(extra.data)} · {shiftLabel(extra.opcao)}
        </span>
        <span>⌂ {sectorName(extra.setorId)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${extra.situacao === "cancelado" ? "bg-neutral text-text-muted" : "bg-highlight text-primary"}`}
        >
          {extra.situacao === "cancelado"
            ? "Cancelado"
            : reasonLabel(extra.motivo)}
        </span>
      </div>
      {extra.situacao === "programado" ? (
        <div className="mt-3 border-t border-border pt-3">
          {extra.escalaStatus === "publicada" ||
          extra.escalaStatus === "finalizada" ? (
            <p className="mb-2 text-right text-[10px] font-semibold text-danger">
              Escala oficial: revisão autorizada necessária
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={
                extra.escalaStatus === "publicada" ||
                extra.escalaStatus === "finalizada"
              }
              onClick={onEdit}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-neutral disabled:cursor-not-allowed disabled:opacity-50"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={
                extra.escalaStatus === "publicada" ||
                extra.escalaStatus === "finalizada"
              }
              onClick={onCancel}
              className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-error disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ExtrasPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [reason, setReason] = useState("");
  const [situation, setSituation] = useState<ExtraSituation | "">("programado");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ExtrasPageResult | null>(null);
  const [summary, setSummary] = useState<ExtrasSummary | null>(null);
  const [scales, setScales] = useState<ScaleDetail[]>([]);
  const [sectors, setSectors] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [professionals, setProfessionals] = useState<ExtraProfessional[]>([]);
  const [drawer, setDrawer] = useState<
    "create" | "edit" | "cancel" | "rpa" | null
  >(null);
  const [selected, setSelected] = useState<ScheduledExtra | null>(null);

  useEffect(() => {
    let active = true;
    listSectors()
      .then((items) => {
        if (active)
          setSectors(items.map((item) => ({ id: item.id, name: item.name })));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    listProfessionals()
      .then((items) =>
        setProfessionals(
          items.filter((item): item is ExtraProfessional => Boolean(item.id)),
        ),
      )
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextResult, nextSummary, nextScales] = await Promise.all([
        listarExtras({
          ano: year,
          mes: month,
          busca: search,
          setorId: sectorId,
          motivo: reason,
          situacao: situation || undefined,
          pagina: page,
          limite: 12,
        }),
        obterResumoExtras(year, month),
        listScales(year, month),
      ]);
      setResult(nextResult);
      setSummary(nextSummary);
      setScales(nextScales);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os extras programados.",
      );
    } finally {
      setLoading(false);
    }
  }, [month, page, reason, search, sectorId, situation, year]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, retry]);

  const coverage = useMemo(() => {
    if (!scales.length) return null;
    return (
      scales[0].pendencias.length || scales[0].resumo.vagasDescobertas || 0
    );
  }, [scales]);

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSectorId("");
    setReason("");
    setSituation("programado");
    setPage(1);
  };
  const openEdit = async (extra: ScheduledExtra) => {
    try {
      const detail = await obterExtra(extra.id);
      setSelected(detail);
    } catch {
      setSelected(extra);
    }
    setDrawer("edit");
  };
  const hasFilters = Boolean(
    search || sectorId || reason || situation !== "programado",
  );

  return (
    <section
      className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12"
      aria-labelledby="extras-heading"
    >
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="extras-heading"
            className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text"
          >
            Extras programados
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Coberturas planejadas para férias, ausências e reforços.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDrawer("rpa")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold hover:bg-neutral"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Cadastrar RPA
          </button>
          <button
            type="button"
            onClick={() => setDrawer("create")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:brightness-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Registrar extra
          </button>
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => changeMonth(-1)}
            className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm hover:bg-neutral"
          >
            ‹
          </button>
          <span
            aria-live="polite"
            className="min-w-32 text-center text-sm font-semibold text-text"
          >
            {monthLabel(year, month)} de {year}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => changeMonth(1)}
            className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm hover:bg-neutral"
          >
            ›
          </button>
        </div>
      </header>

      <section
        aria-label="Indicadores mensais"
        className="mb-5 grid overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft) sm:grid-cols-2 lg:grid-cols-4"
      >
        <Indicator
          label="Extras ativos no mês"
          value={summary?.totalExtrasAtivos ?? "—"}
          detail="Programações persistidas"
        />
        <Indicator
          label="Horas programadas"
          value={summary ? `${summary.totalHoras}h` : "—"}
          detail="Sem contar cancelados"
        />
        <Indicator
          label="Profissionais RPA ativos"
          value={summary?.totalRpaAtivos ?? "—"}
          detail="Cadastro ativo"
        />
        <Indicator
          label="Posições descobertas"
          value={coverage === null ? "Não calculada" : coverage}
          detail={
            coverage === null
              ? "Sem escala no período"
              : "Cobertura real da escala"
          }
        />
      </section>

      {coverage !== null && coverage > 0 ? (
        <p className="mb-4 inline-flex w-fit rounded-lg bg-error px-3 py-2 text-xs font-semibold text-danger">
          ⚠ {coverage} posição(ões) descoberta(s)
        </p>
      ) : null}
      <section
        aria-label="Filtros de extras"
        className="mb-5 rounded-2xl border border-border bg-white p-3 shadow-(--shadow-soft) sm:p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card-header px-3">
            <Search
              className="size-4 shrink-0 text-text-muted"
              strokeWidth={1.8}
            />
            <span className="sr-only">Buscar extras</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nome, COREN ou motivo"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setReason("");
              setSituation("programado");
              setPage(1);
            }}
            className={`rounded-lg px-3 py-2 text-[10px] font-semibold ${!reason && situation === "programado" ? "bg-highlight text-primary" : "bg-neutral text-text-muted"}`}
          >
            Todos
          </button>
          {REASONS.filter((item) => item.value !== "outro").map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setReason(item.value);
                setSituation("programado");
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-[10px] font-semibold ${reason === item.value ? "bg-highlight text-primary" : "bg-neutral text-text-muted"}`}
            >
              {item.value === "ferias" ? "Férias" : item.label}
            </button>
          ))}
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-text-muted hover:bg-neutral"
            >
              Limpar filtros
            </button>
          ) : (
            <span />
          )}
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-white p-4 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setRetry((value) => value + 1);
            }}
            className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-bold hover:bg-error"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {loading ? (
        <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-muted md:col-span-2 xl:col-span-3">
            Carregando extras programados…
          </p>
        </div>
      ) : null}
      {!loading && !error && result?.itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-semibold text-text">Nenhum extra encontrado</p>
          <p className="mt-1 text-sm text-text-muted">
            Não há programações para este período ou filtros.
          </p>
        </div>
      ) : null}
      {!loading && !error && result?.itens.length ? (
        <>
          <div
            role="list"
            aria-label="Extras programados"
            className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {result.itens.map((extra) => (
              <ExtraCard
                key={extra.id}
                extra={extra}
                onEdit={() => void openEdit(extra)}
                onCancel={() => {
                  setSelected(extra);
                  setDrawer("cancel");
                }}
              />
            ))}
          </div>
          <nav
            aria-label="Paginação de extras"
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-xs text-text-muted">
              {result.total} registro(s) · página {result.pagina} de{" "}
              {Math.max(1, result.totalPaginas)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={result.pagina <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={result.pagina >= result.totalPaginas}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </nav>
        </>
      ) : null}
      {drawer === "create" || drawer === "edit" ? (
        <ExtraFormDrawer
          sectors={sectors}
          professionals={professionals}
          extra={drawer === "edit" ? selected : null}
          onClose={() => {
            setDrawer(null);
            setSelected(null);
          }}
          onSaved={async () => {
            setDrawer(null);
            setSelected(null);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
      {drawer === "cancel" && selected ? (
        <CancelExtraDrawer
          extra={selected}
          onClose={() => {
            setDrawer(null);
            setSelected(null);
          }}
          onCancelled={async () => {
            setDrawer(null);
            setSelected(null);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
      {drawer === "rpa" ? (
        <RpaDrawer
          onClose={() => setDrawer(null)}
          onCreated={async (professional) => {
            setProfessionals((current) => [
              ...current,
              professional as ExtraProfessional,
            ]);
            setDrawer(null);
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </section>
  );
}
