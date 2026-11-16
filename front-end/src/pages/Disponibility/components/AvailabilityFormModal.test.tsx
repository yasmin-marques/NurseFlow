import { render, screen } from "@testing-library/react";
import {
  AvailabilityFormModal,
  type AvailabilityRecord,
} from "./AvailabilityFormModal";

describe("AvailabilityFormModal", () => {
  const defaultProfessionals = [
    { id: "p1", name: "Maria Silva" },
    { id: "p2", name: "João Souza" },
  ];

  it("bloqueia a alteração do profissional em edição e exibe o profissional original", () => {
    const record: AvailabilityRecord = {
      id: "r1",
      professionalId: "p1",
      category: "absences",
      name: "Maria Silva",
      role: "Enfermagem",
      rule: "Férias",
      period: "01/11/2026 a 02/11/2026",
      details: {
        absenceType: "ferias",
        startDate: "2026-11-01",
        endDate: "2026-11-02",
      },
    };

    const { container } = render(
      <AvailabilityFormModal
        category="absences"
        record={record}
        professionals={defaultProfessionals}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    const select = container.querySelector(
      'select[aria-label="Profissional em edição"]',
    ) as HTMLSelectElement;

    expect(select).not.toBeNull();
    expect(select.value).toBe("p1");
    expect(select.disabled).toBe(true);
    expect(select.options[0].textContent).toBe("Maria Silva");
  });

  it("difere profissionais homônimos na criação usando o identificador do profissional", () => {
    const professionals = [
      { id: "p10", name: "Maria Silva" },
      { id: "p20", name: "Maria Silva" },
    ];

    render(
      <AvailabilityFormModal
        category="absences"
        professionals={professionals}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    const professionalSelect = screen.getAllByRole(
      "combobox",
    )[0] as HTMLSelectElement;
    const options = Array.from(
      professionalSelect.querySelectorAll("option"),
    ).map((option) => option.textContent);

    expect(options).toContain("Maria Silva (p10)");
    expect(options).toContain("Maria Silva (p20)");
  });

  it("normaliza motivos legados conhecidos e preserva valores desconhecidos no formulário", () => {
    const { rerender } = render(
      <AvailabilityFormModal
        category="absences"
        record={{
          id: "legacy-1",
          professionalId: "p1",
          category: "absences",
          name: "Maria Silva",
          role: "Enfermagem",
          rule: "Férias",
          period: "01/11/2026 a 02/11/2026",
          details: {
            absenceType: "ferias",
            startDate: "2026-11-01",
            endDate: "2026-11-02",
          },
        }}
        professionals={defaultProfessionals}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    const absenceSelect = document.querySelectorAll(
      "select",
    )[1] as HTMLSelectElement;
    expect(absenceSelect.value).toBe("Férias");

    rerender(
      <AvailabilityFormModal
        category="absences"
        record={{
          id: "legacy-2",
          professionalId: "p1",
          category: "absences",
          name: "Maria Silva",
          role: "Enfermagem",
          rule: "Atestado médico",
          period: "01/11/2026 a 02/11/2026",
          details: {
            absenceType: "Atestado médico",
            startDate: "2026-11-01",
            endDate: "2026-11-02",
          },
        }}
        professionals={defaultProfessionals}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    const updatedAbsenceSelect = document.querySelectorAll(
      "select",
    )[1] as HTMLSelectElement;
    expect(updatedAbsenceSelect.value).toBe("Atestado médico");
    expect(
      Array.from(updatedAbsenceSelect.options).map((option) => option.value),
    ).toContain("Atestado médico");
    expect(
      Array.from(absenceSelect.options).map((option) => option.value),
    ).toContain("Atestado médico");
  });

  it("exibe a mensagem de vigência do vínculo externo com início e término obrigatórios", () => {
    render(
      <AvailabilityFormModal
        category="externalLinks"
        professionals={defaultProfessionals}
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        /obrigatório · informe o início e o término do vínculo/i,
      ),
    ).toBeTruthy();
  });
});
