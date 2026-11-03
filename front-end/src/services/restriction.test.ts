import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockBackend, type Call } from "../test/fetchMock";
import {
  AvailabilityFormModal,
  type AvailabilityRecord,
} from "../pages/Disponibility/components/AvailabilityFormModal";
import {
  createRestriction,
  deleteRestriction,
  fetchAllRestrictions,
  updateRestriction,
} from "./restriction";

afterEach(() => vi.unstubAllGlobals());

const ANA = {
  id: "p1",
  nome: "Ana Souza",
  formacao: "enfermeiro",
  status: "ativo",
};
const profissionaisResponse = (...items: object[]) => ({
  data: items.map((item) => ({
    cpf: "",
    email: "",
    coren: "",
    tipoVinculo: "clt",
    ...item,
  })),
  meta: { totalPages: 1 },
});

const professionals = [{ id: "p1", name: "Ana Souza" }];
const record = (
  category: AvailabilityRecord["category"],
  details: AvailabilityRecord["details"],
): AvailabilityRecord => ({
  id: "novo",
  category,
  name: "Ana Souza",
  role: "Enfemeiro",
  rule: "",
  period: "",
  details,
});

describe("services/restriction", () => {
  it("expõe somente período definido para regras de disponibilidade", () => {
    const Wrapper = () =>
      AvailabilityFormModal({
        category: "restrictions",
        professionals,
        onClose: () => undefined,
        onSave: () => undefined,
      });

    const markup = renderToStaticMarkup(React.createElement(Wrapper));

    expect(markup).toContain("Período definido");
    expect(markup).not.toContain("Recorrente");
    expect(markup).not.toContain("Sem data para terminar");
  });

  it("usa professionalId controlado e preserva o profissional original na edição", () => {
    const Wrapper = () =>
      AvailabilityFormModal({
        category: "restrictions",
        record: {
          ...record("restrictions", {
            ruleType: "unavailableDays",
            validFrom: "2026-10-01",
            validTo: "2026-10-31",
            days: ["segunda"],
          }),
          professionalId: "p2",
          name: "Ana Souza",
        },
        professionals: [
          { id: "p1", name: "Ana Souza" },
          { id: "p2", name: "Ana Souza" },
        ],
        onClose: () => undefined,
        onSave: () => undefined,
      });

    const markup = renderToStaticMarkup(React.createElement(Wrapper));

    expect(markup).toContain("<select");
    expect(markup).toContain('value="p2"');
    expect(markup).not.toContain('list="availability-professionals"');
  });

  it("lista restrições de todos os profissionais e separa por categoria", async () => {
    mockBackend((call: Call) => {
      if (call.url.includes("/profissionais?")) {
        return {
          body: profissionaisResponse(ANA, {
            id: "p2",
            nome: "Bia Lima",
            formacao: "tecnico",
            status: "desativado",
          }),
        };
      }
      if (call.url.endsWith("/profissionais/p1/restricoes")) {
        return {
          body: [
            {
              _id: "r1",
              tipo: "indisponivel",
              inicio: "2026-10-01T00:00:00.000Z",
              fim: "2026-10-31T23:59:59.999Z",
              diaSemana: 1,
              observacao: "Faculdade",
            },
            {
              _id: "r2",
              tipo: "vinculo_externo",
              inicio: "2026-10-01T00:00:00.000Z",
              fim: "2026-12-31T23:59:59.999Z",
              diaSemana: null,
            },
          ],
        };
      }
      return {
        body: [
          {
            _id: "r3",
            tipo: "ferias",
            inicio: "2026-11-01T00:00:00.000Z",
            fim: "2026-11-30T23:59:59.999Z",
            diaSemana: null,
          },
        ],
      };
    });

    const { records, professionals: options } = await fetchAllRestrictions();
    // Somente profissionais ativos podem receber novos registros.
    expect(options).toEqual([{ id: "p1", name: "Ana Souza" }]);
    expect(records.restrictions).toHaveLength(1);
    expect(records.restrictions[0]).toMatchObject({
      id: "r1",
      professionalId: "p1",
      rule: "Indisponível · Faculdade",
      period: "2026-10-01 a 2026-10-31 · segunda",
    });
    expect(records.externalLinks.map((r) => r.id)).toEqual(["r2"]);
    expect(records.absences[0]).toMatchObject({
      id: "r3",
      professionalStatus: "desativado",
    });
  });

  it("cria uma recorrência em uma única regra com múltiplos dias e datas em UTC", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));
    await createRestriction(
      record("restrictions", {
        ruleType: "unavailableDays",
        days: ["segunda", "domingo"],
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        note: "Curso",
      }),
      professionals,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/api/profissionais/p1/restricoes",
      method: "POST",
      body: {
        tipo: "indisponivel",
        inicio: "2026-10-01T00:00:00.000Z",
        fim: "2026-10-31T23:59:59.999Z",
        diasSemana: [1, 0],
        observacao: "Curso",
      },
    });
  });

  it("mapeia férias e ausências sem diaSemana", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));
    await createRestriction(
      record("absences", {
        absenceType: "Férias",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
      }),
      professionals,
    );
    await createRestriction(
      record("absences", {
        absenceType: "Atestado médico",
        startDate: "2026-11-01",
        endDate: "2026-11-02",
      }),
      professionals,
    );
    expect(calls.map((c) => (c.body as { tipo: string }).tipo)).toEqual([
      "ferias",
      "ausencia",
    ]);
    expect(calls[0].body).not.toHaveProperty("diaSemana");
  });

  it("cria disponibilidade por turno com motivo e turno explícitos", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));
    await createRestriction(
      {
        ...record("restrictions", {
          ruleType: "allowedShift",
          shift: "day",
          validFrom: "2026-10-01",
          validTo: "2026-10-31",
          note: "Curso de atualização",
        }),
        professionalId: "p1",
      },
      professionals,
    );
    expect(calls[0]).toMatchObject({
      url: "/api/profissionais/p1/restricoes",
      method: "POST",
      body: {
        tipo: "disponivel",
        turno: "diurno",
        motivo: "disponibilidade",
        observacao: "Curso de atualização",
      },
    });
  });

  it("atualiza uma regra existente com uma única operação de PATCH e dias da semana em array", async () => {
    const { calls } = mockBackend(() => ({ status: 200, body: {} }));
    await updateRestriction("p1", "r9", {
      ...record("externalLinks", {
        institution: "Hospital X",
        linkType: "Compromisso externo",
        linkShift: "night",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        note: "Revezamento",
        days: ["segunda", "quarta"],
      }),
      professionalId: "p1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "/api/profissionais/p1/restricoes/r9",
      method: "PATCH",
      body: {
        tipo: "vinculo_externo",
        instituicao: "Hospital X",
        tipoVinculo: "Compromisso externo",
        turno: "noturno",
        inicio: "2026-10-01T00:00:00.000Z",
        fim: "2026-10-31T23:59:59.999Z",
        diasSemana: [1, 3],
      },
    });
  });

  it("preserva observações longas quando elas vêm de payload explícito ou legado", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));
    await createRestriction(
      record("absences", {
        absenceType: "Ausência",
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        note: "x".repeat(500),
      }),
      professionals,
    );
    expect((calls[0].body as { observacao: string }).observacao.length).toBe(
      500,
    );
  });

  it("recusa profissional fora da lista de ativos e recursos sem suporte no backend", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));
    await expect(
      createRestriction(
        { ...record("absences", {}), name: "Outra Pessoa" },
        professionals,
      ),
    ).rejects.toThrow(/profissional ativo/);
    await expect(
      createRestriction(
        record("restrictions", { ruleType: "allowedShift" }),
        professionals,
      ),
    ).rejects.toThrow(/turno/);
    expect(calls).toHaveLength(0);
  });

  it("exige vigência definida e rejeita fallback silencioso para a data atual quando a regra não informa período", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));

    await expect(
      createRestriction(
        record("restrictions", {
          ruleType: "unavailableDays",
          days: ["segunda"],
        }),
        professionals,
      ),
    ).rejects.toThrow(/data de início e a data de término/i);

    expect(calls).toHaveLength(0);
  });

  it("limpa campos opcionais em PATCH quando o usuário remove observação e turno", async () => {
    const { calls } = mockBackend(() => ({ status: 200, body: {} }));
    await updateRestriction("p1", "r9", {
      ...record("externalLinks", {
        institution: "Hospital X",
        linkType: "Compromisso externo",
        linkShift: "",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        note: "",
        days: ["segunda"],
      }),
      professionalId: "p1",
    });

    expect(calls[0]).toMatchObject({
      url: "/api/profissionais/p1/restricoes/r9",
      method: "PATCH",
      body: {
        tipo: "vinculo_externo",
        instituicao: "Hospital X",
        tipoVinculo: "Compromisso externo",
        turno: null,
        inicio: "2026-10-01T00:00:00.000Z",
        fim: "2026-10-31T23:59:59.999Z",
        diasSemana: [1],
      },
    });
  });

  it("rejeita vigência recorrente aberta porque a API exige período definido", async () => {
    mockBackend(() => ({ status: 201, body: {} }));
    await expect(
      createRestriction(
        record("restrictions", {
          ruleType: "unavailableDays",
          days: ["segunda"],
          validity: "recurring",
        }),
        professionals,
      ),
    ).rejects.toThrow(/vigência recorrente aberta|período definido/i);
  });

  it("preserva edição sem alterações e não regrava campos vazios como texto", async () => {
    const { calls } = mockBackend(() => ({ status: 200, body: {} }));
    await updateRestriction("p1", "r9", {
      ...record("restrictions", {
        ruleType: "unavailableDays",
        validity: "definedPeriod",
        days: ["segunda", "quarta"],
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        note: "Sem alterações",
      }),
      professionalId: "p1",
    });

    expect(calls[0].body).toMatchObject({
      tipo: "indisponivel",
      inicio: "2026-10-01T00:00:00.000Z",
      fim: "2026-10-31T23:59:59.999Z",
      diasSemana: [1, 3],
    });
  });

  it("normaliza turnos diurno e noturno vindos do backend para os valores do formulário", async () => {
    mockBackend((call: Call) => {
      if (call.url.includes("/profissionais?")) {
        return {
          body: profissionaisResponse(ANA),
        };
      }
      return {
        body: [
          {
            _id: "r1",
            tipo: "disponivel",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            turno: "diurno",
            diaSemana: 1,
          },
          {
            _id: "r2",
            tipo: "disponivel",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            turno: "noturno",
            diaSemana: 2,
          },
          {
            _id: "r3",
            tipo: "disponivel",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            turno: "flexivel",
            diaSemana: 3,
          },
        ],
      };
    });

    const { records } = await fetchAllRestrictions();
    expect(records.restrictions.map((r) => r.details?.shift)).toEqual([
      "day",
      "night",
      "flexible",
    ]);
  });

  it("rejeita criação quando existem profissionais com o mesmo nome sem professionalId explícito", async () => {
    mockBackend(() => ({
      body: profissionaisResponse(
        {
          id: "p1",
          nome: "Ana Souza",
          formacao: "enfermeiro",
          status: "ativo",
        },
        {
          id: "p2",
          nome: "Ana Souza",
          formacao: "enfermeiro",
          status: "ativo",
        },
      ),
    }));

    await expect(
      createRestriction(
        record("absences", {
          absenceType: "Férias",
          startDate: "2026-11-01",
          endDate: "2026-11-30",
        }),
        [
          { id: "p1", name: "Ana Souza" },
          { id: "p2", name: "Ana Souza" },
        ],
      ),
    ).rejects.toThrow(/mais de um profissional com esse nome/i);
  });

  it("preserva observações legadas longas e não trunca em 300 caracteres sem edição explícita", async () => {
    const legacyNote = "x".repeat(800);
    mockBackend((call: Call) => {
      if (call.url.includes("/profissionais?")) {
        return {
          body: profissionaisResponse(ANA),
        };
      }
      return {
        body: [
          {
            _id: "r9",
            tipo: "indisponivel",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            diaSemana: 1,
            observacao: legacyNote,
          },
        ],
      };
    });

    const { records } = await fetchAllRestrictions();
    expect(records.restrictions[0].details?.note).toBe(legacyNote);
    expect(records.restrictions[0].details?.note?.length).toBe(800);
  });

  it("não envia dias antigos quando a regra muda de indisponível para turno permitido", async () => {
    const { calls } = mockBackend(() => ({ status: 201, body: {} }));

    await createRestriction(
      {
        ...record("restrictions", {
          ruleType: "allowedShift",
          shift: "day",
          validFrom: "2026-10-01",
          validTo: "2026-10-31",
          days: ["segunda", "quarta"],
          note: "Sem uso dos dias ocultos",
        }),
        professionalId: "p1",
      },
      professionals,
    );

    expect(calls[0].body).toMatchObject({
      tipo: "disponivel",
      turno: "diurno",
      motivo: "disponibilidade",
    });
    expect(calls[0].body).not.toHaveProperty("diasSemana");
  });

  it("exige vigência definida para vínculo externo e não salva fallback para hoje", async () => {
    mockBackend(() => ({ status: 201, body: {} }));

    await expect(
      createRestriction(
        {
          ...record("externalLinks", {
            institution: "Hospital X",
            linkType: "Compromisso externo",
            linkShift: "night",
            days: ["segunda"],
            note: "Sem datas",
          }),
          professionalId: "p1",
        },
        professionals,
      ),
    ).rejects.toThrow(/vigência definida|data de início|data de fim/i);
  });

  it("omite observacao no PATCH quando ela não foi alterada e preserva notas longas acima de 300", async () => {
    const longNote = "x".repeat(800);
    const { calls } = mockBackend(() => ({ status: 200, body: {} }));

    await updateRestriction("p1", "r9", {
      ...record("restrictions", {
        ruleType: "unavailableDays",
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        days: ["segunda"],
        note: longNote,
        noteEdited: false,
      }),
      professionalId: "p1",
    });

    expect(calls[0].body).not.toHaveProperty("observacao");
    expect(calls[0].body).toMatchObject({
      tipo: "indisponivel",
      inicio: "2026-10-01T00:00:00.000Z",
      fim: "2026-10-31T23:59:59.999Z",
      diasSemana: [1],
    });
  });

  it("mantém motivos de férias legados e reconhece valores ausentes ou não padronizados", async () => {
    mockBackend((call: Call) => {
      if (call.url.includes("/profissionais?")) {
        return {
          body: profissionaisResponse(ANA),
        };
      }
      return {
        body: [
          {
            _id: "r1",
            tipo: "ferias",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            motivo: undefined,
          },
          {
            _id: "r2",
            tipo: "ausencia",
            inicio: "2026-10-01T00:00:00.000Z",
            fim: "2026-10-31T23:59:59.999Z",
            motivo: "Atestado médico",
          },
        ],
      };
    });

    const { records } = await fetchAllRestrictions();
    expect(records.absences[0].details?.absenceType).toBe("ferias");
    expect(records.absences[1].details?.absenceType).toBe("Atestado médico");
  });

  it("mostra a mensagem do servidor em caso de conflito (409)", async () => {
    mockBackend(() => ({
      status: 409,
      body: { message: "Já existe restrição desse tipo no período informado" },
    }));
    await expect(
      createRestriction(
        record("absences", {
          absenceType: "Férias",
          startDate: "2026-11-01",
          endDate: "2026-11-30",
        }),
        professionals,
      ),
    ).rejects.toThrow("Já existe restrição desse tipo no período informado");
  });

  it("exclui pela rota do profissional", async () => {
    const { calls } = mockBackend(() => ({ body: { removida: true } }));
    await deleteRestriction("p1", "r9");
    expect(calls[0]).toMatchObject({
      url: "/api/profissionais/p1/restricoes/r9",
      method: "DELETE",
    });
  });
});
