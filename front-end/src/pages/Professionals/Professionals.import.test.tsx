// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProfessionals } from "../../services/professionals";
import { Professional } from "./Professionals";
import type { Professional as ProfessionalData } from "./types";

vi.mock("../../services/professionals", () => ({
    listProfessionals: vi.fn(),
    createProfessional: vi.fn(),
    updateProfessional: vi.fn(),
}));
vi.mock("../../services/professionalsExport", () => ({ exportProfessionalsXlsx: vi.fn() }));
vi.mock("./components/ImportProfessionalsModal", () => ({
    ImportProfessionalsModal: ({ onClose, onImported }: { onClose: () => void; onImported: (result: unknown) => void }) => (
        <div role="dialog" aria-label="Importar profissionais">
            <button type="button" onClick={() => onImported({ resumo: { total: 3, cadastrados: 2, atualizados: 1, ignorados: 0 }, linhas: [] })}>concluir-importacao</button>
            <button type="button" onClick={onClose}>fechar-modal</button>
        </div>
    ),
}));

const ana: ProfessionalData = { id: "1", name: "Ana Lima", cpf: "111", email: "", coren: "123", formation: "Enfemeiro", bond: "CLT", status: true, apiStatus: "ativo" };
const bia: ProfessionalData = { id: "2", name: "Bia Silva", cpf: "222", email: "", coren: "456", formation: "Técnico", bond: "RPA", status: true, apiStatus: "ativo" };

beforeEach(() => vi.mocked(listProfessionals).mockResolvedValue([ana]));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Profissionais: importação por planilha", () => {
    it("abre o modal pelo botão existente e recarrega a lista sem recarregar a página após importar", async () => {
        render(<Professional />);
        expect(await screen.findByText("1 profissional")).toBeTruthy();
        expect(screen.queryByRole("dialog")).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Importar planilha" }));
        expect(screen.getByRole("dialog", { name: "Importar profissionais" })).toBeTruthy();

        vi.mocked(listProfessionals).mockResolvedValue([ana, bia]);
        await userEvent.click(screen.getByRole("button", { name: "concluir-importacao" }));

        expect(await screen.findByText("2 profissionais")).toBeTruthy();
        expect(listProfessionals).toHaveBeenCalledTimes(2);
        expect(screen.getByText("Bia Silva")).toBeTruthy();
        expect(screen.getByRole("status", { name: "" }).textContent).toContain("2 cadastrado(s), 1 atualizado(s), 0 ignorado(s)");
    });

    it("fecha o modal sem alterar a lista ao cancelar", async () => {
        render(<Professional />);
        await screen.findByText("1 profissional");
        await userEvent.click(screen.getByRole("button", { name: "Importar planilha" }));
        const callsWhileOpen = vi.mocked(listProfessionals).mock.calls.length;
        await userEvent.click(screen.getByRole("button", { name: "fechar-modal" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(listProfessionals).toHaveBeenCalledTimes(callsWhileOpen);
    });
});
