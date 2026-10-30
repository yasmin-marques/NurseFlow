from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app

client = TestClient(app)


def corpo(**extra):
    base = {
        "ano": 2026,
        "mes": 9,
        "dias_mes": 30,
        "profissionais": [{"id": "e1", "formacao": "enfermeiro", "carga_24h": 2, "carga_12h": 0}],
        "setores": [
            {
                "id": "s1",
                "nome": "UTI",
                "turnos": {
                    "diurno": {"enfermeiros": 1, "tecnicos": 0},
                    "noturno": {"enfermeiros": 1, "tecnicos": 0},
                },
            }
        ],
        "parametros": {"tempo_limite_segundos": 10},
    }
    base.update(extra)
    return base


def test_saude():
    assert client.get("/saude").json() == {"status": "ok"}


def test_otimizar_retorna_alocacoes_e_descobertos():
    res = client.post("/otimizar", json=corpo())
    assert res.status_code == 200
    dados = res.json()
    assert len(dados["alocacoes"]) == 2
    assert dados["descobertos"], "um enfermeiro com carga 2 não cobre o mês"
    assert dados["estatisticas"]["status"] in ("OPTIMAL", "FEASIBLE")


def test_rejeita_dia_bloqueado_fora_do_mes():
    p = corpo()
    p["profissionais"][0]["dias_bloqueados"] = [31]
    assert client.post("/otimizar", json=p).status_code == 422


def test_rejeita_ids_duplicados():
    p = corpo()
    p["profissionais"].append(dict(p["profissionais"][0]))
    assert client.post("/otimizar", json=p).status_code == 422


def test_cancelamento_antes_do_solver_impede_a_otimizacao():
    operacao_id = str(uuid4())
    cancelamento = client.delete(f"/operacoes/{operacao_id}")
    assert cancelamento.status_code == 200
    assert cancelamento.json()["cancelamentoSolicitado"] is True
    assert cancelamento.json()["solverAtivo"] is False

    resposta = client.post("/otimizar", json=corpo(operacao_id=operacao_id))
    assert resposta.status_code == 503
    assert resposta.json()["detail"] == "Geração cancelada."
