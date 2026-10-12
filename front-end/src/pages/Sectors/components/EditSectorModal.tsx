import { useEffect, useState, type FormEvent } from "react";
import { X } from "../../../components/icons";

type EditSectorModalProps = {
    sector: { name: string; description: string };
    onClose: () => void;
    onSave: (details: { name: string; description: string }) => void | Promise<void>;
};

export function EditSectorModal({ sector, onClose, onSave }: EditSectorModalProps) {
    const [name, setName] = useState(sector.name);
    const [description, setDescription] = useState(sector.description);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            await onSave({ name: name.trim(), description: description.trim() });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível salvar o setor.");
            setSaving(false);
        }
    };

    const inputClassName = "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text placeholder:text-text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside role="dialog" aria-modal="true" aria-labelledby="edit-sector-title" className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div>
                        <h2 id="edit-sector-title" className="text-base font-bold text-text">Editar setor</h2>
                        <p className="mt-1 text-xs text-text-muted">Altere o nome e a descrição do setor</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar edição de setor" className="rounded-xl border border-border p-2 text-text-muted hover:bg-card-header">
                        <X className="size-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <label className="block text-[11px] font-semibold text-text">
                            Nome do setor <span className="text-danger">*</span>
                            <input required autoFocus value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} />
                        </label>
                        <label className="block text-[11px] font-semibold text-text">
                            Descrição do setor
                            <input value={description} onChange={(event) => setDescription(event.target.value)} className={inputClassName} />
                        </label>
                    </div>

                    <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
                        {error ? <p role="alert" className="mr-auto self-center text-[11px] font-semibold text-danger">{error}</p> : null}
                        <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-card-header">Cancelar</button>
                        <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-95">Salvar alterações</button>
                    </footer>
                </form>
            </aside>
        </div>
    );
}
