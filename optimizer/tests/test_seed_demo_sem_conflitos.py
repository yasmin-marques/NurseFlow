"""Cenários de geração usados pelo seed de demonstração."""
from app.schemas import Parametros, Problema
from app.solver import resolver


def profissionais(dias_mes: int) -> list[dict]:
    carga_concursado = 7 if dias_mes == 31 else 6
    carga_clt = 5 if dias_mes == 31 else 6
    return [
        {
            "id": f"{formacao}-{vinculo}-{i}",
            "formacao": formacao,
            "vinculo": vinculo,
            "carga_24h": carga,
            "carga_12h": 0,
            "max_extras": 0,
            "max_plantoes": 12,
        }
        for formacao in ("enfermeiro", "tecnico")
        for vinculo, quantidade, carga in (
            ("concursado", 9, carga_concursado),
            ("clt", 6, carga_clt),
        )
        for i in range(quantidade)
    ]


def problema_demo(ano: int, mes: int, dias_mes: int) -> Problema:
    return Problema.model_validate(
        {
            "ano": ano,
            "mes": mes,
            "dias_mes": dias_mes,
            "profissionais": profissionais(dias_mes),
            "setores": [
                {
                    "id": setor,
                    "nome": setor,
                    "turnos": {
                        "diurno": {"enfermeiros": 1, "tecnicos": 1},
                        "noturno": {"enfermeiros": 1, "tecnicos": 1},
                    },
                }
                for setor in ("uti", "emergencia", "clinica-medica")
            ],
            "parametros": Parametros(tempo_limite_segundos=30).model_dump(),
        }
    )


def test_seed_demo_gera_outubro_com_cobertura_completa_e_sem_extras():
    solucao = resolver(problema_demo(2026, 10, 31))

    assert solucao.estatisticas.total_descobertos == 0
    assert not solucao.descobertos
    assert all(c.faltam_24h == 0 and c.faltam_12h == 0 and c.extras == 0 for c in solucao.estatisticas.cargas)
    assert all(alocacao.opcao == "24h" and not alocacao.extra for alocacao in solucao.alocacoes)
    assert len(solucao.alocacoes) == 31 * 3 * 2


def test_seed_demo_gera_novembro_com_cobertura_completa_e_sem_extras():
    solucao = resolver(problema_demo(2026, 11, 30))

    assert solucao.estatisticas.total_descobertos == 0
    assert not solucao.descobertos
    assert all(c.faltam_24h == 0 and c.faltam_12h == 0 and c.extras == 0 for c in solucao.estatisticas.cargas)
    assert all(alocacao.opcao == "24h" and not alocacao.extra for alocacao in solucao.alocacoes)
    assert len(solucao.alocacoes) == 30 * 3 * 2
