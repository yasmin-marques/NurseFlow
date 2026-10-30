"""Modelo CP-SAT da escala mensal.

Unidade de decisão: o profissional `p` inicia, no dia `d`, um plantão do tipo `o` no setor `s`.

  24h  07:00 -> 07:00 (dia seguinte)  cobre o turno diurno E o noturno de `d`
  12d  07:00 -> 19:00                 cobre o turno diurno de `d`
  12n  19:00 -> 07:00 (dia seguinte)  cobre o turno noturno de `d`

Restrições obrigatórias (duras):
  * cada plantão ocupa um único setor e o profissional não faz dois plantões ao mesmo tempo;
  * descanso mínimo após cada plantão: 72 h após 24h (regime 24x72) e 36 h após 12h;
  * dia de início bloqueado (férias, ausência, indisponibilidade, vínculo externo...) não é alocado;
  * descanso herdado do mês anterior;
  * teto de extras por profissional e teto total de plantões no mês;
  * cada função (enfermeiro/técnico) só é coberta por profissionais da respectiva formação.

O quantitativo mínimo é flexibilizado por uma variável de folga: se faltar gente, a vaga é
devolvida como "descoberta" em vez de violar uma restrição dura.

Objetivo (em ordem de importância): menos vagas descobertas > menos extras > carga regular
completa > menos sobra de cobertura > extras distribuídos de forma equilibrada.
"""
from __future__ import annotations

import os
import time
from collections import defaultdict
from threading import Lock

from ortools.sat.python import cp_model

from .schemas import Alocacao, CargaProfissional, Descoberto, Estatisticas, Problema, Solucao

OPCOES = ("24h", "12d", "12n")
INICIO_DIURNO = 7
INICIO_NOTURNO = 19

PESO_DESCOBERTO = 10_000
PESO_EXTRA = 100
PESO_CARGA_FALTANTE = 30
PESO_SOBRA = 5
PESO_EQUILIBRIO_EXTRAS = 10
CANCELAMENTO_TTL_SEGUNDOS = 300

_lock_operacoes = Lock()
_solvers_ativos: dict[str, cp_model.CpSolver] = {}
_cancelamentos: dict[str, float] = {}


def _limpar_cancelamentos_expirados(agora: float) -> None:
    expirados = [operacao_id for operacao_id, expiracao in _cancelamentos.items() if expiracao <= agora]
    for operacao_id in expirados:
        _cancelamentos.pop(operacao_id, None)


def cancelar_operacao(operacao_id: str) -> bool:
    agora = time.monotonic()
    with _lock_operacoes:
        _limpar_cancelamentos_expirados(agora)
        _cancelamentos[operacao_id] = agora + CANCELAMENTO_TTL_SEGUNDOS
        solver = _solvers_ativos.get(operacao_id)
    if solver is not None:
        solver.StopSearch()
    return solver is not None


def _registrar_solver(operacao_id: str, solver: cp_model.CpSolver) -> None:
    with _lock_operacoes:
        _limpar_cancelamentos_expirados(time.monotonic())
        if operacao_id in _cancelamentos:
            raise RuntimeError("Geração cancelada.")
        _solvers_ativos[operacao_id] = solver


def _remover_solver(operacao_id: str) -> bool:
    with _lock_operacoes:
        _solvers_ativos.pop(operacao_id, None)
        return operacao_id in _cancelamentos


def janela(dia0: int, opcao: str) -> tuple[int, int]:
    """(início, fim) em horas desde 00:00 do dia 1. `dia0` é 0-based."""
    base = 24 * dia0
    if opcao == "24h":
        return base + INICIO_DIURNO, base + INICIO_DIURNO + 24
    if opcao == "12d":
        return base + INICIO_DIURNO, base + INICIO_NOTURNO
    return base + INICIO_NOTURNO, base + INICIO_NOTURNO + 12


def cobre(opcao: str) -> tuple[str, ...]:
    return {"24h": ("diurno", "noturno"), "12d": ("diurno",), "12n": ("noturno",)}[opcao]


def pares_em_conflito(dias_mes: int, descanso_24: int, descanso_12: int) -> list[tuple[tuple[int, str], tuple[int, str]]]:
    """Pares de plantões que um mesmo profissional não pode cumprir juntos."""
    opcoes = sorted(
        ((d, o) for d in range(dias_mes) for o in OPCOES),
        key=lambda x: (janela(*x)[0], janela(*x)[1]),
    )
    pares = []
    for i, a in enumerate(opcoes):
        _, fim_a = janela(*a)
        descanso = descanso_24 if a[1] == "24h" else descanso_12
        for b in opcoes[i + 1 :]:
            ini_b, _ = janela(*b)
            if ini_b >= fim_a + descanso:
                break
            # 12h diurno + 12h noturno no mesmo dia: extra programado de 12h previsto
            # no documento de requisitos (US25), sem "conflito indevido".
            if a[1] == "12d" and b[1] == "12n" and a[0] == b[0]:
                continue
            pares.append((a, b))
    return pares


def resolver(problema: Problema) -> Solucao:
    inicio_relogio = time.monotonic()
    n = problema.dias_mes
    par = problema.parametros
    modelo = cp_model.CpModel()
    profs, setores = problema.profissionais, problema.setores

    x: dict[tuple[int, int, int, str], cp_model.IntVar] = {}  # (p, s, d, o)
    y: dict[tuple[int, int, str], cp_model.IntVar] = {}  # (p, d, o): inicia plantão em algum setor
    turnos_selecionados = set(problema.turnos_selecionados)

    for pi, p in enumerate(profs):
        bloqueados = set(p.dias_bloqueados)
        for d in range(n):
            if (d + 1) in bloqueados:
                continue
            for o in OPCOES:
                turnos_opcao = set(cobre(o))
                if not turnos_opcao.issubset(turnos_selecionados):
                    continue
                if janela(d, o)[0] < p.livre_a_partir_horas:
                    continue
                por_setor = []
                for si in range(len(setores)):
                    v = modelo.NewBoolVar(f"x_{pi}_{si}_{d}_{o}")
                    x[(pi, si, d, o)] = v
                    por_setor.append(v)
                if por_setor:
                    yv = modelo.NewBoolVar(f"y_{pi}_{d}_{o}")
                    modelo.Add(sum(por_setor) == yv)
                    y[(pi, d, o)] = yv

    conflitos = pares_em_conflito(n, par.descanso_apos_24h, par.descanso_apos_12h)
    for pi in range(len(profs)):
        for a, b in conflitos:
            ya, yb = y.get((pi, a[0], a[1])), y.get((pi, b[0], b[1]))
            if ya is not None and yb is not None:
                modelo.Add(ya + yb <= 1)

    objetivo = []

    # Índices para somar rapidamente a cobertura de cada (setor, dia, turno, formação).
    cobertura_de: dict[tuple[int, int, str, str], list[cp_model.IntVar]] = defaultdict(list)
    for (pi, si, d, o), v in x.items():
        for turno in cobre(o):
            cobertura_de[(si, d, turno, profs[pi].formacao)].append(v)

    folgas = {}
    for si, setor in enumerate(setores):
        for d in range(n):
            for turno in ("diurno", "noturno"):
                if turno not in turnos_selecionados:
                    continue
                quant = getattr(setor.turnos, turno)
                for funcao, formacao in (("enfermeiros", "enfermeiro"), ("tecnicos", "tecnico")):
                    necessario = getattr(quant, funcao)
                    cobertura = sum(cobertura_de.get((si, d, turno, formacao), []))
                    sobra = modelo.NewIntVar(0, max(len(profs), 1), f"sobra_{si}_{d}_{turno}_{funcao}")
                    modelo.Add(sobra >= cobertura - necessario)
                    objetivo.append(PESO_SOBRA * sobra)
                    if necessario > 0:
                        folga = modelo.NewIntVar(0, necessario, f"folga_{si}_{d}_{turno}_{funcao}")
                        modelo.Add(cobertura + folga >= necessario)
                        objetivo.append(PESO_DESCOBERTO * folga)
                        folgas[(si, d, turno, funcao)] = (folga, necessario)

    # Carga regular, extras e teto de plantões por profissional.
    por_prof_vars: dict[int, list[tuple[str, cp_model.IntVar]]] = defaultdict(list)
    for (pi, _si, _d, o), v in x.items():
        por_prof_vars[pi].append((o, v))

    contagens = {}
    extras_vars = []
    for pi, p in enumerate(profs):
        n24 = sum(v for o, v in por_prof_vars[pi] if o == "24h")
        n12 = sum(v for o, v in por_prof_vars[pi] if o != "24h")
        teto = 3 * n
        e24 = modelo.NewIntVar(0, teto, f"e24_{pi}")
        e12 = modelo.NewIntVar(0, teto, f"e12_{pi}")
        f24 = modelo.NewIntVar(0, p.carga_24h, f"f24_{pi}")
        f12 = modelo.NewIntVar(0, p.carga_12h, f"f12_{pi}")
        modelo.Add(e24 >= n24 - p.carga_24h)
        modelo.Add(e12 >= n12 - p.carga_12h)
        modelo.Add(f24 >= p.carga_24h - n24)
        modelo.Add(f12 >= p.carga_12h - n12)
        modelo.Add(e24 + e12 <= p.max_extras)
        if p.max_plantoes > 0:
            modelo.Add(n24 + n12 <= p.max_plantoes)
        objetivo.append(PESO_EXTRA * (e24 + e12))
        objetivo.append(PESO_CARGA_FALTANTE * (f24 + f12))
        extras_vars.append(e24 + e12)
        contagens[pi] = (e24, e12, f24, f12)

    if extras_vars:
        maximo = modelo.NewIntVar(0, max([p.max_extras for p in profs] + [0]), "max_extras")
        for e in extras_vars:
            modelo.Add(maximo >= e)
        objetivo.append(PESO_EQUILIBRIO_EXTRAS * maximo)

    modelo.Minimize(sum(objetivo))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = par.tempo_limite_segundos
    solver.parameters.num_workers = max(1, min(8, os.cpu_count() or 1))
    solver.parameters.random_seed = par.semente
    operacao_id = problema.operacao_id
    if operacao_id:
        _registrar_solver(operacao_id, solver)
    try:
        status = solver.Solve(modelo)
    finally:
        cancelada = _remover_solver(operacao_id) if operacao_id else False
    if cancelada:
        raise RuntimeError("Geração cancelada.")
    nome_status = solver.StatusName(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"Otimizador não encontrou solução (status {nome_status}).")

    escolhidos = sorted((k for k, v in x.items() if solver.Value(v)), key=lambda k: (k[2], k[3], k[0], k[1]))
    por_prof: dict[int, list[tuple[int, int, str]]] = defaultdict(list)
    for pi, si, d, o in escolhidos:
        por_prof[pi].append((d, si, o))

    # Extras = plantões além da carga regular; marca os últimos do mês de cada duração.
    extras_marcados: set[tuple[int, int, str]] = set()
    cargas = []
    for pi, p in enumerate(profs):
        e24, e12, f24, f12 = contagens[pi]
        v24, v12 = solver.Value(e24), solver.Value(e12)
        lista = sorted(por_prof.get(pi, []))
        l24 = [t for t in lista if t[2] == "24h"]
        l12 = [t for t in lista if t[2] != "24h"]
        for d, _s, o in (l24[len(l24) - v24 :] if v24 else []) + (l12[len(l12) - v12 :] if v12 else []):
            extras_marcados.add((pi, d, o))
        cargas.append(
            CargaProfissional(
                profissional_id=p.id,
                plantoes_24h=len(l24),
                plantoes_12h=len(l12),
                extras=v24 + v12,
                faltam_24h=solver.Value(f24),
                faltam_12h=solver.Value(f12),
            )
        )

    alocacoes = [
        Alocacao(
            profissional_id=profs[pi].id,
            setor_id=setores[si].id,
            dia=d + 1,
            opcao=o,
            extra=(pi, d, o) in extras_marcados,
        )
        for pi, si, d, o in escolhidos
    ]

    descobertos = []
    for (si, d, turno, funcao), (folga, necessario) in folgas.items():
        faltam = solver.Value(folga)
        if faltam > 0:
            descobertos.append(
                Descoberto(
                    setor_id=setores[si].id,
                    dia=d + 1,
                    turno=turno,
                    funcao=funcao,
                    necessario=necessario,
                    alocado=necessario - faltam,
                    faltam=faltam,
                )
            )
    descobertos.sort(key=lambda t: (t.dia, t.setor_id, t.turno, t.funcao))

    return Solucao(
        alocacoes=alocacoes,
        descobertos=descobertos,
        estatisticas=Estatisticas(
            status=nome_status,
            otimo=status == cp_model.OPTIMAL,
            objetivo=solver.ObjectiveValue(),
            melhor_limite=solver.BestObjectiveBound(),
            tempo_segundos=round(time.monotonic() - inicio_relogio, 3),
            total_alocacoes=len(alocacoes),
            total_descobertos=sum(t.faltam for t in descobertos),
            cargas=cargas,
        ),
    )
