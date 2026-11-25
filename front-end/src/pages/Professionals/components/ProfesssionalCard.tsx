import { ChevronRight } from "../../../components/icons";
import { ProfessionalAvatar } from "../../../components/ui/ProfessionalAvatar";
import { ProfessionalStatusIndicator } from "../../../components/ui/ProfessionalStatusIndicator";
import type { Professional } from "../types";

function BondBadge({ bond }: { bond: Professional["bond"] }) {
    return (
        <div className="box-border inline-flex h-7 min-w-24 w-fit items-center justify-center rounded-md bg-neutral px-3 text-xs font-semibold text-gray-600 sm:justify-self-center">
            {bond}
        </div>
    );
}

export function ProfessionalCard({
    onEdit,
    ...professional
}: Professional & { onEdit: (professional: Professional) => void }) {
    const nameParts = professional.name.trim().split(/\s+/);
    const initials = nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
        : nameParts[0]?.[0] ?? "";

    return (
        <div className="relative box-border grid min-w-0 grid-cols-1 items-center gap-3 rounded-xl bg-white px-4.25 py-3.5 transition-colors duration-150 hover:bg-neutral has-focus-visible:bg-neutral motion-reduce:transition-none sm:grid-cols-2 sm:px-6.25 xl:grid-cols-4">
            <button
                type="button"
                aria-label={`Abrir perfil de ${professional.name}`}
                onClick={() => onEdit(professional)}
                className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <div className="flex min-w-0 items-center gap-3">
                <ProfessionalAvatar initials={initials.toUpperCase()} />
                <div className="min-w-0">
                    <h3 className="wrap-break-word text-sm font-semibold text-text">{professional.name}</h3>
                    <p className="text-xs text-text">{professional.formation === "Enfemeiro" ? "Enfermeiro" : professional.formation}</p>
                </div>
            </div>
            <BondBadge bond={professional.bond} />
            <div className="sm:justify-self-center">
                <ProfessionalStatusIndicator active={professional.status} label={professional.status ? "Ativo" : "Inativo"} />
            </div>
            <button
                type="button"
                aria-label={`Editar profissional ${professional.name}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onEdit(professional);
                }}
                className="relative w-fit rounded-lg p-2 text-text hover:bg-card-header hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:justify-self-end"
            >
                <ChevronRight />
            </button>
        </div>
    )
} 
