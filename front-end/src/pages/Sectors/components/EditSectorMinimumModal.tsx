import { useEffect, useState } from "react";
import { Check, Clock, Users, X } from "../../../components/icons";
import { NumberStepper } from "../../../components/ui/NumberStepper";

export type SectorMinimum = {
    nurses: number;
    technicians: number;
};

export type SectorShift = {
    id: "day" | "night";
    label: string;
    hours: string;
    minimum: SectorMinimum;
};

type EditSectorMinimumModalProps = {
    sectorName: string;
    shift: SectorShift;
    onClose: () => void;
    onSave: (minimum: SectorMinimum) => void | Promise<void>;
};

export function EditSectorMinimumModal({ sectorName, shift, onClose, onSave }: EditSectorMinimumModalProps) {
    const [nurses, setNurses] = useState(shift.minimum.nurses);
    const [technicians, setTechnicians] = useState(shift.minimum.technicians);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            await onSave({ nurses, technicians });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível salvar.");
            setSaving(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="minimum-modal-title" className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="minimum-modal-title" className="text-base font-bold text-text">
                            Editar mínimo {shift.label.toLocaleLowerCase("pt-BR")} · {sectorName}
                        </h2>
                        <p className="mt-1 text-xs text-text-muted">Defina a quantidade obrigatória por função e turno</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar edição de mínimo" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <div className="flex-1 space-y-4 px-6 py-6">
                    <div className="flex items-center gap-3 rounded-xl bg-[#f0f5ec] px-3.5 py-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e1efd9] text-primary">
                            <Clock className="size-5" />
                        </span>
                        <div>
                            <p className="text-[11px] font-bold text-text">Turno {shift.label.toLocaleLowerCase("pt-BR")} · {shift.hours}</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-text-muted">O sistema usará estes números para gerar a escala e identificar cobertura insuficiente.</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border">
                        <div className="flex min-h-[70px] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e4f1df] text-primary">
                                <Users className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-text">Enfermeiros</p>
                                <p className="mt-1 text-[10px] text-text-muted">Inclui o enfermeiro chefe do plantão</p>
                            </div>
                            <NumberStepper value={nurses} onChange={setNurses} min={0} label="enfermeiros" />
                        </div>
                        <div className="flex min-h-[70px] items-center gap-3 px-3 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e4f1df] text-primary">
                                <Users className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-text">Técnicos de enfermagem</p>
                                <p className="mt-1 text-[10px] text-text-muted">Quantidade mínima simultânea no setor</p>
                            </div>
                            <NumberStepper value={technicians} onChange={setTechnicians} min={0} label="técnicos de enfermagem" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-[#e5f2dc] px-3 py-3 text-[10px] leading-relaxed text-[#356c39]">
                        <Check className="size-4 shrink-0" strokeWidth={2.4} />
                        Escalas abaixo de {nurses} enfermeiros ou {technicians} técnicos neste turno serão sinalizadas como irregulares.
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    {error ? <p role="alert" className="mr-auto self-center text-[11px] font-semibold text-danger">{error}</p> : null}
                    <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                    <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Salvar quantitativo</button>
                </footer>
            </aside>
        </div>
    );
}
