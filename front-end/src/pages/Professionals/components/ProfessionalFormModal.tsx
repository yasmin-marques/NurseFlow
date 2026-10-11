import { useEffect, useState, type FormEvent } from "react";
import { Check, ChevronRight, LockKeyhole, X } from "../../../components/icons";
import type { FormationType, Professional, bondType } from "../types";

type ProfessionalFormModalProps = {
    professional: Professional;
    onClose: () => void;
    onSave: (professional: Professional) => void;
};

function ChoiceCard({
    title,
    description,
    selected,
    onClick,
}: {
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`relative flex min-h-[60px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${selected ? "border-primary bg-[#f1f7ef]" : "border-border bg-white hover:bg-card-header"}`}
        >
            <span className={`size-2 shrink-0 rounded-full ${selected ? "bg-primary" : "bg-[#a4ada2]"}`} />
            <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-text">{title}</span>
                <span className="mt-0.5 block text-[9px] leading-tight text-text-muted">{description}</span>
            </span>
            {selected ? <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} /> : null}
        </button>
    );
}

const inputClassName = "mt-1.5 h-11 w-full rounded-xl border border-border bg-[#f7f8f6] px-3.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function ProfessionalFormModal({ professional, onClose, onSave }: ProfessionalFormModalProps) {
    const [form, setForm] = useState(professional);
    const [bondOpen, setBondOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const update = <K extends keyof Professional>(key: K, value: Professional[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSave(form);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="professional-form-title" className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="professional-form-title" className="text-base font-bold text-text">Perfil de {professional.name}</h2>
                        <p className="mt-1 text-xs text-text-muted">Dados profissionais e disponibilidade</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar perfil" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <label className="block text-[11px] font-semibold text-text">
                            Nome completo <span className="text-danger">*</span>
                            <input required value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClassName} />
                        </label>
                        <label className="block text-[11px] font-semibold text-text">
                            CPF <span className="text-danger">*</span>
                            <input required value={form.cpf} onChange={(event) => update("cpf", event.target.value)} className={inputClassName} />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block text-[11px] font-semibold text-text">
                                COREN <span className="text-danger">*</span>
                                <input required value={form.coren} onChange={(event) => update("coren", event.target.value)} className={inputClassName} />
                            </label>
                            <div className="block text-[11px] font-semibold text-text">
                                <span>Tipo de vínculo <span className="text-danger">*</span></span>
                                <span className="relative block">
                                    <button
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded={bondOpen}
                                        onClick={() => setBondOpen((open) => !open)}
                                        className={`${inputClassName} flex items-center justify-between text-left`}
                                    >
                                        {form.bond}
                                        <ChevronRight className={`size-4 transition-transform ${bondOpen ? "rotate-90" : ""}`} />
                                    </button>
                                    {bondOpen ? (
                                        <span role="listbox" aria-label="Tipo de vínculo" className="absolute inset-x-0 top-full z-10 mt-1 block overflow-hidden rounded-xl border border-border bg-white p-1 shadow-lg">
                                            {(["Concursado", "CLT", "RPA"] as bondType[]).map((bond) => (
                                                <button
                                                    key={bond}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={form.bond === bond}
                                                    onClick={() => {
                                                        update("bond", bond);
                                                        setBondOpen(false);
                                                    }}
                                                    className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-card-header ${form.bond === bond ? "bg-[#f1f7ef] text-primary" : "text-text"}`}
                                                >
                                                    {bond}
                                                </button>
                                            ))}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        </div>

                        <section>
                            <h3 className="text-[11px] font-semibold text-text">Status do profissional <span className="text-danger">*</span></h3>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5">
                                <ChoiceCard title="Desativado" description="Não participa de novas escalas" selected={!form.status} onClick={() => update("status", false)} />
                                <ChoiceCard title="Ativo" description="Disponível para participar das escalas" selected={form.status} onClick={() => update("status", true)} />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-[11px] font-semibold text-text">Tipo de formação <span className="text-danger">*</span></h3>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5">
                                <ChoiceCard title="Enfermeiro" description="Graduação em enfermagem" selected={form.formation === "Enfemeiro"} onClick={() => update("formation", "Enfemeiro" as FormationType)} />
                                <ChoiceCard title="Técnico" description="Formação em nível técnico" selected={form.formation === "Técnico"} onClick={() => update("formation", "Técnico")} />
                            </div>
                        </section>

                        <div className="flex items-center gap-2 rounded-xl bg-[#f3f5f1] px-3 py-3 text-[10px] leading-relaxed text-text-muted">
                            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                            <span>Férias, afastamentos e indisponibilidades são definidos em Restrições. Neste cadastro, a Coordenação controla apenas a ativação do profissional.</span>
                        </div>
                    </div>

                    <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                        <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Salvar</button>
                    </footer>
                </form>
            </aside>
        </div>
    );
}
