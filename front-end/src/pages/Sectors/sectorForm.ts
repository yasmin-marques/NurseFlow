import type { SectorForm } from "../../services/sectors";
import type { Sector } from "./types";

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Regras do formulário (também usadas nos testes). Devolve a primeira mensagem de erro ou "". */
export function validateSectorForm(form: SectorForm): string {
    if (form.name.trim().length < 2) return "Informe o nome do setor (mínimo de 2 caracteres).";
    const integers = [form.nurses, ...(form.hasSubsectors ? form.subsectors.filter((s) => !s.removed).map((s) => s.minimumTechnicians) : [form.technicians])];
    if (integers.some((value) => !Number.isInteger(value) || value < 0)) return "As quantidades mínimas devem ser números inteiros não negativos.";
    if (!form.hasSubsectors) return "";
    const live = form.subsectors.filter((s) => !s.removed);
    if (live.length === 0) return "Um setor com subsetores deve ter pelo menos um subsetor.";
    if (live.some((s) => s.name.trim().length < 2)) return "Informe o nome de cada subsetor (mínimo de 2 caracteres).";
    const names = live.map((s) => normalize(s.name));
    if (new Set(names).size !== names.length) return "Não é permitido repetir o nome de subsetores no mesmo setor.";
    return "";
}

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Resumo do mínimo por plantão, considerando os valores persistidos do setor. */
export function minimumSummary(sector: Sector) {
    const nurses = plural(
        sector.minimum.nurses,
        "enfermeiro",
        "enfermeiros"
    );

    if (sector.hasSubsectors) {
        return `${nurses} · técnicos distribuídos por subsetor`;
    }

    return `${nurses} · ${plural(
        sector.minimum.technicians ?? 0,
        "técnico",
        "técnicos"
    )}`;
}