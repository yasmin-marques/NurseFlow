import { useEffect, useState } from "react";
import { Building2, ChevronRight, Plus } from "../../components/icons";
import { EditSectorMinimumModal } from "./components/EditSectorMinimumModal";
import { NewSectorModal } from "./components/NewSectorModal";
import { createSector, listSectors, saveSectorForm, setSectorActive, updateSectorMinimum, type SectorForm, type SectorMinimums } from "../../services/sectors";
import { minimumSummary, plural } from "./sectorForm";
import {
  editCompactButtonClassName,
  dangerCompactButtonClassName,
  successCompactButtonClassName,
  compactButtonClassName,
} from "./styles";
import type { NewSector, Sector } from "./types";

function SectorHeader({ name, description, active }: { name: string; description: string; active: boolean }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f1df] text-primary">
                <Building2 className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-bold text-text">
                    {name}
                    {active ? null : <span className="ml-2 rounded-md bg-[#eceeea] px-2 py-0.5 align-middle text-[10px] font-bold text-text-muted">INATIVO</span>}
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
    const [editingMinimum, setEditingMinimum] = useState<Sector | null>(null);
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

    const replaceSector = (updated: Sector) =>
        setSectors((current) => current.map((sector) => sector.id === updated.id ? updated : sector));

    const saveMinimum = async (minimums: SectorMinimums) => {
        if (!editingMinimum) return;
        replaceSector(await updateSectorMinimum(editingMinimum.id, minimums));
        setEditingMinimum(null);
    };

    const saveEdit = async (form: SectorForm) => {
        if (!editingSector) return;
        try {
            replaceSector(await saveSectorForm(editingSector, form));
        } catch (err) {
            // Salvamento em etapas: recarrega para refletir o que já foi gravado antes da falha.
            listSectors().then(setSectors).catch(() => undefined);
            throw err;
        }
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

    const saveSector = async (sector: NewSector) => {
        const created = await createSector(sector);
        setSectors((current) => [...current, created]);
        setExpandedSectors((current) => [...current, created.id]);
        setIsNewSectorModalOpen(false);
    };

    return (
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
            <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-text">Setores</h2>
                    <p className="mt-2.5 text-[14px] text-text-muted">Defina o quantitativo mínimo por plantão de 24 horas e função.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsNewSectorModalOpen(true)}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(46,120,61,0.2)] transition-colors hover:bg-primary-hover sm:self-auto"
                >
                    <Plus className="size-4" strokeWidth={2.4} />
                    Novo setor
                </button>
            </header>

            {error ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
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
                            <div className="border-t border-border px-5 sm:pl-[76px] sm:pr-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Plantão de 24h · 07h às 07h</p>
                                        <p className="mt-1.5 text-sm font-semibold text-text">{minimumSummary(sector)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingMinimum(sector)}
                                        className={editCompactButtonClassName}
                                    >
                                        Editar mínimo
                                    </button>
                                </div>
                                {sector.hasSubsectors ? (
                                    <div className="border-b border-border py-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Subsetores</p>
                                        <ul className="mt-2 divide-y divide-border">
                                            {sector.subsectors.map((subsector) => (
                                                <li key={subsector.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${subsector.active ? "text-text" : "text-text-muted"}`}>
                                                    <span className="font-semibold">
                                                        {subsector.name}
                                                        {subsector.active ? null : <span className="ml-2 rounded-md bg-[#eceeea] px-2 py-0.5 align-middle text-[10px] font-bold">INATIVO</span>}
                                                    </span>
                                                    <span className="shrink-0">{plural(subsector.minimumTechnicians, "técnico", "técnicos")}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {sector.techniciansWithoutSubsector > 0 ? (
                                            <p role="status" className="mt-2 text-xs font-semibold text-danger">
                                                {sector.techniciansWithoutSubsector} técnico(s) deste setor ainda não têm subsetor definido.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                                <div className="flex flex-wrap justify-end gap-2 py-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingSector(sector)}
                                        className={editCompactButtonClassName}
                                        >
                                        Editar setor
                                    </button>
                                    <button
                                        type="button"
                                        disabled={togglingId === sector.id}
                                        onClick={() => toggleActive(sector)}
                                        className={sector.active ? dangerCompactButtonClassName : successCompactButtonClassName}
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
                    sector={editingMinimum}
                    onClose={() => setEditingMinimum(null)}
                    onSave={saveMinimum}
                />
            ) : null}
            {editingSector ? (
                <NewSectorModal
                    sector={editingSector}
                    onClose={() => setEditingSector(null)}
                    onSaveEdit={saveEdit}
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
