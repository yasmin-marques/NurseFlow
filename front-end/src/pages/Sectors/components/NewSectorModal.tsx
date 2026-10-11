import { useEffect, useState, type FormEvent } from "react";
import { Clock, X } from "../../../components/icons";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import type { SectorShift } from "./EditSectorMinimumModal";

type NewSectorModalProps = {
    onClose: () => void;
    onSave: (sector: { name: string; description: string; shifts: SectorShift[] }) => void;
};

export function NewSectorModal({ onClose, onSave }: NewSectorModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [dayNurses, setDayNurses] = useState(2);
    const [dayTechnicians, setDayTechnicians] = useState(3);
    const [nightNurses, setNightNurses] = useState(2);
    const [nightTechnicians, setNightTechnicians] = useState(3);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSave({
            name: name.trim(),
            description: description.trim(),
            shifts: [
                { id: "day", label: "Diurno", hours: "07h—19h", minimum: { nurses: dayNurses, technicians: dayTechnicians } },
                { id: "night", label: "Noturno", hours: "19h—07h", minimum: { nurses: nightNurses, technicians: nightTechnicians } },
            ],
        });
    };

    const inputClassName = "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text placeholder:text-text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="new-sector-title" className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="new-sector-title" className="text-base font-bold text-text">Novo setor</h2>
                        <p className="mt-1 text-xs text-text-muted">Cadastre o setor e seus quantitativos iniciais</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar cadastro de setor" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <label className="block text-[11px] font-semibold text-text">
                            Nome do setor <span className="text-danger">*</span>
                            <input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Setor C" className={inputClassName} />
                        </label>
                        <label className="block text-[11px] font-semibold text-text">
                            Descrição do setor
                            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Assistência clínica" className={inputClassName} />
                        </label>

                        <section className="rounded-xl bg-[#f3f5f1] px-3.5 py-3">
                            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
                                <span className="flex size-8 items-center justify-center rounded-lg bg-[#e1efd9] text-primary"><Clock className="size-4" /></span>
                                <div>
                                    <p className="text-[10px] font-bold text-text">Turno diurno</p>
                                    <p className="mt-0.5 text-[9px] text-text-muted">07h—19h</p>
                                </div>
                            </div>
                            <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-border/70 py-2">
                                <span className="text-[10px] font-semibold text-text">Enfermeiros</span>
                                <NumberStepper value={dayNurses} onChange={setDayNurses} label="enfermeiros no turno diurno" />
                            </div>
                            <div className="flex min-h-[54px] items-center justify-between gap-3 py-2">
                                <span className="text-[10px] font-semibold text-text">Técnicos</span>
                                <NumberStepper value={dayTechnicians} onChange={setDayTechnicians} label="técnicos no turno diurno" />
                            </div>
                        </section>

                        <section className="rounded-xl bg-[#f3f5f1] px-3.5 py-3">
                            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
                                <span className="flex size-8 items-center justify-center rounded-lg bg-[#e1efd9] text-primary"><Clock className="size-4" /></span>
                                <div>
                                    <p className="text-[10px] font-bold text-text">Turno noturno</p>
                                    <p className="mt-0.5 text-[9px] text-text-muted">19h—07h</p>
                                </div>
                            </div>
                            <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-border/70 py-2">
                                <span className="text-[10px] font-semibold text-text">Enfermeiros</span>
                                <NumberStepper value={nightNurses} onChange={setNightNurses} label="enfermeiros no turno noturno" />
                            </div>
                            <div className="flex min-h-[54px] items-center justify-between gap-3 py-2">
                                <span className="text-[10px] font-semibold text-text">Técnicos</span>
                                <NumberStepper value={nightTechnicians} onChange={setNightTechnicians} label="técnicos no turno noturno" />
                            </div>
                        </section>
                    </div>

                    <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                        <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Cadastrar setor</button>
                    </footer>
                </form>
            </aside>
        </div>
    );
}
