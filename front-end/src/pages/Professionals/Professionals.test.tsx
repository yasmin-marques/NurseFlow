// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProfessionals } from "../../services/professionals";
import { exportProfessionalsXlsx } from "../../services/professionalsExport";
import { fetchAllRestrictions } from "../../services/restriction";
import { DisponibilityPage } from "../Disponibility/DisponibilityPage";
import { ProfessionalCard } from "./components/ProfesssionalCard";
import { Professional } from "./Professionals";
import type { Professional as ProfessionalData } from "./types";

vi.mock("../../services/professionals", () => ({
    listProfessionals: vi.fn(),
    createProfessional: vi.fn(),
    updateProfessional: vi.fn(),
}));
vi.mock("../../services/professionalsExport", () => ({ exportProfessionalsXlsx: vi.fn() }));
vi.mock("../../services/restriction", () => ({
    fetchAllRestrictions: vi.fn(),
    createRestriction: vi.fn(),
    updateRestriction: vi.fn(),
    deleteRestriction: vi.fn(),
}));
vi.mock("./components/ProfessionalFormModal", () => ({
    ProfessionalFormModal: ({ professional }: { professional: ProfessionalData }) => <div role="dialog">Perfil de {professional.name}</div>,
}));

const professionals: ProfessionalData[] = [
    { id: "1", name: "Ana Lima", cpf: "111", email: "", coren: "123", formation: "Enfemeiro", bond: "CLT", status: true, apiStatus: "ativo" },
    { id: "2", name: "Bia Silva", cpf: "222", email: "", coren: "456", formation: "Enfemeiro", bond: "RPA", status: true, apiStatus: "ativo" },
    { id: "3", name: "Caio Costa", cpf: "333", email: "", coren: "789", formation: "Técnico", bond: "CLT", status: false, apiStatus: "ferias" },
    { id: "4", name: "Davi Souza", cpf: "444", email: "", coren: "987", formation: "Técnico", bond: "Concursado", status: true, apiStatus: "ativo" },
];

beforeEach(() => vi.mocked(listProfessionals).mockResolvedValue(professionals));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Profissionais", () => {
    it("combina filtros múltiplos e busca, atualiza a contagem e remove chips", async () => {
        render(<Professional />);
        expect(await screen.findByText("4 profissionais")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        const dialog = screen.getByRole("dialog");
        const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
        const apply = within(dialog).getByRole("button", { name: "Aplicar filtros" });
        expect(cancel.parentElement).toBe(apply.parentElement);
        expect(cancel.nextElementSibling).toBe(apply);
        expect(cancel.parentElement?.className).toContain("gap-2");
        expect(within(dialog).queryByRole("button", { name: "Remover filtros" })).toBeNull();
        fireEvent.click(within(dialog).getByRole("button", { name: "Enfermeiro" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Ativo" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "CLT" }));
        expect(screen.getByText("1 de 4 profissional")).toBeTruthy();
        fireEvent.click(within(dialog).getByRole("button", { name: "RPA" }));
        expect(screen.getByText("2 de 4 profissionais")).toBeTruthy();
        fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar filtros" }));
        expect(screen.getByRole("button", { name: "Remover filtro Vínculo: RPA" })).toBeTruthy();
        expect(within(screen.getByLabelText("Filtros aplicados")).getByRole("button", { name: "Limpar filtros" }).className.split(" ")).toContain("text-badge-red-text");
        fireEvent.change(screen.getByRole("textbox", { name: "Buscar por nome, CPF ou COREN" }), { target: { value: "Bia" } });
        expect(screen.getByText("1 de 4 profissional")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Remover filtro Vínculo: RPA" }));
        expect(screen.getByText("0 de 4 profissionais")).toBeTruthy();
        expect(screen.getByText("Nenhum profissional encontrado.")).toBeTruthy();
        fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
        expect(screen.getByText("4 profissionais")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Remover filtro/ })).toBeNull();
    });

    it("apresenta exportação e importação em ordem e permite clicar sem handler", async () => {
        const user = userEvent.setup();
        render(<Professional />);
        await screen.findByText("4 profissionais");
        const search = screen.getByRole("textbox", { name: "Buscar por nome, CPF ou COREN" });
        const filters = screen.getByRole("button", { name: "Filtros" });
        const exportButton = screen.getByRole("button", { name: "Exportar planilha" });
        const importButton = screen.getByRole("button", { name: "Importar planilha" });
        expect(search.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(filters.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(exportButton.compareDocumentPosition(importButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(importButton.getAttribute("aria-label")).toBe("Importar planilha");
        expect(exportButton.getAttribute("title")).toBe("Exportar planilha");
        await user.click(importButton);
        expect(exportProfessionalsXlsx).not.toHaveBeenCalled();
        await user.click(exportButton);
        expect(exportProfessionalsXlsx).toHaveBeenCalledWith(professionals);
    });

    it("restaura os filtros ao cancelar a edição", async () => {
        render(<Professional />);
        await screen.findByText("4 profissionais");
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Técnico" }));
        expect(screen.getByText("2 de 4 profissionais")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByText("4 profissionais")).toBeTruthy();
    });

    it("usa o mesmo estilo nos vínculos e texto escuro no status ativo", async () => {
        render(<Professional />);
        await screen.findByText("4 profissionais");
        const clt = screen.getAllByText("CLT")[0];
        const rpa = screen.getByText("RPA");
        expect(clt.className).toBe(rpa.className);
        expect(clt.className).toContain("min-w-24");
        expect(clt.className).toContain("h-7");
        expect(clt.className).toContain("rounded-md");
        expect(clt.className.split(" ")).not.toContain("border");
        expect(clt.className).toContain("text-gray-600");
        expect(clt.className).toContain("box-border");
        expect(screen.getAllByText("Ativo")[0].className).toContain("text-text");
    });
});

describe("Card de profissional", () => {
    it("compartilha avatar e estilos de status com Disponibilidade", async () => {
        vi.mocked(fetchAllRestrictions).mockResolvedValue({
            professionals: [],
            records: {
                restrictions: [
                    { id: "r1", professionalId: "1", professionalStatus: "ativo", category: "restrictions", name: "Maria Silva", role: "Enfermeiro", rule: "Restrição", period: "Recorrente" },
                    { id: "r2", professionalId: "2", professionalStatus: "desativado", category: "restrictions", name: "João Lima", role: "Técnico", rule: "Restrição", period: "Recorrente" },
                ],
                externalLinks: [],
                absences: [],
            },
        });
        render(<><ProfessionalCard {...professionals[0]} onEdit={vi.fn()} /><ProfessionalCard {...professionals[2]} onEdit={vi.fn()} /><DisponibilityPage /></>);

        const row = (await screen.findByText("Maria Silva")).closest("tr")!;
        const inactiveRow = screen.getByText("João Lima").closest("tr")!;
        expect(screen.getByText("AL").className).toBe(within(row).getByText("MS").className);
        const active = screen.getAllByText("Ativo")[0];
        const inactive = screen.getByText("Inativo");
        expect(active.className).toBe(within(row).getByText("Ativo").className);
        expect(active.querySelector("span")?.className).toBe(within(row).getByText("Ativo").querySelector("span")?.className);
        expect(inactive.className).toBe(within(inactiveRow).getByText("Desativado").className);
        expect(inactive.querySelector("span")?.className).toBe(within(inactiveRow).getByText("Desativado").querySelector("span")?.className);
    });

    it("abre pelo mouse, Enter e Espaço, sem duplicar a ação do botão interno", async () => {
        const onEdit = vi.fn();
        const user = userEvent.setup();
        render(<ProfessionalCard {...professionals[0]} onEdit={onEdit} />);
        const card = screen.getByRole("button", { name: "Abrir perfil de Ana Lima" });
        expect(card.className).toContain("rounded-xl");
        expect(card.parentElement?.className).toContain("rounded-xl");
        expect(card.parentElement?.className).toContain("hover:bg-neutral");
        expect(card.parentElement?.className).toContain("has-focus-visible:bg-neutral");
        await user.click(card);
        await user.keyboard("{Enter}");
        await user.keyboard(" ");
        await user.click(screen.getByRole("button", { name: "Editar profissional Ana Lima" }));
        expect(onEdit).toHaveBeenCalledTimes(4);
        expect(onEdit).toHaveBeenLastCalledWith(professionals[0]);
    });
});
