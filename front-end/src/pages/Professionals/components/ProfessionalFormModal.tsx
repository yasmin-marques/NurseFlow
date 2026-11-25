import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronRight, LockKeyhole, X } from "../../../components/icons";
import { listSectors } from "../../../services/sectors";
import type { Sector } from "../../Sectors/types";
import type { FormationType, Professional, bondType } from "../types";

type ProfessionalFormModalProps = {
    professional: Professional;
    isCreating?: boolean;
    onClose: () => void;
    onSave: (professional: Professional) => void | Promise<void>;
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
            className={`relative flex min-h-15 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${selected ? "border-primary bg-[#f1f7ef]" : "border-border bg-white hover:bg-card-header"}`}
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

const inputBaseClassName = "h-11 w-full rounded-xl border border-border bg-[#f7f8f6] px-3.5 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const inputClassName = `mt-1.5 ${inputBaseClassName}`;
const selectClassName = `${inputBaseClassName} appearance-none truncate pr-10`;

export function ProfessionalFormModal({ professional, isCreating = false, onClose, onSave }: ProfessionalFormModalProps) {
    const [form, setForm] = useState<Omit<Professional, "formation"> & { formation: FormationType | "" }>(
        () => ({ ...professional, formation: isCreating ? "" : professional.formation, subsectorId: professional.subsectorId ?? null }),
    );
    const [bondOpen, setBondOpen] = useState(false);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [sectorsError, setSectorsError] = useState("");
    const sectorsLoading = useRef(true);
    const formationChangedWhileLoading = useRef(false);
    const [fieldErrors, setFieldErrors] = useState<{ formation?: string; sectorId?: string; subsectorId?: string }>({});
    const selectedSector = sectors.find((sector) => sector.id === form.sectorId);
    const activeSubsectors = selectedSector?.subsectors.filter((subsector) => subsector.active) ?? [];

    useEffect(() => {
        let active = true;
        listSectors()
            .then((list) => {
                if (!active) return;
                sectorsLoading.current = false;
                setSectors(list);
                if (formationChangedWhileLoading.current) {
                    setForm((current) => current.sectorId && !list.some((sector) => sector.id === current.sectorId && sector.active)
                        ? { ...current, sectorId: "", subsectorId: null } : current);
                    formationChangedWhileLoading.current = false;
                }
            })
            .catch(() => {
                if (active) {
                    sectorsLoading.current = false;
                    setSectorsError("Não foi possível carregar os setores.");
                }
            });
        return () => { active = false; };
    }, []);

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

    const changeFormation = (formation: FormationType) => {
        const loading = sectorsLoading.current;
        if (form.formation !== formation && loading) formationChangedWhileLoading.current = true;
        setForm((current) => current.formation === formation ? current : {
            ...current,
            formation,
            sectorId: loading || sectors.some((sector) => sector.id === current.sectorId && sector.active) ? current.sectorId : "",
            subsectorId: null,
        });
        setFieldErrors({});
    };

    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const errors = {
            ...(!form.formation ? { formation: "Escolha o tipo de formação." } : {}),
            ...(!form.sectorId ? { sectorId: "Selecione um setor." } : {}),
            ...(form.formation === "Técnico" && form.subsectorId && selectedSector && !activeSubsectors.some((subsector) => subsector.id === form.subsectorId)
                ? { subsectorId: "Selecione um sub-setor válido ou nenhum." } : {}),
        };
        setFieldErrors(errors);
        if (!form.formation || !form.sectorId || errors.subsectorId) return;
        setSaving(true);
        setError("");
        try {
            await onSave({ ...form, formation: form.formation });
        } catch (err) {
            const message = err instanceof Error ? err.message : "Não foi possível salvar o profissional.";
            const lower = message.toLocaleLowerCase("pt-BR");
            if (lower.includes("subsetor")) setFieldErrors({ subsectorId: message });
            else if (lower.includes("setor")) setFieldErrors({ sectorId: message });
            else setError(message);
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="professional-form-title" className="flex h-full w-full max-w-115 flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="professional-form-title" className="text-base font-bold text-text">
                            {isCreating ? "Cadastrar profissional" : `Perfil de ${professional.name}`}
                        </h2>
                        <p className="mt-1 text-xs text-text-muted">Dados profissionais e disponibilidade</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar perfil" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <label className="block text-[11px] font-semibold text-text">
                            Nome: <span className="text-danger">*</span>
                            <input required value={form.name} readOnly={!isCreating} onChange={(event) => update("name", event.target.value)} className={`${inputClassName} ${!isCreating ? "cursor-not-allowed bg-neutral" : ""}`} />
                        </label>
                        <label className="block text-[11px] font-semibold text-text">
                            CPF <span className="text-danger">*</span>
                            <input required value={form.cpf} readOnly={!isCreating} onChange={(event) => update("cpf", event.target.value)} className={`${inputClassName} ${!isCreating ? "cursor-not-allowed bg-neutral" : ""}`} />
                        </label>

                        <label className="block text-[11px] font-semibold text-text">
                            E-mail: <span className="text-danger">*</span>
                            <input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className={inputClassName} />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block text-[11px] font-semibold text-text">
                                COREN <span className="text-danger">*</span>
                                <input required value={form.coren} readOnly={!isCreating} onChange={(event) => update("coren", event.target.value)} className={`${inputClassName} ${!isCreating ? "cursor-not-allowed bg-neutral" : ""}`} />
                            </label>
                            <div className="block text-[11px] font-semibold text-text">
                                <span>Tipo de vínculo <span className="text-danger">*</span></span>
                                <span className="relative block">
                                    <button
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded={bondOpen}
                                        onClick={() => setBondOpen((open) => !open)}
                                        className={`${inputClassName} flex items-center justify-between gap-3 text-left`}
                                    >
                                        <span className="truncate">{form.bond}</span>
                                        <ChevronRight className={`pointer-events-none size-4 shrink-0 transition-transform ${bondOpen ? "rotate-90" : ""}`} aria-hidden="true" />
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

                        <section aria-describedby={fieldErrors.formation ? "formation-error" : undefined}>
                            <h3 className="text-[11px] font-semibold text-text">Tipo de formação <span className="text-danger">*</span></h3>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5">
                                <ChoiceCard title="Enfermeiro" description="Graduação em enfermagem" selected={form.formation === "Enfemeiro"} onClick={() => changeFormation("Enfemeiro")} />
                                <ChoiceCard title="Técnico" description="Formação em nível técnico" selected={form.formation === "Técnico"} onClick={() => changeFormation("Técnico")} />
                            </div>
                            {fieldErrors.formation ? <p id="formation-error" role="alert" className="mt-1 text-[10px] text-danger">{fieldErrors.formation}</p> : null}
                        </section>

                        <label className="block text-[11px] font-semibold text-text">
                            Setor fixo <span className="text-danger">*</span>
                            <span className="relative mt-1.5 block">
                                <select
                                    value={form.sectorId ?? ""}
                                    disabled={!form.formation}
                                    aria-invalid={Boolean(fieldErrors.sectorId)}
                                    aria-describedby="sector-hint"
                                    onChange={(event) => {
                                        setForm((current) => ({ ...current, sectorId: event.target.value, subsectorId: null }));
                                        setFieldErrors((current) => ({ ...current, sectorId: undefined, subsectorId: undefined }));
                                    }}
                                    className={selectClassName}
                                >
                                    <option value="" disabled>Selecione um setor</option>
                                    {sectors
                                        .filter((sector) => sector.active || sector.id === form.sectorId)
                                        .map((sector) => (
                                            <option key={sector.id} value={sector.id} disabled={!sector.active}>
                                                {sector.name}{sector.active ? "" : " (inativo)"}
                                            </option>
                                        ))}
                                    {form.sectorId && !sectors.some((sector) => sector.id === form.sectorId) ? (
                                        <option value={form.sectorId}>{form.sectorName ?? "Setor atual"}</option>
                                    ) : null}
                                </select>
                                <ChevronRight aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 rotate-90 text-text" />
                            </span>
                            <span id="sector-hint" className={`mt-1 block text-[10px] font-normal leading-tight ${fieldErrors.sectorId ? "text-danger" : "text-text-muted"}`}>
                                {fieldErrors.sectorId || (!form.formation ? "Escolha o tipo de formação primeiro" : "O profissional só pode ser escalado neste setor.")}
                            </span>
                            {sectorsError ? <span role="alert" className="mt-1 block text-[10px] font-normal text-danger">{sectorsError}</span> : null}
                        </label>

                        {form.formation === "Técnico" ? (
                            <label className="block text-[11px] font-semibold text-text">
                                Sub-setor (opcional)
                                <span className="relative mt-1.5 block">
                                    <select
                                        value={form.subsectorId ?? ""}
                                        disabled={!form.sectorId || !selectedSector || (activeSubsectors.length === 0 && !form.subsectorId)}
                                        aria-invalid={Boolean(fieldErrors.subsectorId)}
                                        onChange={(event) => {
                                            update("subsectorId", event.target.value || null);
                                            setFieldErrors((current) => ({ ...current, subsectorId: undefined }));
                                        }}
                                        className={selectClassName}
                                        aria-describedby="subsector-hint"
                                    >
                                        <option value="">Nenhum sub-setor</option>
                                        {activeSubsectors.map((subsector) => (
                                            <option key={subsector.id} value={subsector.id}>{subsector.name}</option>
                                        ))}
                                        {form.subsectorId && !activeSubsectors.some((subsector) => subsector.id === form.subsectorId) ? (
                                            <option value={form.subsectorId} disabled>{form.subsectorName ?? "Sub-setor atual"} (indisponível)</option>
                                        ) : null}
                                    </select>
                                    <ChevronRight aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 rotate-90 text-text" />
                                </span>
                                <span id="subsector-hint" className={`mt-1 block text-[10px] font-normal leading-tight ${fieldErrors.subsectorId ? "text-danger" : "text-text-muted"}`}>
                                    {fieldErrors.subsectorId || (!form.sectorId ? "Escolha um setor primeiro." : selectedSector && activeSubsectors.length === 0 ? (selectedSector.subsectors.length ? "Este setor não tem sub-setores ativos." : "Este setor não tem sub-setores") : "")}
                                </span>
                            </label>
                        ) : null}

                        <section>
                            <h3 className="text-[11px] font-semibold text-text">Status do profissional <span className="text-danger">*</span></h3>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3f5f1] p-1.5">
                                <ChoiceCard title="Desativado" description="Não participa de novas escalas" selected={!form.status} onClick={() => update("status", false)} />
                                <ChoiceCard title="Ativo" description="Disponível para participar das escalas" selected={form.status} onClick={() => update("status", true)} />
                            </div>
                        </section>

                        <div className="flex items-center gap-2 rounded-xl bg-[#f3f5f1] px-3 py-3 text-[10px] leading-relaxed text-text-muted">
                            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                            <span>Férias, afastamentos e indisponibilidades são definidos em Restrições. Neste cadastro, a Coordenação controla apenas a ativação do profissional.</span>
                        </div>
                    </div>

                    <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    {error ? <p role="alert" className="mr-auto self-center text-[11px] font-semibold text-danger">{error}</p> : null}
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                        <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Salvar</button>
                    </footer>
                </form>
            </aside>
        </div>
    );
}
