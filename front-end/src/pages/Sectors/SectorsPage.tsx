import { Building2, ChevronRight, Plus } from "../../components/icons";

const sectors = [
    { name: "Bloco A", description: "Assistência clínica" },
    { name: "Bloco B", description: "Assistência clínica" },
    { name: "Emergência", description: "Atendimento imediato e classificação de risco", expanded: true },
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
                        <div className="flex min-h-[84px] items-center gap-4 px-5 py-4 sm:px-6">
                            <SectorHeader name={sector.name} description={sector.description} />
                            <button
                                type="button"
                                aria-label={`Abrir setor ${sector.name}`}
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text transition-colors hover:bg-card-header"
                            >
                                <ChevronRight className="size-5" strokeWidth={1.8} />
                            </button>
                        </div>

                        {sector.expanded ? (
                            <div className="border-t border-border px-5 sm:pl-[76px] sm:pr-5">
                                {["DIURNO · 07h—19h", "NOTURNO · 19h—07h"].map((shift) => (
                                    <div key={shift} className="flex min-h-[68px] items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                                        <div>
                                            <p className="text-[9px] font-bold tracking-wide text-text-muted">{shift}</p>
                                            <p className="mt-1.5 text-xs font-semibold text-text">2 enfermeiros · 3 técnicos</p>
                                        </div>
                                        <button
                                            type="button"
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
        </div>
    );
}
