import { useState, type ReactNode } from "react";
import { Check, ChevronRight, Filter, X } from "../../../components/icons";
import { initialFilters as initialValues, STATUS_LABEL, type ProfessionalFilters } from "../filters";

type ProfessionalFiltersModalProps = {
    onClose: () => void;
    onApply: (filters: ProfessionalFilters) => void;
    initialFilters: ProfessionalFilters;
};

function FilterOption({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-colors ${
                selected
                    ? "border-primary bg-[#f1f7ef] text-primary"
                    : "border-border bg-white text-text-muted hover:bg-card-header"
            }`}
        >
            <span className={`flex size-4.5 shrink-0 items-center justify-center rounded-md ${selected ? "bg-primary text-white" : "bg-[#e7ebe5]"}`}>
                {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            {label}
        </button>
    );
}

function FilterSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section>
            <h3 className="text-base font-bold text-text">{title}</h3>
            <p className="mt-1 text-xs text-text-muted">{description}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">{children}</div>
        </section>
    );
}

export function ProfessionalFiltersModal({ onClose, onApply, initialFilters }: ProfessionalFiltersModalProps) {
    const [filters, setFilters] = useState(initialFilters ?? initialValues);
    const [sortOpen, setSortOpen] = useState(false);

    const update = <K extends keyof ProfessionalFilters>(key: K, value: ProfessionalFilters[K]) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="professional-filters-title"
                className="flex h-full w-full max-w-115 flex-col bg-white shadow-2xl"
            >
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="professional-filters-title" className="text-base font-bold text-text">Filtros de profissionais</h2>
                        <p className="mt-1 text-sm text-text-muted">Refine a lista de profissionais</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar filtros" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <FilterSection title="Tipo de formação" description="Filtre por tipo de formação">
                        <FilterOption label="Todos" selected={filters.formation === "all"} onClick={() => update("formation", "all")} />
                        <FilterOption label="Enfermeiro" selected={filters.formation === "Enfemeiro"} onClick={() => update("formation", "Enfemeiro")} />
                        <FilterOption label="Técnico" selected={filters.formation === "Técnico"} onClick={() => update("formation", "Técnico")} />
                    </FilterSection>

                    <FilterSection title="Status" description="Disponibilidade cadastral do profissional">
                        <FilterOption label="Todos" selected={filters.status === "all"} onClick={() => update("status", "all")} />
                        <FilterOption label="Ativos" selected={filters.status === "ativo"} onClick={() => update("status", "ativo")} />
                        <FilterOption label="Desativados" selected={filters.status === "desativado"} onClick={() => update("status", "desativado")} />
                        <FilterOption label="Afastados" selected={filters.status === "afastado"} onClick={() => update("status", "afastado")} />
                        <FilterOption label="Férias" selected={filters.status === "ferias"} onClick={() => update("status", "ferias")} />
                    </FilterSection>

                    <FilterSection title="Tipo de vínculo" description="Filtre pela modalidade de contratação">
                        <FilterOption label="Todos" selected={filters.bond === "all"} onClick={() => update("bond", "all")} />
                        <FilterOption label="Concursado" selected={filters.bond === "Concursado"} onClick={() => update("bond", "Concursado")} />
                        <FilterOption label="CLT" selected={filters.bond === "CLT"} onClick={() => update("bond", "CLT")} />
                        <FilterOption label="RPA" selected={filters.bond === "RPA"} onClick={() => update("bond", "RPA")} />
                    </FilterSection>

                    <FilterSection title="Ordenação" description="Defina como os resultados serão apresentados">
                        <div className="relative col-span-2">
                            <button
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={sortOpen}
                                onClick={() => setSortOpen((open) => !open)}
                                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3 text-xs font-semibold text-text hover:bg-card-header"
                            >
                                Nome {filters.sort === "asc" ? "A—Z" : "Z—A"}
                                <ChevronRight className={`size-4 transition-transform ${sortOpen ? "rotate-90" : ""}`} />
                            </button>
                            {sortOpen ? (
                                <div role="listbox" aria-label="Ordenar profissionais" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-white p-1 shadow-lg">
                                    {([
                                        { value: "asc", label: "Nome A—Z" },
                                        { value: "desc", label: "Nome Z—A" },
                                    ] as const).map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="option"
                                            aria-selected={filters.sort === option.value}
                                            onClick={() => {
                                                update("sort", option.value);
                                                setSortOpen(false);
                                            }}
                                            className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-card-header ${filters.sort === option.value ? "bg-[#f1f7ef] text-primary" : "text-text"}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </FilterSection>

                    <div className="flex items-center gap-2 rounded-xl bg-[#e8f3e3] px-3 py-3 text-[10px] font-semibold text-[#285f34]">
                        <Filter className="size-4 shrink-0" />
                        {filters.formation === "all" ? "Todos" : filters.formation === "Enfemeiro" ? "Enfermeiro" : "Técnico"}
                        <span>·</span>
                        {filters.status === "all" ? "Todos" : STATUS_LABEL[filters.status]}
                        <span>·</span>
                        Nome {filters.sort === "asc" ? "A—Z" : "Z—A"}
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    <button type="button" onClick={() => onApply(initialValues)} className="mr-auto rounded-xl px-3 py-2.5 text-xs font-bold text-primary hover:bg-[#f1f7ef]">Remover filtros</button>
                    <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                    <button type="button" onClick={() => onApply(filters)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Aplicar filtros</button>
                </footer>
            </aside>
        </div>
    );
}
