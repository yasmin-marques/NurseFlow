import { ChevronRight } from "../../../components/icons";
import type { Professional } from "../types";

export function ProfessionalCard({
    onEdit,
    ...professional
}: Professional & { onEdit: (professional: Professional) => void }) {
    const nameParts = professional.name.trim().split(/\s+/);
    const initials = nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
        : nameParts[0]?.[0] ?? "";

    return (
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex gap-4 items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {initials.toUpperCase()}
                </div>
                <div>
                    <h3 className="font-bold text-base">{professional.name}</h3>
                    <p className="text-sm text-text-muted">{professional.formation}</p>
                </div>
            </div>
            <div className="bg-border flex w-fit items-center justify-center rounded-2xl p-2 text-sm text-text-muted sm:justify-self-center">
                {professional.bond}
            </div>
            <div className="sm:justify-self-center">
                {professional.status ? (
                    <div className="flex gap-2 items-center">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                        <p className="font-bold text-primary">Ativo</p>
                    </div>
                ) : (
                    <div className="flex gap-2 items-center">
                        <div className="w-3 h-3 bg-text-muted rounded-full"></div>
                        <p className="font-bold text-text-muted">Inativo</p>
                    </div>
                )}
            </div>
            <button
                type="button"
                aria-label={`Editar profissional ${professional.name}`}
                onClick={() => onEdit(professional)}
                className="rounded-lg p-2 text-text-muted hover:bg-card-header hover:text-primary sm:justify-self-end"
            >
                <ChevronRight />
            </button>
        </div>
    )
} 
