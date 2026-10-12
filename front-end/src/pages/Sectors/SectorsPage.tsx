import { useEffect, useState } from "react";
import { Building2, ChevronRight, Plus } from "../../components/icons";
import { EditSectorMinimumModal, type SectorMinimum, type SectorShift } from "./components/EditSectorMinimumModal";
import { NewSectorModal } from "./components/NewSectorModal";
import { EditSectorModal } from "./components/EditSectorModal";
import { createSector, listSectors, setSectorActive, updateSectorDetails, updateSectorMinimum } from "../../services/sectors";
import type { Sector } from "./types";

function SectorHeader({ name, description, active }: { name: string; description: string; active: boolean }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f1df] text-primary">
                <Building2 className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-bold text-text">
                    {name}
                    {active ? null : <span className="ml-2 rounded-md bg-[#eceeea] px-2 py-0.5 align-middle text-[9px] font-bold text-text-muted">INATIVO</span>}
                </span>
                <span className="mt-1 block text-xs text-text-muted">{description}</span>
            </span>
        </div>
    );
}

export function SectorsPage() {
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedSectors, setExpandedSectors] = useState<string[]>([]);
    const [editingMinimum, setEditingMinimum] = useState<{ sector: Sector; shift: SectorShift } | null>(null);
    const [isNewSectorModalOpen, setIsNewSectorModalOpen] = useState(false);
    const [editingSector, setEditingSector] = useState<Sector | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        listSectors()
            .then(setSectors)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const toggleSector = (sectorId: string) => {
        setExpandedSectors((current) => current.includes(sectorId)
            ? current.filter((id) => id !== sectorId)
            : [...current, sectorId]);
    };

    const saveMinimum = async (minimum: SectorMinimum) => {
        if (!editingMinimum) return;
        const updated = await updateSectorMinimum(editingMinimum.sector.id, editingMinimum.shift.id, minimum);
        setSectors((current) => current.map((sector) => sector.id === updated.id ? updated : sector));
        setEditingMinimum(null);
    };

    const replaceSector = (updated: Sector) =>
        setSectors((current) => current.map((sector) => sector.id === updated.id ? updated : sector));

    const saveDetails = async (details: { name: string; description: string }) => {
        if (!editingSector) return;
        replaceSector(await updateSectorDetails(editingSector.id, details));
        setEditingSector(null);
    };

    const toggleActive = async (sector: Sector) => {
        setTogglingId(sector.id);
        setError("");
        try {
            replaceSector(await setSectorActive(sector.id, !sector.active));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível alterar o status do setor.");
        } finally {
            setTogglingId(null);
        }
    };

    const saveSector = async (sector: Omit<Sector, "id" | "active">) => {
        const created = await createSector(sector);
        setSectors((current) => [...current, created]);
        setExpandedSectors((current) => [...current, created.id]);
        setIsNewSectorModalOpen(false);
    };

    return (
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-8 sm:px-7 lg:px-9 xl:px-10">
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">Setores</h2>
                    <p className="mt-2 text-sm text-text-muted">Defina equipes e quantitativos mínimos por turno e função.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsNewSectorModalOpen(true)}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,120,61,0.18)] transition-colors hover:bg-primary-hover sm:self-auto"
                >
                    <Plus className="size-4" strokeWidth={2.2} />
                    Novo setor
                </button>
            </header>

            {error ? <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger">{error}</p> : null}
            {loading ? <p className="text-sm text-text-muted">Carregando setores...</p> : null}
            {!loading && sectors.length === 0 && !error ? <p className="text-sm text-text-muted">Nenhum setor cadastrado.</p> : null}

            <section aria-label="Lista de setores" className="space-y-3">
                {sectors.map((sector) => (
                    <article key={sector.id} className={`overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft) ${sector.active ? "" : "opacity-75"}`}>
                        <button
                            type="button"
                            aria-expanded={expandedSectors.includes(sector.id)}
                            onClick={() => toggleSector(sector.id)}
                            className="flex min-h-[84px] w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#fbfcfa] sm:px-6"
                        >
                            <SectorHeader name={sector.name} description={sector.description} active={sector.active} />
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text">
                                <ChevronRight className={`size-5 transition-transform ${expandedSectors.includes(sector.id) ? "rotate-90" : ""}`} strokeWidth={1.8} />
                            </span>
                        </button>

                        {expandedSectors.includes(sector.id) ? (
                            <div className="border-t border-border px-5 sm:pl-[76px] sm:pr-5">
                                {sector.shifts.map((shift) => (
                                    <div key={shift.id} className="flex min-h-[68px] items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <div>
                                            <p className="text-[9px] font-bold tracking-wide text-text-muted">{shift.label.toLocaleUpperCase("pt-BR")} · {shift.hours}</p>
                                            <p className="mt-1.5 text-xs font-semibold text-text">{shift.minimum.nurses} enfermeiros · {shift.minimum.technicians} técnicos</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditingMinimum({ sector, shift })}
                                            className="shrink-0 rounded-xl border border-border px-3.5 py-2.5 text-[10px] font-semibold text-text-muted transition-colors hover:bg-card-header"
                                        >
                                            Editar mínimo
                                        </button>
                                    </div>
                                ))}
                                <div className="flex flex-wrap justify-end gap-2 py-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingSector(sector)}
                                        className="rounded-xl border border-border px-3.5 py-2.5 text-[10px] font-semibold text-text-muted transition-colors hover:bg-card-header"
                                    >
                                        Editar setor
                                    </button>
                                    <button
                                        type="button"
                                        disabled={togglingId === sector.id}
                                        onClick={() => toggleActive(sector)}
                                        className={`rounded-xl border px-3.5 py-2.5 text-[10px] font-semibold transition-colors hover:bg-card-header ${sector.active ? "border-danger/30 text-danger" : "border-primary/30 text-primary"}`}
                                    >
                                        {sector.active ? "Desativar setor" : "Reativar setor"}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </article>
                ))}
            </section>
            {editingMinimum ? (
                <EditSectorMinimumModal
                    sectorName={editingMinimum.sector.name}
                    shift={editingMinimum.shift}
                    onClose={() => setEditingMinimum(null)}
                    onSave={saveMinimum}
                />
            ) : null}
            {editingSector ? (
                <EditSectorModal
                    sector={editingSector}
                    onClose={() => setEditingSector(null)}
                    onSave={saveDetails}
                />
            ) : null}
            {isNewSectorModalOpen ? (
                <NewSectorModal
                    onClose={() => setIsNewSectorModalOpen(false)}
                    onSave={saveSector}
                />
            ) : null}
        </div>
    );
}
