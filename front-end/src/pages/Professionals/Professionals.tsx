import { useEffect, useState } from "react";
import { Download, Filter, Plus, Search, Upload, X } from "../../components/icons";
import { ProfessionalCard } from "./components/ProfesssionalCard";
import { ProfessionalFiltersModal } from "./components/ProfessionalFiltersModal";
import { applyProfessionalView, initialFilters, STATUS_LABEL, type ProfessionalFilters } from "./filters";
import { ProfessionalFormModal } from "./components/ProfessionalFormModal";
import { ImportProfessionalsModal } from "./components/ImportProfessionalsModal";
import { Toast } from "../../components/ui/Toast";
import type { Professional as ProfessionalData } from "./types";
import { exportProfessionalsXlsx } from "../../services/professionalsExport";
import { createProfessional, listProfessionals, updateProfessional } from "../../services/professionals";
import type { ImportResult } from "../../services/professionalsImport";

export function Professional() {
    const [professionals, setProfessionals] = useState<ProfessionalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState<ProfessionalData | null>(null);
    const [isCreatingProfessional, setIsCreatingProfessional] = useState(false);
    const [filters, setFilters] = useState<ProfessionalFilters>(initialFilters);
    const [filtersAtOpen, setFiltersAtOpen] = useState<ProfessionalFilters>(initialFilters);
    const [exporting, setExporting] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const visibleProfessionals = applyProfessionalView(professionals, filters, search);
    const hasFilters = Boolean(search.trim() || filters.formation.length || filters.status.length || filters.bond.length);
    const clearFilters = () => {
        setSearch("");
        setFilters((current) => ({ ...initialFilters, sort: current.sort }));
    };
    const chips = [
        ...(search.trim() ? [{ label: `Busca: ${search.trim()}`, remove: () => setSearch("") }] : []),
        ...filters.formation.map((value) => ({
            label: value === "Enfemeiro" ? "Enfermeiro" : value,
            remove: () => setFilters((current) => ({ ...current, formation: current.formation.filter((item) => item !== value) })),
        })),
        ...filters.status.map((value) => ({
            label: `Status: ${STATUS_LABEL[value]}`,
            remove: () => setFilters((current) => ({ ...current, status: current.status.filter((item) => item !== value) })),
        })),
        ...filters.bond.map((value) => ({
            label: `Vínculo: ${value}`,
            remove: () => setFilters((current) => ({ ...current, bond: current.bond.filter((item) => item !== value) })),
        })),
    ];

    const handleExport = async () => {
        setExporting(true);
        setError("");
        try {
            await exportProfessionalsXlsx(visibleProfessionals);
        } catch {
            setError("Não foi possível gerar a planilha.");
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleImported = (result: ImportResult) => {
        const { cadastrados, atualizados, ignorados } = result.resumo;
        setToast(`Importação concluída: ${cadastrados} cadastrado(s), ${atualizados} atualizado(s), ${ignorados} ignorado(s).`);
        // Atualiza a listagem sem recarregar a página.
        listProfessionals()
            .then((items) => {
                setProfessionals(items);
                setError("");
            })
            .catch((err: Error) => setError(err.message));
    };

    useEffect(() => {
        listProfessionals()
            .then(setProfessionals)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
                <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">Profissionais</h2>
                        {!loading && !error ? (
                            <p aria-live="polite" className="mt-2.5 text-[14px] text-text">
                                {visibleProfessionals.length}{hasFilters ? ` de ${professionals.length}` : ""} {visibleProfessionals.length === 1 ? "profissional" : "profissionais"}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsCreatingProfessional(true)}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                        <Plus className="size-4" strokeWidth={2.4} /> Cadastrar profissional
                    </button>
                </header>
                <section aria-label="Lista de profissionais" className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-(--shadow-soft) sm:p-6">
                        <div className="flex flex-wrap gap-3">
                            <div className="flex h-11 min-w-0 flex-1 basis-full items-center gap-2 rounded-xl border border-border bg-neutral px-3 sm:basis-48">
                                <Search className="size-4 shrink-0 text-text" />
                                <input
                                    type="text"
                                    aria-label="Buscar por nome, CPF ou COREN"
                                    placeholder="Buscar por nome, CPF ou COREN"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="min-w-0 w-full bg-transparent text-sm text-text placeholder:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setFiltersAtOpen(filters);
                                    setShowFilters(true);
                                }}
                                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${filters.formation.length || filters.status.length || filters.bond.length ? "border-primary bg-secondary text-primary-hover" : "border-border bg-white text-text hover:bg-neutral"}`}
                            >
                                <Filter className="size-4" />
                                Filtros
                            </button>
                            <button
                                type="button"
                                onClick={handleExport}
                                aria-label="Exportar planilha"
                                title="Exportar planilha"
                                disabled={loading || exporting || visibleProfessionals.length === 0}
                                className="inline-flex h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-text hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="size-4 shrink-0" />
                                {exporting ? "Exportando..." : "Exportar planilha"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowImport(true)}
                                aria-label="Importar planilha"
                                title="Importar planilha"
                                className="inline-flex h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-text hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                                <Upload className="size-4 shrink-0" />
                                Importar planilha
                            </button>
                        </div>
                        {hasFilters ? (
                            <div aria-label="Filtros aplicados" className="mt-4 flex flex-wrap items-center gap-2">
                                {chips.map((chip) => (
                                    <button key={chip.label} type="button" onClick={chip.remove} aria-label={`Remover filtro ${chip.label}`} className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[13px] font-semibold text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                                        <span className="break-all">{chip.label}</span><X className="size-3 shrink-0" />
                                    </button>
                                ))}
                                <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-1 text-xs font-semibold text-badge-red-text underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Limpar filtros</button>
                            </div>
                        ) : null}
                        <hr className="my-5 border-border" />
                        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                        {loading ? <p role="status" className="text-sm text-text">Carregando profissionais...</p> : null}
                        {!loading && !error && visibleProfessionals.length === 0 ? (
                            <div className="py-8 text-center text-sm text-text">
                                <p className="font-semibold">Nenhum profissional encontrado.</p>
                                {hasFilters ? <button type="button" onClick={clearFilters} className="mt-2 rounded-lg text-xs text-badge-red-text underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Limpar filtros</button> : null}
                            </div>
                        ) : null}
                        <div className="flex flex-col gap-1.5">
                            {visibleProfessionals.map((professional) => (
                                <ProfessionalCard
                                    key={professional.id}
                                    {...professional}
                                    onEdit={setEditingProfessional}
                                />
                            ))}
                        </div>
                </section>
            </div>
            {showImport ? (
                <ImportProfessionalsModal onClose={() => setShowImport(false)} onImported={handleImported} />
            ) : null}
            <Toast message={toast} />
            {showFilters ? (
                <ProfessionalFiltersModal
                    filters={filters}
                    onChange={setFilters}
                    onClose={() => {
                        setFilters(filtersAtOpen);
                        setShowFilters(false);
                    }}
                    onApply={() => setShowFilters(false)}
                />
            ) : null}
            {editingProfessional || isCreatingProfessional ? (
                <ProfessionalFormModal
                    professional={editingProfessional ?? {
                        name: "",
                        cpf: "",
                        email: "",
                        coren: "",
                        bond: "CLT",
                        status: true,
                        formation: "Enfemeiro",
                        sectorId: "",
                    }}
                    isCreating={isCreatingProfessional}
                    onClose={() => {
                        setEditingProfessional(null);
                        setIsCreatingProfessional(false);
                    }}
                    onSave={async (draft) => {
                        if (isCreatingProfessional) {
                            const created = await createProfessional(draft);
                            setProfessionals((current) => [...current, created]);
                        } else {
                            const updated = await updateProfessional(draft);
                            setProfessionals((current) => current.map((professional) =>
                                professional.id === updated.id ? updated : professional));
                        }
                        setEditingProfessional(null);
                        setIsCreatingProfessional(false);
                    }}
                />
            ) : null}
        </>
    )
}
