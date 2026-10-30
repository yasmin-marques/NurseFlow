import type { FormationType, Professional, ProfessionalStatus, bondType } from "./types";

export type ProfessionalFilters = {
    formation: FormationType | "all";
    status: ProfessionalStatus | "all";
    bond: bondType | "all";
    sort: "asc" | "desc";
};

export const initialFilters: ProfessionalFilters = {
    formation: "all",
    status: "all",
    bond: "all",
    sort: "asc",
};

export const STATUS_LABEL: Record<ProfessionalStatus, string> = {
    ativo: "Ativo",
    desativado: "Desativado",
    afastado: "Afastado",
    ferias: "Férias",
};

export const statusOf = (professional: Professional): ProfessionalStatus =>
    professional.apiStatus ?? (professional.status ? "ativo" : "desativado");

/** Aplica filtros, ordenação e busca (nome, COREN ou CPF). Usada pela listagem e pela exportação. */
export function applyProfessionalView(professionals: Professional[], filters: ProfessionalFilters, search: string) {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return professionals
        .filter((professional) => filters.formation === "all" || professional.formation === filters.formation)
        .filter((professional) => filters.status === "all" || statusOf(professional) === filters.status)
        .filter((professional) => filters.bond === "all" || professional.bond === filters.bond)
        .filter((p) =>
            !term
            || p.name.toLowerCase().includes(term)
            || p.coren.toLowerCase().includes(term)
            || (digits !== "" && p.cpf.replace(/\D/g, "").includes(digits)))
        .sort((a, b) => filters.sort === "asc"
            ? a.name.localeCompare(b.name, "pt-BR")
            : b.name.localeCompare(a.name, "pt-BR"));
}
