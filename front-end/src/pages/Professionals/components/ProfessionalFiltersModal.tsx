import { Check, X } from "../../../components/icons";
import { STATUS_LABEL, type ProfessionalFilters } from "../filters";
import type { FormationType, ProfessionalStatus, bondType } from "../types";

type ProfessionalFiltersModalProps = {
    filters: ProfessionalFilters;
    onChange: (filters: ProfessionalFilters) => void;
    onClose: () => void;
    onApply: () => void;
};

function FilterSection<T extends string>({
    title, description, options, selected, onChange,
}: {
    title: string;
    description: string;
    options: { value: T; label: string }[];
    selected: T[];
    onChange: (values: T[]) => void;
}) {
    return (
        <section>
            <h3 className="text-sm font-bold text-text">{title}</h3>
            <p className="mt-1 text-xs text-text">{description}</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
                <FilterOption label="Todos" selected={selected.length === 0} onClick={() => onChange([])} />
                {options.map((option) => (
                    <FilterOption
                        key={option.value}
                        label={option.label}
                        selected={selected.includes(option.value)}
                        onClick={() => onChange(selected.includes(option.value)
                            ? selected.filter((value) => value !== option.value)
                            : [...selected, option.value])}
                    />
                ))}
            </div>
        </section>
    );
}

function FilterOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`flex min-h-10 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                selected ? "border-primary bg-secondary text-primary-hover" : "border-border bg-white text-text hover:bg-card-header"
            }`}
        >
            <span className={`flex size-4 shrink-0 items-center justify-center rounded-md ${selected ? "bg-primary-hover text-white" : "bg-neutral"}`}>
                {selected ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            {label}
        </button>
    );
}

const formations: { value: FormationType; label: string }[] = [
    { value: "Enfemeiro", label: "Enfermeiro" },
    { value: "Técnico", label: "Técnico" },
];
const statuses: { value: ProfessionalStatus; label: string }[] = [
    { value: "ativo", label: STATUS_LABEL.ativo },
    { value: "desativado", label: STATUS_LABEL.desativado },
    { value: "afastado", label: STATUS_LABEL.afastado },
    { value: "ferias", label: STATUS_LABEL.ferias },
];
const bonds: { value: bondType; label: string }[] = [
    { value: "Concursado", label: "Concursado" },
    { value: "CLT", label: "CLT" },
    { value: "RPA", label: "RPA" },
];

export function ProfessionalFiltersModal({ filters, onChange, onClose, onApply }: ProfessionalFiltersModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="professional-filters-title" className="flex h-full max-h-dvh w-full max-w-100 flex-col bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
                    <div>
                        <h2 id="professional-filters-title" className="text-xl font-bold text-text">Filtros de profissionais</h2>
                        <p className="mt-1 text-xs text-text">Refine a lista de profissionais</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar filtros" className="shrink-0 rounded-xl border border-border p-1.5 text-text hover:bg-card-header focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <X className="size-4" />
                    </button>
                </header>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <FilterSection title="Tipo de formação" description="Filtre por tipo de formação" options={formations} selected={filters.formation} onChange={(formation) => onChange({ ...filters, formation })} />
                    <FilterSection title="Status" description="Disponibilidade cadastral do profissional" options={statuses} selected={filters.status} onChange={(status) => onChange({ ...filters, status })} />
                    <FilterSection title="Tipo de vínculo" description="Filtre pela modalidade de contratação" options={bonds} selected={filters.bond} onChange={(bond) => onChange({ ...filters, bond })} />
                    <section>
                        <label htmlFor="professional-sort" className="text-sm font-bold text-text">Ordenação</label>
                        <p className="mt-1 text-xs text-text">Defina como os resultados serão apresentados</p>
                        <select
                            id="professional-sort"
                            value={filters.sort}
                            onChange={(event) => onChange({ ...filters, sort: event.target.value === "desc" ? "desc" : "asc" })}
                            className="mt-2 min-h-10 w-full rounded-xl border border-border bg-white px-2.5 text-sm font-semibold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <option value="asc">Nome A—Z</option>
                            <option value="desc">Nome Z—A</option>
                        </select>
                    </section>
                </div>
                <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
                    <button type="button" onClick={onClose} className="min-h-9 rounded-xl border border-border px-3 text-sm font-bold text-text hover:bg-card-header focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Cancelar</button>
                    <button type="button" onClick={onApply} className="min-h-9 rounded-xl bg-primary px-3 text-sm font-bold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Aplicar filtros</button>
                </footer>
            </aside>
        </div>
    );
}
