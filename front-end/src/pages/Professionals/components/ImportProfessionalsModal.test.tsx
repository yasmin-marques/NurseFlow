// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../services/api";
import {
    downloadImportTemplate,
    importProfessionals,
    previewProfessionalsImport,
    type ImportPreview,
    type ImportRow,
} from "../../../services/professionalsImport";
import { ImportProfessionalsModal } from "./ImportProfessionalsModal";

vi.mock("../../../services/professionalsImport", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../../services/professionalsImport")>()),
    previewProfessionalsImport: vi.fn(),
    importProfessionals: vi.fn(),
    downloadImportTemplate: vi.fn(),
}));

const row = (over: Partial<ImportRow>): ImportRow => ({ linha: 2, nome: "Ana Souza", cpf: "529.982.247-25", acao: "criar", alteracoes: [], erros: [], avisos: [], ...over });
const preview = (linhas: ImportRow[]): ImportPreview => {
    const count = (acao: ImportRow["acao"]) => linhas.filter((item) => item.acao === acao).length;
    return {
        resumo: { total: linhas.length, novos: count("criar"), atualizar: count("atualizar"), semAlteracao: count("sem_alteracao"), invalidos: count("invalido") },
        linhas,
        podeConfirmar: count("invalido") === 0,
    };
};
const xlsx = (name = "profissionais.xlsx") => new File([new Uint8Array(20)], name);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function pick(file: File) {
    const input = document.getElementById("import-professionals-file") as HTMLInputElement;
    await userEvent.upload(input, file, { applyAccept: false });
}

describe("ImportProfessionalsModal", () => {
    it("explica o fluxo, oferece o modelo e começa com Importar desabilitado", async () => {
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        expect(screen.getByRole("heading", { name: "Importar profissionais" })).toBeTruthy();
        expect(screen.getByText("CPF")).toBeTruthy();
        expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(true);
        await userEvent.click(screen.getByRole("button", { name: "Baixar modelo de planilha" }));
        expect(downloadImportTemplate).toHaveBeenCalledTimes(1);
    });

    it("rejeita arquivo que não é .xlsx sem chamar o servidor", async () => {
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        await pick(xlsx("dados.csv"));
        expect((await screen.findByRole("alert")).textContent).toMatch(/\.xlsx/);
        expect(previewProfessionalsImport).not.toHaveBeenCalled();
    });

    it("valida ao selecionar, mostra resumo, diferenças atual/novo e importa após confirmar", async () => {
        const onImported = vi.fn();
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([
            row({ linha: 2, nome: "Novo Profissional" }),
            row({ linha: 3, nome: "Bia Silva", acao: "atualizar", alteracoes: [{ campo: "Tipo de vínculo", atual: "CLT", novo: "RPA" }] }),
            row({ linha: 4, nome: "Caio Costa", acao: "sem_alteracao" }),
        ]));
        vi.mocked(importProfessionals).mockResolvedValue({ resumo: { total: 3, cadastrados: 1, atualizados: 1, ignorados: 1 }, linhas: [] });
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={onImported} />);

        await pick(xlsx());
        const summary = await screen.findByLabelText("Resumo da importação");
        expect(within(summary).getByText("Identificados").previousSibling?.textContent).toBe("3");
        expect(within(summary).getByText("Novos").previousSibling?.textContent).toBe("1");
        expect(within(summary).getByText("Inválidos").previousSibling?.textContent).toBe("0");
        const changes = within(summary).getByLabelText("Alterações de Bia Silva");
        expect(changes.textContent).toContain("Tipo de vínculo:");
        expect(changes.textContent).toContain("CLT");
        expect(changes.textContent).toContain("RPA");
        expect(importProfessionals).not.toHaveBeenCalled(); // nada é gravado antes da confirmação

        await userEvent.click(screen.getByRole("button", { name: "Importar" }));
        expect(await screen.findByText("Importação concluída com sucesso.")).toBeTruthy();
        expect(importProfessionals).toHaveBeenCalledTimes(1);
        expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ resumo: expect.objectContaining({ cadastrados: 1, atualizados: 1, ignorados: 1 }) }));
        expect(screen.getByText("Cadastrados").previousSibling?.textContent).toBe("1");
    });

    it("bloqueia a confirmação quando há registros inválidos e mostra linha, campo e motivo", async () => {
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([
            row({ linha: 5, nome: "Sem CPF", acao: "invalido", erros: [{ campo: "CPF", mensagem: "CPF inválido." }] }),
            row({ linha: 6, nome: "Válido" }),
        ]));
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        await pick(xlsx());
        expect(await screen.findByText(/Linha 5/)).toBeTruthy();
        expect(screen.getByText("CPF:").parentElement?.textContent).toContain("CPF inválido.");
        expect(screen.getByText(/Corrija os erros na planilha/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("não oferece importar quando todos os profissionais já estão atualizados", async () => {
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([row({ acao: "sem_alteracao" })]));
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        await pick(xlsx());
        expect(await screen.findByText(/Nenhum cadastro novo ou alteração/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("mostra o erro do servidor para arquivo incompatível e permite escolher outro", async () => {
        vi.mocked(previewProfessionalsImport).mockRejectedValue(new ApiError(415, "O conteúdo do arquivo não é uma planilha .xlsx válida."));
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        await pick(xlsx());
        expect((await screen.findByRole("alert")).textContent).toContain("não é uma planilha");
        expect(document.getElementById("import-professionals-file")).toBeTruthy();
    });

    it("falha na importação mantém a prévia, informa que nada foi importado e não atualiza a listagem", async () => {
        const onImported = vi.fn();
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([row({})]));
        vi.mocked(importProfessionals).mockRejectedValue(new ApiError(500, "Erro inesperado."));
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={onImported} />);
        await pick(xlsx());
        await userEvent.click(await screen.findByRole("button", { name: "Importar" }));
        expect((await screen.findByRole("alert")).textContent).toContain("Nada foi importado");
        expect(onImported).not.toHaveBeenCalled();
        expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("cancela antes da confirmação sem importar", async () => {
        const onClose = vi.fn();
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([row({})]));
        render(<ImportProfessionalsModal onClose={onClose} onImported={vi.fn()} />);
        await pick(xlsx());
        await screen.findByLabelText("Resumo da importação");
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(importProfessionals).not.toHaveBeenCalled();
    });

    it("aceita arquivo arrastado para a área de upload", async () => {
        vi.mocked(previewProfessionalsImport).mockResolvedValue(preview([row({})]));
        render(<ImportProfessionalsModal onClose={vi.fn()} onImported={vi.fn()} />);
        const dropzone = document.querySelector("label[for='import-professionals-file']") as HTMLElement;
        fireEvent.drop(dropzone, { dataTransfer: { files: [xlsx()] } });
        await waitFor(() => expect(previewProfessionalsImport).toHaveBeenCalledTimes(1));
    });
});
