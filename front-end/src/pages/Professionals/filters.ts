import type { FormationType, Professional, ProfessionalStatus, bondType } from "./types";

export type ProfessionalFilters = {
    formation: FormationType[];
    status: ProfessionalStatus[];
    bond: bondType[];
    sort: "asc" | "desc";
};

export const initialFilters: ProfessionalFilters = {
    formation: [],
    status: [],
    bond: [],
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
        .filter((professional) => filters.formation.length === 0 || filters.formation.includes(professional.formation))
        .filter((professional) => filters.status.length === 0 || filters.status.includes(statusOf(professional)))
        .filter((professional) => filters.bond.length === 0 || filters.bond.includes(professional.bond))
        .filter((p) =>
            !term
            || p.name.toLowerCase().includes(term)
            || p.coren.toLowerCase().includes(term)
            || (digits !== "" && p.cpf.replace(/\D/g, "").includes(digits)))
        .sort((a, b) => filters.sort === "asc"
            ? a.name.localeCompare(b.name, "pt-BR")
            : b.name.localeCompare(a.name, "pt-BR"));
}
