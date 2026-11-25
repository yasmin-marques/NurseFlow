// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSectors } from "../../../services/sectors";
import type { Sector } from "../../Sectors/types";
import type { Professional } from "../types";
import { ProfessionalFormModal } from "./ProfessionalFormModal";

vi.mock("../../../services/sectors", () => ({ listSectors: vi.fn() }));

const sectors: Sector[] = [
    { id: "s1", name: "UTI", description: "", active: true, minimum: { nurses: 1, technicians: null }, hasSubsectors: true, techniciansWithoutSubsector: 0, subsectors: [
        { id: "sub1", sectorId: "s1", name: "Adulto", description: "", active: true, minimumTechnicians: 1 },
    ] },
    { id: "s2", name: "Emergência", description: "", active: true, minimum: { nurses: 1, technicians: 1 }, hasSubsectors: false, techniciansWithoutSubsector: 0, subsectors: [] },
    { id: "s3", name: "Pediatria", description: "", active: true, minimum: { nurses: 1, technicians: null }, hasSubsectors: true, techniciansWithoutSubsector: 0, subsectors: [
        { id: "sub3", sectorId: "s3", name: "Infantil", description: "", active: true, minimumTechnicians: 1 },
    ] },
];
const professional: Professional = { name: "Ana Lima", cpf: "123", email: "ana@example.test", coren: "123", bond: "CLT", status: true, formation: "Enfemeiro" };

beforeEach(() => vi.mocked(listSectors).mockResolvedValue(sectors));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Formulário de profissional", () => {
    it("exige formação antes do setor e oculta sub-setor para enfermeiro", async () => {
        const save = vi.fn();
        render(<ProfessionalFormModal professional={professional} isCreating onClose={vi.fn()} onSave={save} />);
        expect(screen.getByLabelText(/^Nome:/)).toBeTruthy();
        expect(screen.getByLabelText(/^E-mail:/)).toBeTruthy();
        const formation = screen.getByText("Tipo de formação");
        const sector = screen.getByRole("combobox", { name: /Setor fixo/ }) as HTMLSelectElement;
        await screen.findByRole("option", { name: "UTI" });
        expect(formation.compareDocumentPosition(sector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(sector.disabled).toBe(true);
        expect(screen.getByText("Escolha o tipo de formação primeiro")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(screen.getByText("Escolha o tipo de formação.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Enfermeiro/ }));
        expect(sector.disabled).toBe(false);
        expect(screen.queryByRole("combobox", { name: /Sub-setor/ })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(screen.getByText("Selecione um setor.")).toBeTruthy();
        fireEvent.change(sector, { target: { value: "s1" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ formation: "Enfemeiro", sectorId: "s1", subsectorId: null }));
    });

    it("filtra sub-setores por setor e limpa vínculos ao mudar setor ou formação", async () => {
        const save = vi.fn();
        render(<ProfessionalFormModal professional={professional} isCreating onClose={vi.fn()} onSave={save} />);
        await screen.findByRole("option", { name: "UTI" });
        fireEvent.click(screen.getByRole("button", { name: /Técnico/ }));
        const sector = screen.getByRole("combobox", { name: /Setor fixo/ });
        const sub = screen.getByRole("combobox", { name: /Sub-setor/ }) as HTMLSelectElement;
        expect(sub.disabled).toBe(true);
        fireEvent.change(sector, { target: { value: "s1" } });
        expect(within(sub).getByRole("option", { name: "Adulto" })).toBeTruthy();
        expect(within(sub).queryByRole("option", { name: "Infantil" })).toBeNull();
        fireEvent.change(sub, { target: { value: "sub1" } });
        fireEvent.change(sector, { target: { value: "s2" } });
        expect(sub.value).toBe("");
        expect(sub.disabled).toBe(true);
        expect(screen.getByText("Este setor não tem sub-setores")).toBeTruthy();
        fireEvent.change(sector, { target: { value: "s3" } });
        expect(within(sub).getByRole("option", { name: "Infantil" })).toBeTruthy();
        fireEvent.change(sub, { target: { value: "sub3" } });
        fireEvent.click(screen.getByRole("button", { name: /Enfermeiro/ }));
        expect(screen.queryByRole("combobox", { name: /Sub-setor/ })).toBeNull();
        expect((sector as HTMLSelectElement).value).toBe("s3");
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ formation: "Enfemeiro", sectorId: "s3", subsectorId: null }));
    });

    it("na edição mantém sub-setor selecionado e permite removê-lo", async () => {
        const save = vi.fn();
        render(<ProfessionalFormModal professional={{ ...professional, id: "1", formation: "Técnico", sectorId: "s1", subsectorId: "sub1" }} onClose={vi.fn()} onSave={save} />);
        expect(screen.getByLabelText(/^Nome:/)).toBeTruthy();
        expect(screen.getByLabelText(/^E-mail:/)).toBeTruthy();
        await screen.findByRole("option", { name: "Adulto" });
        const sub = screen.getByRole("combobox", { name: /Sub-setor/ }) as HTMLSelectElement;
        expect(sub.value).toBe("sub1");
        fireEvent.change(sub, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ subsectorId: null }));
    });

    it("cadastra técnico com um sub-setor escolhido", async () => {
        const save = vi.fn();
        render(<ProfessionalFormModal professional={professional} isCreating onClose={vi.fn()} onSave={save} />);
        await screen.findByRole("option", { name: "UTI" });
        fireEvent.click(screen.getByRole("button", { name: /Técnico/ }));
        fireEvent.change(screen.getByRole("combobox", { name: /Setor fixo/ }), { target: { value: "s1" } });
        fireEvent.change(screen.getByRole("combobox", { name: /Sub-setor/ }), { target: { value: "sub1" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ formation: "Técnico", sectorId: "s1", subsectorId: "sub1" }));
    });

    it("preserva setor válido ao trocar formação durante o carregamento dos setores", async () => {
        let finish!: (value: Sector[]) => void;
        vi.mocked(listSectors).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        render(<ProfessionalFormModal professional={{ ...professional, formation: "Técnico", sectorId: "s1", subsectorId: "sub1" }} onClose={vi.fn()} onSave={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: /Enfermeiro/ }));
        await act(async () => finish(sectors));
        expect((screen.getByRole("combobox", { name: /Setor fixo/ }) as HTMLSelectElement).value).toBe("s1");
    });
});
