import { useEffect, useState, type FormEvent } from "react";
import { Check, Plus, X } from "../../../components/icons";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import type { SectorForm, SubsectorDraft } from "../../../services/sectors";
import { validateSectorForm } from "../sectorForm";
import {
    bodyClassName,
    closeButtonClassName,
    compactButtonClassName,
    dangerLinkButtonClassName,
    footerClassName,
    headerClassName,
    inputClassName,
    labelClassName,
    linkButtonClassName,
    overlayClassName,
    panelClassName,
    primaryButtonClassName,
    secondaryButtonClassName,
    segmentClassName,
    segmentedClassName,
} from "../styles";
import type { NewSector, Sector } from "../types";

type NewSectorModalProps = {
    /** Presente = modo edição: carrega o setor e seus subsetores já cadastrados. */
    sector?: Sector;
    onClose: () => void;
    /** Cadastro. */
    onSave?: (sector: NewSector) => void | Promise<void>;
    /** Edição. */
    onSaveEdit?: (form: SectorForm) => void | Promise<void>;
};

const emptySubsector = (): SubsectorDraft => ({ name: "", description: "", minimumTechnicians: 1, active: true });

function QuantityRow({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex min-h-12 items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text">{title}</p>
                {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
            </div>
            {children}
        </div>
    );
}

export function NewSectorModal({ sector, onClose, onSave, onSaveEdit }: NewSectorModalProps) {
    const isEditing = Boolean(sector);
    const lockedWithSubsectors = Boolean(sector?.hasSubsectors);
    const [name, setName] = useState(sector?.name ?? "");
    const [description, setDescription] = useState(sector?.description ?? "");
    const [nurses, setNurses] = useState(sector?.minimum.nurses ?? 2);
    const [technicians, setTechnicians] = useState(sector?.minimum.technicians ?? 3);
    const [hasSubsectors, setHasSubsectors] = useState(sector?.hasSubsectors ?? false);
    const [subsectors, setSubsectors] = useState<SubsectorDraft[]>(
        (sector?.subsectors ?? []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            description: sub.description,
            minimumTechnicians: sub.minimumTechnicians,
            active: sub.active,
        })),
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const chooseSubsectors = (value: boolean) => {
        if (lockedWithSubsectors && !value) return;
        setHasSubsectors(value);
        if (value && subsectors.filter((sub) => !sub.removed).length === 0) setSubsectors((current) => [...current, emptySubsector()]);
    };

    const updateSubsector = (index: number, patch: Partial<SubsectorDraft>) =>
        setSubsectors((current) => current.map((sub, i) => (i === index ? { ...sub, ...patch } : sub)));

    const removeSubsector = (index: number) =>
        setSubsectors((current) => current[index].id
            ? current.map((sub, i) => (i === index ? { ...sub, removed: true } : sub)) // já cadastrado: será inativado ao salvar
            : current.filter((_, i) => i !== index));

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form: SectorForm = {
            name: name.trim().replace(/\s+/g, " "),
            description: description.trim(),
            nurses,
            technicians,
            hasSubsectors,
            subsectors: subsectors.map((sub) => ({ ...sub, name: sub.name.trim().replace(/\s+/g, " "), description: sub.description.trim() })),
        };
        const invalid = validateSectorForm(form);
        if (invalid) {
            setError(invalid);
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (isEditing) {
                await onSaveEdit?.(form);
            } else {
                await onSave?.({
                    name: form.name,
                    description: form.description,
                    minimum: { nurses, technicians: hasSubsectors ? null : technicians },
                    ...(hasSubsectors
                        ? { subsectors: form.subsectors.map((sub) => ({ name: sub.name, description: sub.description, minimumTechnicians: sub.minimumTechnicians })) }
                        : {}),
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível salvar o setor.");
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
            <section role="dialog" aria-modal="true" aria-labelledby="new-sector-title" className={panelClassName}>
                <header className={headerClassName}>
                    <div>
                        <h2 id="new-sector-title" className="text-xl font-bold tracking-tight text-text">{isEditing ? "Editar setor" : "Novo setor"}</h2>
                        <p className="mt-1 text-sm text-text-muted">
                            {isEditing ? "Altere os dados, o dimensionamento e os subsetores" : "Cadastre o setor e seus quantitativos mínimos"}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar cadastro de setor" className={closeButtonClassName}>
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
                    <div className={bodyClassName}>
                        <div>
                            <label className={labelClassName}>
                                Nome do setor <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
                                <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Setor C" className={inputClassName} />
                            </label>
                        </div>
                        <div>
                            <label className={labelClassName}>
                                Descrição do setor
                                <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Assistência clínica" className={inputClassName} />
                            </label>
                        </div>

                        <section aria-label="Mínimo por plantão de 24h" className="rounded-xl border border-border px-4 py-3">
                            <h3 className="text-sm font-bold text-text">Mínimo por plantão de 24h</h3>
                            <p className="text-xs text-text-muted">07h às 07h do dia seguinte</p>
                            <div className="mt-2 divide-y divide-border">
                                <QuantityRow title="Enfermeiros *">
                                    <NumberStepper value={nurses} onChange={setNurses} label="enfermeiros por plantão de 24 horas" />
                                </QuantityRow>
                                {hasSubsectors ? null : (
                                    <QuantityRow title="Técnicos *">
                                        <NumberStepper value={technicians} onChange={setTechnicians} label="técnicos por plantão de 24 horas" />
                                    </QuantityRow>
                                )}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[13px] font-semibold text-text" id="has-subsectors-label">Este setor possui subsetores?</h3>
                                <div className={segmentedClassName} role="group" aria-labelledby="has-subsectors-label">
                                    <button type="button" aria-pressed={!hasSubsectors} disabled={lockedWithSubsectors} onClick={() => chooseSubsectors(false)} className={segmentClassName(!hasSubsectors, lockedWithSubsectors)}>Não</button>
                                    <button type="button" aria-pressed={hasSubsectors} onClick={() => chooseSubsectors(true)} className={segmentClassName(hasSubsectors)}>Sim</button>
                                </div>
                            </div>
                            {lockedWithSubsectors ? (
                                <p className="mt-1.5 text-xs text-text-muted">Um setor com subsetores não volta a ser um setor sem subsetores.</p>
                            ) : null}
                            {isEditing && hasSubsectors && !lockedWithSubsectors ? (
                                <p className="mt-1.5 text-xs text-text-muted">
                                    O mínimo de técnicos passa a ser definido em cada subsetor. Técnicos já vinculados ao setor precisarão ter o subsetor definido.
                                </p>
                            ) : null}
                        </section>

                        {hasSubsectors ? (
                            <section aria-label="Subsetores" className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-bold text-text">Subsetores</h3>
                                    <button type="button" onClick={() => setSubsectors((current) => [...current, emptySubsector()])} className={compactButtonClassName}>
                                        <Plus className="size-3.5" strokeWidth={2.4} />
                                        Adicionar subsetor
                                    </button>
                                </div>
                                {subsectors.map((sub, index) => sub.removed ? (
                                    <div key={sub.id ?? index} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-text-muted">
                                        <span><b className="text-text">{sub.name}</b> será inativado ao salvar.</span>
                                        <button type="button" onClick={() => updateSubsector(index, { removed: false })} className={linkButtonClassName}>Desfazer</button>
                                    </div>
                                ) : (
                                    <div key={sub.id ?? index} className={`rounded-xl border border-border p-3.5 ${sub.active ? "bg-white" : "bg-[#f8f9f7]"}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                                                Subsetor {index + 1}
                                                {sub.active ? null : <span className="ml-2 rounded-md bg-[#eceeea] px-2 py-0.5 text-[10px]">INATIVO</span>}
                                            </p>
                                            {sub.active ? (
                                                <button type="button" onClick={() => removeSubsector(index)} aria-label={`Remover subsetor ${sub.name || index + 1}`} className={dangerLinkButtonClassName}>Remover</button>
                                            ) : (
                                                <button type="button" onClick={() => updateSubsector(index, { active: true })} aria-label={`Reativar subsetor ${sub.name}`} className={linkButtonClassName}>Reativar</button>
                                            )}
                                        </div>
                                        <label className={`${labelClassName} mt-1`}>
                                            Nome do subsetor <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
                                            <input aria-label={`Nome do subsetor ${index + 1}`} value={sub.name} onChange={(event) => updateSubsector(index, { name: event.target.value })} placeholder="Ex.: UTI Adulto" className={inputClassName} />
                                        </label>
                                        <label className={`${labelClassName} mt-3`}>
                                            Descrição do subsetor
                                            <input aria-label={`Descrição do subsetor ${index + 1}`} value={sub.description} onChange={(event) => updateSubsector(index, { description: event.target.value })} className={inputClassName} />
                                        </label>
                                        <div className="mt-2 border-t border-border pt-1">
                                            <QuantityRow title="Técnicos (mínimo) *">
                                                <NumberStepper value={sub.minimumTechnicians} onChange={(value) => updateSubsector(index, { minimumTechnicians: value })} label={`técnicos do subsetor ${index + 1}`} />
                                            </QuantityRow>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        ) : null}
                    </div>

                    <footer className={footerClassName}>
                        {error ? <p role="alert" className="mr-auto self-center text-xs font-medium text-danger">{error}</p> : null}
                        <button type="button" onClick={onClose} className={secondaryButtonClassName}>Cancelar</button>
                        <button type="submit" disabled={saving} className={primaryButtonClassName}>
                            <Check className="size-4" strokeWidth={2.3} />
                            {isEditing ? "Salvar alterações" : "Cadastrar setor"}
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
