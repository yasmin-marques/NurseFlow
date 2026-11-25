import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, X } from "../../../components/icons";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import type { SectorMinimums } from "../../../services/sectors";
import {
    bodyClassName,
    closeButtonClassName,
    footerClassName,
    headerClassName,
    overlayClassName,
    panelClassName,
    primaryButtonClassName,
    secondaryButtonClassName,
} from "../styles";
import type { Sector } from "../types";

export type SectorMinimum = {
    nurses: number;
    /** Nulo em setor com subsetores: o mínimo de técnicos é definido em cada subsetor. */
    technicians: number | null;
};

type EditSectorMinimumModalProps = {
    sector: Sector;
    onClose: () => void;
    onSave: (minimums: SectorMinimums) => void | Promise<void>;
};

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text">{title}</p>
                {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
            </div>
            {children}
        </div>
    );
}

/** Edita, em uma única operação, todos os mínimos do setor: enfermeiros e técnicos (do setor ou de cada subsetor). */
export function EditSectorMinimumModal({ sector, onClose, onSave }: EditSectorMinimumModalProps) {
    const [nurses, setNurses] = useState(sector.minimum.nurses);
    const [technicians, setTechnicians] = useState(sector.minimum.technicians ?? 0);
    const activeSubsectors = sector.subsectors.filter((sub) => sub.active);
    const [subsectorMinimums, setSubsectorMinimums] = useState<Record<string, number>>(
        Object.fromEntries(activeSubsectors.map((sub) => [sub.id, sub.minimumTechnicians])),
    );
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            await onSave(sector.hasSubsectors
                ? {
                    nurses,
                    technicians: null,
                    subsectors: activeSubsectors.map((sub) => ({ id: sub.id, minimumTechnicians: subsectorMinimums[sub.id] })),
                }
                : { nurses, technicians });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível salvar.");
            setSaving(false);
        }
    };

    return (
        <div
            className={overlayClassName}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section role="dialog" aria-modal="true" aria-labelledby="minimum-modal-title" className={panelClassName}>
                <header className={headerClassName}>
                    <div>
                        <h2 id="minimum-modal-title" className="text-xl font-bold tracking-tight text-text">Editar mínimo · {sector.name}</h2>
                        <p className="mt-1 text-sm text-text-muted">Defina a quantidade mínima por plantão de 24h</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar edição de mínimo" className={closeButtonClassName}>
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
                    <div className={bodyClassName}>

                        <section aria-label="Enfermeiros" className="rounded-xl border border-border px-4">
                            <Row title="Enfermeiros" hint="Inclui o enfermeiro chefe do plantão">
                                <NumberStepper value={nurses} onChange={setNurses} min={0} label="enfermeiros" />
                            </Row>
                        </section>

                        {sector.hasSubsectors ? (
                            <section aria-label="Técnicos por subsetor" className="space-y-2">
                                <h3 className="text-sm font-bold text-text">Técnicos de enfermagem por subsetor</h3>
                                <div className="divide-y divide-border rounded-xl border border-border px-4">
                                    {activeSubsectors.map((sub) => (
                                        <Row key={sub.id} title={sub.name} hint="Mínimo simultâneo no subsetor">
                                            <NumberStepper
                                                value={subsectorMinimums[sub.id]}
                                                onChange={(value) => setSubsectorMinimums((current) => ({ ...current, [sub.id]: value }))}
                                                min={0}
                                                label={`técnicos de ${sub.name}`}
                                            />
                                        </Row>
                                    ))}
                                </div>
                                {sector.subsectors.some((sub) => !sub.active) ? (
                                    <p className="text-xs text-text-muted">Subsetores inativos não entram no dimensionamento.</p>
                                ) : null}
                            </section>
                        ) : (
                            <section aria-label="Técnicos" className="rounded-xl border border-border px-4">
                                <Row title="Técnicos de enfermagem" hint="Quantidade mínima simultânea no setor">
                                    <NumberStepper value={technicians} onChange={setTechnicians} min={0} label="técnicos de enfermagem" />
                                </Row>
                            </section>
                        )}
                    </div>

                    <footer className={footerClassName}>
                        {error ? <p role="alert" className="mr-auto self-center text-xs font-medium text-danger">{error}</p> : null}
                        <button type="button" onClick={onClose} className={secondaryButtonClassName}>Cancelar</button>
                        <button type="submit" disabled={saving} className={primaryButtonClassName}>
                            <Check className="size-4" strokeWidth={2.3} />
                            Salvar quantitativos
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
