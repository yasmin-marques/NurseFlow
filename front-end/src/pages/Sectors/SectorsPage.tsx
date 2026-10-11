import { useState } from "react";
import { Building2, ChevronRight, Plus } from "../../components/icons";
import { EditSectorMinimumModal, type SectorMinimum, type SectorShift } from "./components/EditSectorMinimumModal";

type Sector = {
    name: string;
    description: string;
    shifts: SectorShift[];
};

const INITIAL_SECTORS: Sector[] = [
    {
        name: "Bloco A",
        description: "Assistência clínica",
        shifts: [
            { id: "day", label: "Diurno", hours: "07h—19h", minimum: { nurses: 2, technicians: 3 } },
            { id: "night", label: "Noturno", hours: "19h—07h", minimum: { nurses: 2, technicians: 3 } },
        ],
    },
    {
        name: "Bloco B",
        description: "Assistência clínica",
        shifts: [
            { id: "day", label: "Diurno", hours: "07h—19h", minimum: { nurses: 2, technicians: 3 } },
            { id: "night", label: "Noturno", hours: "19h—07h", minimum: { nurses: 2, technicians: 3 } },
        ],
    },
    {
        name: "Emergência",
        description: "Atendimento imediato e classificação de risco",
        shifts: [
            { id: "day", label: "Diurno", hours: "07h—19h", minimum: { nurses: 2, technicians: 3 } },
            { id: "night", label: "Noturno", hours: "19h—07h", minimum: { nurses: 2, technicians: 3 } },
        ],
    },
];

function SectorHeader({ name, description }: { name: string; description: string }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e4f1df] text-primary">
                <Building2 className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-bold text-text">{name}</span>
                <span className="mt-1 block text-xs text-text-muted">{description}</span>
            </span>
        </div>
    );
}

export function SectorsPage() {
    const [sectors, setSectors] = useState(INITIAL_SECTORS);
    const [expandedSectors, setExpandedSectors] = useState<string[]>(["Emergência"]);
    const [editingMinimum, setEditingMinimum] = useState<{ sectorName: string; shift: SectorShift } | null>(null);

    const toggleSector = (sectorName: string) => {
        setExpandedSectors((current) => current.includes(sectorName)
            ? current.filter((name) => name !== sectorName)
            : [...current, sectorName]);
    };

    const saveMinimum = (minimum: SectorMinimum) => {
        if (!editingMinimum) return;
        setSectors((current) => current.map((sector) => sector.name !== editingMinimum.sectorName
            ? sector
            : {
                ...sector,
                shifts: sector.shifts?.map((shift) => shift.id === editingMinimum.shift.id
                    ? { ...shift, minimum }
                    : shift),
            }));
        setEditingMinimum(null);
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
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(46,120,61,0.18)] transition-colors hover:bg-primary-hover sm:self-auto"
                >
                    <Plus className="size-4" strokeWidth={2.2} />
                    Novo setor
                </button>
            </header>

            <section aria-label="Lista de setores" className="space-y-3">
                {sectors.map((sector) => (
                    <article key={sector.name} className="overflow-hidden rounded-2xl border border-border bg-white shadow-(--shadow-soft)">
                        <button
                            type="button"
                            aria-expanded={expandedSectors.includes(sector.name)}
                            onClick={() => toggleSector(sector.name)}
                            className="flex min-h-[84px] w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#fbfcfa] sm:px-6"
                        >
                            <SectorHeader name={sector.name} description={sector.description} />
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text">
                                <ChevronRight className={`size-5 transition-transform ${expandedSectors.includes(sector.name) ? "rotate-90" : ""}`} strokeWidth={1.8} />
                            </span>
                        </button>

                        {expandedSectors.includes(sector.name) ? (
                            <div className="border-t border-border px-5 sm:pl-[76px] sm:pr-5">
                                {sector.shifts.map((shift) => (
                                    <div key={shift.id} className="flex min-h-[68px] items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <div>
                                            <p className="text-[9px] font-bold tracking-wide text-text-muted">{shift.label.toLocaleUpperCase("pt-BR")} · {shift.hours}</p>
                                            <p className="mt-1.5 text-xs font-semibold text-text">{shift.minimum.nurses} enfermeiros · {shift.minimum.technicians} técnicos</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditingMinimum({ sectorName: sector.name, shift })}
                                            className="shrink-0 rounded-xl border border-border px-3.5 py-2.5 text-[10px] font-semibold text-text-muted transition-colors hover:bg-card-header"
                                        >
                                            Editar mínimo
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </article>
                ))}
            </section>
            {editingMinimum ? (
                <EditSectorMinimumModal
                    sectorName={editingMinimum.sectorName}
                    shift={editingMinimum.shift}
                    onClose={() => setEditingMinimum(null)}
                    onSave={saveMinimum}
                />
            ) : null}
        </div>
    );
}
