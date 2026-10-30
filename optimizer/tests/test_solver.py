"""Testes das restrições do modelo CP-SAT. Rodam com: pytest (dentro de optimizer/)."""
from collections import Counter
from threading import Event, Thread
from types import SimpleNamespace

from app.schemas import Parametros, Problema
import app.solver as solver_module
from app.solver import janela, resolver

DIAS = 30  # setembro: 30 dias


def setor(sid="s1", dia=(1, 1), noite=(1, 1)):
    return {
        "id": sid,
        "nome": sid,
        "turnos": {
            "diurno": {"enfermeiros": dia[0], "tecnicos": dia[1]},
            "noturno": {"enfermeiros": noite[0], "tecnicos": noite[1]},
        },
    }


def prof(pid, formacao="enfermeiro", c24=6, c12=1, extras=0, **kw):
    return {"id": pid, "formacao": formacao, "carga_24h": c24, "carga_12h": c12, "max_extras": extras, **kw}


def problema(profs, setores, dias=DIAS, tempo=20):
    return Problema.model_validate(
        {
            "ano": 2026,
            "mes": 9,
            "dias_mes": dias,
            "profissionais": profs,
            "setores": setores,
            "parametros": Parametros(tempo_limite_segundos=tempo).model_dump(),
        }
    )


def por_profissional(sol):
    mapa = {}
    for a in sol.alocacoes:
        mapa.setdefault(a.profissional_id, []).append(a)
    return mapa


# ---------- 24x72 ----------
def test_respeita_descanso_24x72_e_nao_sobrepoe_plantoes():
    profs = [prof(f"e{i}", c24=7, c12=0) for i in range(8)]
    sol = resolver(problema(profs, [setor(dia=(2, 0), noite=(2, 0))]))
    for pid, aloc in por_profissional(sol).items():
        janelas = sorted((janela(a.dia - 1, a.opcao), a.opcao) for a in aloc)
        for ((_i1, f1), o1), ((i2, _f2), _o2) in zip(janelas, janelas[1:]):
            descanso = 72 if o1 == "24h" else 36
            assert i2 >= f1 + descanso, f"{pid}: descanso violado ({o1})"


def test_regime_24x72_limita_a_8_plantoes_de_24h_em_mes_de_31_dias():
    # 1 enfermeiro (sem extras) diante de demanda contínua: 24x72 permite no máximo um plantão a cada 4 dias.
    sol = resolver(problema([prof("e1", c24=8, c12=0, extras=0)], [setor(dia=(1, 0), noite=(1, 0))], dias=31))
    assert len(sol.alocacoes) <= 8
    assert sol.estatisticas.total_descobertos > 0


# ---------- disponibilidade / ausências ----------
def test_nao_aloca_em_dias_bloqueados():
    bloqueados = list(range(1, 16))  # primeira quinzena indisponível (férias/ausência/indisponível)
    profs = [prof("e1", c24=3, c12=0, dias_bloqueados=bloqueados), prof("e2", c24=3, c12=0)]
    sol = resolver(problema(profs, [setor(dia=(1, 0), noite=(1, 0))]))
    dias_e1 = [a.dia for a in por_profissional(sol).get("e1", [])]
    assert dias_e1, "e1 deveria receber plantões na segunda quinzena"
    assert not set(dias_e1) & set(bloqueados)


def test_respeita_descanso_herdado_do_mes_anterior():
    # Último plantão de 24h terminou às 07:00 do dia 1 (hora 7): livre só a partir da hora 7 + 72 = 79 (dia 4, 07:00).
    p = prof("e1", c24=3, c12=0, livre_a_partir_horas=79)
    sol = resolver(problema([p], [setor(dia=(1, 0), noite=(1, 0))]))
    assert sol.alocacoes
    assert min(a.dia for a in sol.alocacoes) >= 4


# ---------- quantitativo mínimo ----------
def test_cobre_quantitativo_minimo_quando_ha_gente_suficiente():
    enf = [prof(f"e{i}", c24=7, c12=0) for i in range(10)]
    tec = [prof(f"t{i}", "tecnico", c24=7, c12=0) for i in range(10)]
    sol = resolver(problema(enf + tec, [setor(dia=(2, 2), noite=(2, 2))]))
    assert sol.estatisticas.total_descobertos == 0
    cobertura = Counter()
    formacao = {p["id"]: p["formacao"] for p in enf + tec}
    for a in sol.alocacoes:
        turnos = ("diurno", "noturno") if a.opcao == "24h" else (("diurno",) if a.opcao == "12d" else ("noturno",))
        for t in turnos:
            cobertura[(a.dia, t, formacao[a.profissional_id])] += 1
    for dia in range(1, DIAS + 1):
        for t in ("diurno", "noturno"):
            assert cobertura[(dia, t, "enfermeiro")] >= 2
            assert cobertura[(dia, t, "tecnico")] >= 2


def test_turno_selecionado_restringe_opcoes_e_nao_avalia_turno_fora_do_escopo():
    p = problema(
        [prof("e1", c24=0, c12=2, extras=0)],
        [setor(dia=(1, 0), noite=(1, 0))],
    )
    p.turnos_selecionados = ["diurno"]

    sol = resolver(p)

    assert sol.alocacoes
    assert all(a.opcao == "12d" for a in sol.alocacoes)
    assert all(d.turno == "diurno" for d in sol.descobertos)


def test_tecnico_nao_cobre_vaga_de_enfermeiro():
    sol = resolver(problema([prof("t1", "tecnico", c24=0, c12=0, extras=8)], [setor(dia=(1, 0), noite=(1, 0))]))
    assert sol.alocacoes == []
    assert all(d.funcao == "enfermeiros" for d in sol.descobertos)
    assert sol.estatisticas.total_descobertos == 2 * DIAS


def test_cancelamento_interrompe_solver_ativo(monkeypatch):
    iniciado = Event()
    interrompido = Event()

    class SolverFalso:
        def __init__(self):
            self.parameters = SimpleNamespace()

        def Solve(self, _modelo):
            iniciado.set()
            interrompido.wait(timeout=3)
            return 0

        def StopSearch(self):
            interrompido.set()

    monkeypatch.setattr(solver_module.cp_model, "CpSolver", SolverFalso)
    entrada = problema([prof("e1")], [setor()])
    entrada.operacao_id = "operacao-teste-cancelamento"
    erros = []

    def executar():
        try:
            resolver(entrada)
        except RuntimeError as erro:
            erros.append(str(erro))

    thread = Thread(target=executar)
    thread.start()
    assert iniciado.wait(timeout=3)
    assert solver_module.cancelar_operacao(entrada.operacao_id) is True
    thread.join(timeout=3)

    assert not thread.is_alive()
    assert erros == ["Geração cancelada."]


# ---------- vagas descobertas sem violar restrições ----------
def test_informa_vagas_descobertas_sem_violar_restricoes():
    profs = [prof("e1", c24=7, c12=0), prof("e2", c24=7, c12=0, dias_bloqueados=list(range(1, 31)))]
    sol = resolver(problema(profs, [setor(dia=(1, 0), noite=(1, 0))]))
    assert sol.descobertos, "um enfermeiro só não cobre os 30 dias"
    assert "e2" not in por_profissional(sol)
    for d in sol.descobertos:
        assert d.faltam == d.necessario - d.alocado > 0
    for aloc in por_profissional(sol).values():
        janelas = sorted(janela(a.dia - 1, a.opcao) for a in aloc)
        assert all(b[0] >= a[1] + 36 for a, b in zip(janelas, janelas[1:]))


# ---------- carga por vínculo, extras ----------
def test_carga_regular_por_vinculo_e_marcacao_de_extras():
    # Sem demanda no setor, cada um cumpre exatamente a própria carga e nenhum plantão é extra.
    profs = [prof("conc", c24=6, c12=1, extras=1), prof("clt", c24=8, c12=0)]
    sol = resolver(problema(profs, [setor(dia=(0, 0), noite=(0, 0))], dias=31))
    cargas = {c.profissional_id: c for c in sol.estatisticas.cargas}
    assert (cargas["conc"].plantoes_24h, cargas["conc"].plantoes_12h) == (6, 1)
    assert (cargas["clt"].plantoes_24h, cargas["clt"].plantoes_12h) == (8, 0)
    assert not any(a.extra for a in sol.alocacoes)


def test_extras_respeitam_o_limite_configurado():
    # Demanda alta, 2 enfermeiros com carga 2 e até 1 extra cada: no máximo (2+1) plantões 24h cada.
    profs = [prof("e1", c24=2, c12=0, extras=1), prof("e2", c24=2, c12=0, extras=1)]
    sol = resolver(problema(profs, [setor(dia=(1, 0), noite=(1, 0))]))
    for c in sol.estatisticas.cargas:
        assert c.plantoes_24h + c.plantoes_12h <= 3
        assert c.extras <= 1
    extras = [a for a in sol.alocacoes if a.extra]
    assert len(extras) == sum(c.extras for c in sol.estatisticas.cargas)


def test_sem_extras_permitidos_nao_ultrapassa_a_carga():
    profs = [prof("e1", c24=2, c12=0, extras=0), prof("e2", c24=2, c12=0, extras=0)]
    sol = resolver(problema(profs, [setor(dia=(1, 0), noite=(1, 0))]))
    for c in sol.estatisticas.cargas:
        assert c.plantoes_24h <= 2 and c.extras == 0


def test_rpa_sem_carga_fixa_cobre_vagas_como_extra():
    profs = [prof("rpa", c24=0, c12=0, extras=8), prof("e1", c24=2, c12=0)]
    sol = resolver(problema(profs, [setor(dia=(1, 0), noite=(1, 0))], dias=31))
    aloc = por_profissional(sol)
    assert all(a.extra for a in aloc["rpa"])
    assert not any(a.extra for a in aloc["e1"])


def test_teto_total_de_plantoes_no_mes():
    p = prof("e1", c24=7, c12=0, extras=5, max_plantoes=3)
    sol = resolver(problema([p], [setor(dia=(1, 0), noite=(1, 0))]))
    assert len(sol.alocacoes) <= 3


# ---------- setores ----------
def test_cada_plantao_ocupa_um_unico_setor():
    profs = [prof(f"e{i}", c24=7, c12=0) for i in range(6)]
    sol = resolver(problema(profs, [setor("a", dia=(1, 0), noite=(1, 0)), setor("b", dia=(1, 0), noite=(1, 0))]))
    vistos = Counter((a.profissional_id, a.dia, a.opcao) for a in sol.alocacoes)
    assert all(v == 1 for v in vistos.values())
