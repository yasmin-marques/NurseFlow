"""Modelo CP-SAT da escala mensal.

Unidade de decisão: o profissional `p` inicia, no dia `d`, um plantão do tipo `o` no setor `s`.

  24h  07:00 -> 07:00 (dia seguinte)  cobre o mínimo diário do setor
  12d  07:00 -> 19:00                 cobre o mínimo do turno diurno
  12n  19:00 -> 07:00 (dia seguinte)  cobre o mínimo do turno noturno

Restrições obrigatórias (duras):
  * setor fixo: o profissional só é alocado no setor do seu cadastro (`setor_id`) — as variáveis de
    outros setores nem chegam a ser criadas, então nunca há alocação cruzada para cobrir vaga;
  * cada plantão ocupa um único setor e o profissional não faz dois plantões ao mesmo tempo;
  * descanso mínimo após cada plantão: 72 h após 24h (regime 24x72) e 36 h após 12h;
  * dia ou turno de início bloqueado (férias, ausência, indisponibilidade, vínculo externo...) não é alocado;
  * disponibilidade por turno e dias fixos recorrentes respeitados;
  * descanso herdado do mês anterior;
  * teto de extras por profissional e teto total de plantões no mês;
  * cada função (enfermeiro/técnico) só é coberta por profissionais da respectiva formação.

O quantitativo mínimo é flexibilizado por uma variável de folga: se faltar gente, a vaga é
devolvida como "descoberta" em vez de violar uma restrição dura. A escala regular não ultrapassa
esse quantitativo; alocações fixas são preservadas mesmo se excederem a demanda.

Objetivo (em ordem de importância): menos vagas descobertas > menor déficit de carga regular >
menos extras > menos sobra de cobertura > extras distribuídos de forma equilibrada.
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


def compativel_com_horarios_bloqueados(profissional, dia: int, opcao: str, par) -> bool:
    inicio, fim = janela(dia, opcao)
    descanso_candidato = par.descanso_apos_24h if opcao == "24h" else par.descanso_apos_12h
    for bloqueio in profissional.horarios_bloqueados:
        if (
            opcao == "12d"
            and bloqueio.opcao == "12n"
            and bloqueio.inicio_horas // 24 == dia
        ) or (
            opcao == "12n"
            and bloqueio.opcao == "12d"
            and bloqueio.inicio_horas // 24 == dia
        ):
            continue
        antes_do_bloqueio = inicio >= bloqueio.fim_horas + bloqueio.descanso_apos_horas
        depois_do_bloqueio = bloqueio.inicio_horas >= fim + descanso_candidato
        if not antes_do_bloqueio and not depois_do_bloqueio:
            return False
    return True


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
    setor_por_id = {s.id: si for si, s in enumerate(setores)}
    prof_por_id = {p.id: pi for pi, p in enumerate(profs)}
    fixas_por_chave: dict[tuple[int, int, int, str], str] = {}
    for fixa in problema.alocacoes_fixas:
        chave = (prof_por_id[fixa.profissional_id], setor_por_id[fixa.setor_id], fixa.dia - 1, fixa.opcao)
        if chave in fixas_por_chave:
            raise RuntimeError(f"Alocações fixas incompatíveis para o extra {fixa.extra_id}.")
        fixas_por_chave[chave] = fixa.extra_id
    fixas_por_profissional_dia: dict[tuple[int, int], set[str]] = defaultdict(set)
    for pi, _si, dia, opcao in fixas_por_chave:
        fixas_por_profissional_dia[(pi, dia)].add(opcao)

    for pi, p in enumerate(profs):
        # Setor fixo (restrição dura): sem setor válido no problema, o profissional não é elegível.
        setores_elegiveis = [setor_por_id[p.setor_id]] if p.setor_id in setor_por_id else []
        if p.formacao == "tecnico" and setores_elegiveis:
            setor = setores[setores_elegiveis[0]]
            if setor.subsetores and p.subsetor_id not in {subsetor.id for subsetor in setor.subsetores}:
                setores_elegiveis = []
        bloqueados = set(p.dias_bloqueados)
        turnos_bloq = {(tb.dia, tb.turno) for tb in getattr(p, "turnos_bloqueados", [])}
        for d in range(n):
            if (d + 1) in bloqueados:
                continue
            fixas_no_dia = fixas_por_profissional_dia.get((pi, d), set())
            opcoes = set(fixas_no_dia)
            if p.carga_24h > 0 or p.max_extras > 0:
                opcoes.add("24h")
            if p.carga_12h > 0 or p.max_extras > 0:
                opcoes.update(("12d", "12n"))
            for o in (opcao for opcao in OPCOES if opcao in opcoes):
                turnos_opcao = set(cobre(o))
                if any((d + 1, t) in turnos_bloq for t in turnos_opcao):
                    continue
                if janela(d, o)[0] < p.livre_a_partir_horas:
                    continue
                if not compativel_com_horarios_bloqueados(p, d, o, par):
                    continue
                por_setor = []
                for si in setores_elegiveis:
                    v = modelo.NewBoolVar(f"x_{pi}_{si}_{d}_{o}")
                    x[(pi, si, d, o)] = v
                    por_setor.append(v)
                if por_setor:
                    yv = modelo.NewBoolVar(f"y_{pi}_{d}_{o}")
                    modelo.Add(sum(por_setor) == yv)
                    y[(pi, d, o)] = yv

    for chave, extra_id in fixas_por_chave.items():
        if chave not in x:
            raise RuntimeError(
                f"Alocação fixa inviável: {extra_id} não pode iniciar no dia/turno informado."
            )
        modelo.Add(x[chave] == 1)

    conflitos = pares_em_conflito(n, par.descanso_apos_24h, par.descanso_apos_12h)
    for pi in range(len(profs)):
        for a, b in conflitos:
            ya, yb = y.get((pi, a[0], a[1])), y.get((pi, b[0], b[1]))
            if ya is not None and yb is not None:
                modelo.Add(ya + yb <= 1)

    objetivo = []

    # Índices de cobertura por setor, dia, turno, formação e subsetor (quando aplicável).
    cobertura_regular_de: dict[tuple[int, int, str, str, str | None], list[cp_model.IntVar]] = defaultdict(list)
    cobertura_fixa_de: dict[tuple[int, int, str, str, str | None], list[cp_model.IntVar]] = defaultdict(list)
    for (pi, si, d, o), v in x.items():
        formacao = profs[pi].formacao
        setor = setores[si]
        subsetores = (
            [s.id for s in setor.subsetores if s.id == profs[pi].subsetor_id]
            if formacao == "tecnico" and setor.subsetores
            else [None]
        )
        for subsetor_id in subsetores:
            for turno in cobre(o):
                chave = (si, d, turno, formacao, subsetor_id)
                if (pi, si, d, o) in fixas_por_chave:
                    cobertura_fixa_de[chave].append(v)
                else:
                    cobertura_regular_de[chave].append(v)

    folgas = {}
    alvos_cobertura = []
    for si, setor in enumerate(setores):
        for d in range(n):
            alvos = [("enfermeiros", "enfermeiro", None, setor.plantao24h.enfermeiros)]
            if setor.subsetores:
                alvos.extend(
                    ("tecnicos", "tecnico", subsetor.id, subsetor.tecnicos)
                    for subsetor in setor.subsetores
                )
            else:
                alvos.append(("tecnicos", "tecnico", None, setor.plantao24h.tecnicos))
            for funcao, formacao, subsetor_id, necessario in alvos:
                for turno in ("diurno", "noturno"):
                    chave = (si, d, turno, formacao, subsetor_id)
                    alvos_cobertura.append((si, d, turno, funcao, necessario, chave))

    max_sobra_total = sum(
        max(
            0,
            len(cobertura_regular_de.get(chave, []))
            + len(cobertura_fixa_de.get(chave, []))
            - necessario,
        )
        for _si, _d, _turno, _funcao, necessario, chave in alvos_cobertura
    )
    max_extras_total = sum(p.max_extras for p in profs)
    max_equilibrio_extras = max((p.max_extras for p in profs), default=0)
    max_deficit_carga = sum(p.carga_24h + p.carga_12h for p in profs)
    custo_sobra_maximo = PESO_SOBRA * max_sobra_total
    peso_extra = custo_sobra_maximo + PESO_EQUILIBRIO_EXTRAS * max_equilibrio_extras + 1
    custo_extra_maximo = (
        max_extras_total * peso_extra
        + custo_sobra_maximo
        + PESO_EQUILIBRIO_EXTRAS * max_equilibrio_extras
    )
    peso_carga = custo_extra_maximo + 1
    peso_descoberto = max_deficit_carga * peso_carga + custo_extra_maximo + 1

    for alvo_idx, (si, d, turno, funcao, necessario, chave) in enumerate(alvos_cobertura):
        cobertura_regular_vars = cobertura_regular_de.get(chave, [])
        cobertura_fixa = cobertura_fixa_de.get(chave, [])
        cobertura_regular = sum(cobertura_regular_vars)
        cobertura = cobertura_regular + sum(cobertura_fixa)
        max_sobra = max(0, len(cobertura_regular_vars) + len(cobertura_fixa) - necessario)
        sobra = modelo.NewIntVar(0, max_sobra, f"sobra_{alvo_idx}")
        modelo.Add(sobra >= cobertura - necessario)
        objetivo.append(PESO_SOBRA * sobra)
        if necessario > 0:
            folga = modelo.NewIntVar(0, necessario, f"folga_{alvo_idx}")
            modelo.Add(cobertura + folga >= necessario)
            objetivo.append(peso_descoberto * folga)
            folgas[(si, d, turno, funcao, chave[4])] = (folga, necessario)

    # Carga regular, extras e teto de plantões por profissional.
    por_prof_vars: dict[int, list[tuple[str, cp_model.IntVar]]] = defaultdict(list)
    for (pi, _si, _d, o), v in x.items():
        por_prof_vars[pi].append((o, v))

    contagens = {}
    extras_vars = []
    for pi, p in enumerate(profs):
        vars_regulares = [(o, v) for (p_i, _si, _d, o), v in x.items() if p_i == pi and (p_i, _si, _d, o) not in fixas_por_chave]
        n24 = sum(v for o, v in vars_regulares if o == "24h")
        n12 = sum(v for o, v in vars_regulares if o != "24h")
        fixas24 = sum(1 for p_i, _si, _d, o in fixas_por_chave if p_i == pi and o == "24h")
        fixas12 = sum(1 for p_i, _si, _d, o in fixas_por_chave if p_i == pi and o != "24h")
        teto = 3 * n
        inferidos24 = modelo.NewIntVar(0, teto, f"inferidos24_{pi}")
        inferidos12 = modelo.NewIntVar(0, teto, f"inferidos12_{pi}")
        e24 = modelo.NewIntVar(0, teto, f"e24_{pi}")
        e12 = modelo.NewIntVar(0, teto, f"e12_{pi}")
        modelo.Add(inferidos24 >= n24 + p.plantoes_regulares24_fora_escopo - p.carga_24h)
        modelo.Add(inferidos12 >= n12 + p.plantoes_regulares12_fora_escopo - p.carga_12h)
        modelo.Add(e24 == inferidos24 + fixas24)
        modelo.Add(e12 == inferidos12 + fixas12)
        modelo.Add(e24 + e12 + p.extras_fora_escopo <= p.max_extras)
        if p.max_plantoes > 0:
            modelo.Add(n24 + n12 + fixas24 + fixas12 + p.plantoes_fora_escopo <= p.max_plantoes)
        falta24 = modelo.NewIntVar(0, p.carga_24h, f"falta24_{pi}")
        falta12 = modelo.NewIntVar(0, p.carga_12h, f"falta12_{pi}")
        modelo.Add(falta24 >= p.carga_24h - n24 - p.plantoes_regulares24_fora_escopo)
        modelo.Add(falta12 >= p.carga_12h - n12 - p.plantoes_regulares12_fora_escopo)
        objetivo.append(peso_carga * (falta24 + falta12))
        objetivo.append(peso_extra * (e24 + e12))
        extras_vars.append(e24 + e12 + p.extras_fora_escopo)
        contagens[pi] = (e24, e12, inferidos24, inferidos12)

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
        e24, e12, inferidos24, inferidos12 = contagens[pi]
        v24, v12 = solver.Value(e24), solver.Value(e12)
        vi24, vi12 = solver.Value(inferidos24), solver.Value(inferidos12)
        lista = sorted(por_prof.get(pi, []))
        l24_todos = [t for t in lista if t[2] == "24h"]
        l12_todos = [t for t in lista if t[2] != "24h"]
        l24 = [t for t in l24_todos if (pi, t[1], t[0], t[2]) not in fixas_por_chave]
        l12 = [t for t in l12_todos if (pi, t[1], t[0], t[2]) not in fixas_por_chave]
        extras_marcados.update((pi, d, o) for p_i, _s, d, o in fixas_por_chave if p_i == pi)
        for d, _s, o in (l24[len(l24) - vi24 :] if vi24 else []) + (l12[len(l12) - vi12 :] if vi12 else []):
            extras_marcados.add((pi, d, o))
        cargas.append(
            CargaProfissional(
                profissional_id=p.id,
                plantoes_24h=len(l24_todos) + p.plantoes_regulares24_fora_escopo,
                plantoes_12h=len(l12_todos) + p.plantoes_regulares12_fora_escopo,
                extras=v24 + v12 + p.extras_fora_escopo,
                faltam_24h=max(0, p.carga_24h - len(l24) - p.plantoes_regulares24_fora_escopo),
                faltam_12h=max(0, p.carga_12h - len(l12) - p.plantoes_regulares12_fora_escopo),
            )
        )

    alocacoes = [
        Alocacao(
            profissional_id=profs[pi].id,
            setor_id=setores[si].id,
            dia=d + 1,
            opcao=o,
            extra=(pi, d, o) in extras_marcados,
            extra_id=fixas_por_chave.get((pi, si, d, o)),
        )
        for pi, si, d, o in escolhidos
    ]

    descobertos = []
    for (si, d, turno, funcao, subsetor_id), (folga, necessario) in folgas.items():
        faltam = solver.Value(folga)
        if faltam > 0:
            descobertos.append(
                Descoberto(
                    setor_id=setores[si].id,
                    subsetor_id=subsetor_id,
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
        versao_contrato=problema.versao_contrato,
        capacidades=problema.capacidades,
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
