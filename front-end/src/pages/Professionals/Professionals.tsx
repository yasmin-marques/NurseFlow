import { useState } from "react";
import { Filter, Plus, Search } from "../../components/icons";
import { ProfessionalCard } from "./components/ProfesssionalCard";
import { filterProfessionals, ProfessionalFiltersModal, type ProfessionalFilters } from "./components/ProfessionalFiltersModal";
import type { Professional as ProfessionalData } from "./types";

const professionals: ProfessionalData[] = [
    {
        name: "Ana Clara Souza",
        cpf: "123.456.789-01",
        email: "ana.souza@nurseflow.com",
        coren: "COREN-CE 123456",
        bond: "CLT",
        status: true,
        formation: "Enfemeiro",
    },
    {
        name: "Rafael Martins Lima",
        cpf: "234.567.890-12",
        email: "rafael.lima@nurseflow.com",
        coren: "COREN-CE 234567",
        bond: "Concursado",
        status: true,
        formation: "Técnico",
    },
    {
        name: "Mariana Oliveira Costa",
        cpf: "345.678.901-23",
        email: "mariana.costa@nurseflow.com",
        coren: "COREN-CE 345678",
        bond: "RPA",
        status: false,
        formation: "Enfemeiro",
    },
    {
        name: "João Pedro Almeida",
        cpf: "456.789.012-34",
        email: "joao.almeida@nurseflow.com",
        coren: "COREN-CE 456789",
        bond: "CLT",
        status: true,
        formation: "Técnico",
    },
];

export function Professional() {
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<ProfessionalFilters>({
        formation: "all",
        status: "all",
        bond: "all",
        sort: "asc",
    });
    const visibleProfessionals = filterProfessionals(professionals, filters);

    return (
        <>
            <div className="flex min-h-full w-full flex-col px-5 py-6 sm:px-7 lg:px-10 xl:px-12">
                <div className="flex justify-between items-center">
                    <header className="mb-6">
                        <h2 className="text-[28px] font-bold leading-none tracking-[-0.04em] text-text">Profissionais</h2>
                        <p className="mt-2.5 text-[14px] text-text-muted">
                            {professionals.length} profissionais ativos na equipe.
                        </p>
                    </header>
                    <button className="flex p-4 bg-primary rounded-2xl text-amber-50 font-bold text-2xl">
                        <Plus /> Cadastrar profissional
                    </button>
                </div>
                <div className="g-12 p-4 md:p-12">
                    <div className="flex flex-col g-6 w-full rounded-3xl border border-border bg-white p-4 md:p-8 shadow-(--shadow-soft) sm:p-12">
                        <div className="flex w-full gap-4">
                            <div className="flex items-center border-2 bg-card-header w-2xl border-border rounded-2xl p-2">
                                <Search
                                    className="text-text-muted h-7 w-7"
                                />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome, CPF ou COREN"
                                    className="p-3 text-text-muted w-full rounded-2xl outline-0"
                                />
                            </div>
                            <button type="button" onClick={() => setShowFilters(true)} className="flex items-center gap-1 p-2 md:px-6 py-0.5 border-2 border-border rounded-2xl">
                                <Filter
                                    className="h-7 w-7"
                                />
                                <p className="font-bold text-sx">Filtros</p>
                            </button>
                        </div>
                        <hr className="my-6 text-border" />
                        <div className="flex flex-col gap-8">
                            {visibleProfessionals.map((professional) => (
                                <ProfessionalCard key={professional.cpf} {...professional} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {showFilters ? (
                <ProfessionalFiltersModal
                    initialFilters={filters}
                    onClose={() => setShowFilters(false)}
                    onApply={(nextFilters) => {
                        setFilters(nextFilters);
                        setShowFilters(false);
                    }}
                />
            ) : null}
        </>
    )
}
