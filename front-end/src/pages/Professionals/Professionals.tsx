import { useEffect, useState } from "react";
import { Download, Filter, Plus, Search } from "../../components/icons";
import { ProfessionalCard } from "./components/ProfesssionalCard";
import { ProfessionalFiltersModal } from "./components/ProfessionalFiltersModal";
import { applyProfessionalView, initialFilters, type ProfessionalFilters } from "./filters";
import { ProfessionalFormModal } from "./components/ProfessionalFormModal";
import type { Professional as ProfessionalData } from "./types";
import { exportProfessionalsXlsx } from "../../services/professionalsExport";
import { createProfessional, listProfessionals, updateProfessional } from "../../services/professionals";

export function Professional() {
    const [professionals, setProfessionals] = useState<ProfessionalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState<ProfessionalData | null>(null);
    const [isCreatingProfessional, setIsCreatingProfessional] = useState(false);
    const [filters, setFilters] = useState<ProfessionalFilters>(initialFilters);
    const [exporting, setExporting] = useState(false);
    const visibleProfessionals = applyProfessionalView(professionals, filters, search);

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
        listProfessionals()
            .then(setProfessionals)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <div className="flex min-h-full w-full flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
                <div className="flex justify-between items-center">
                    <header className="mb-6">
                        <h2 className="text-[28px] font-bold leading-none tracking-[-0.04em] text-text">Profissionais</h2>
                        <p className="mt-2.5 text-[14px] text-text-muted">
                            {professionals.filter((p) => p.status).length} profissionais ativos na equipe.
                        </p>
                    </header>
                    <button
                        type="button"
                        onClick={() => setIsCreatingProfessional(true)}
                        className="flex p-4 bg-primary rounded-2xl text-amber-50 font-bold text-2xl"
                    >
                        <Plus /> Cadastrar profissional
                    </button>
                </div>
                <div className="g-12 p-4 md:p-12">
                    <div className="flex flex-col g-6 w-full rounded-3xl border border-border bg-white p-4 md:p-8 shadow-(--shadow-soft) sm:p-12">
                        <div className="flex w-full gap-4">
                            <div className="flex items-center border-2 bg-card-header w-2xl border-border rounded-2xl p-2">
                                <Search
                                    className="text-text-muted h-7 w-7"
                                />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome, CPF ou COREN"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="p-3 text-text-muted w-full rounded-2xl outline-0"
                                />
                            </div>
                            <button type="button" onClick={() => setShowFilters(true)} className="flex items-center gap-1 p-2 md:px-6 py-0.5 border-2 border-border rounded-2xl">
                                <Filter
                                    className="h-7 w-7"
                                />
                                <p className="font-bold text-sx">Filtros</p>
                            </button>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={loading || exporting || visibleProfessionals.length === 0}
                                className="flex items-center gap-1 p-2 md:px-6 py-0.5 border-2 border-border rounded-2xl disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-7 w-7" />
                                <p className="font-bold text-sx">{exporting ? "Exportando..." : "Exportar Excel"}</p>
                            </button>
                        </div>
                        <hr className="my-6 text-border" />
                        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                        {loading ? <p className="text-sm text-text-muted">Carregando profissionais...</p> : null}
                        {!loading && !error && visibleProfessionals.length === 0 ? <p className="text-sm text-text-muted">Nenhum profissional encontrado.</p> : null}
                        <div className="flex flex-col gap-8">
                            {visibleProfessionals.map((professional) => (
                                <ProfessionalCard
                                    key={professional.id}
                                    {...professional}
                                    onEdit={setEditingProfessional}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {showFilters ? (
                <ProfessionalFiltersModal
                    initialFilters={filters}
                    onClose={() => setShowFilters(false)}
                    onApply={(nextFilters) => {
                        setFilters(nextFilters);
                        setShowFilters(false);
                    }}
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
