import logging
from uuid import UUID

from fastapi import FastAPI, HTTPException

from .schemas import Problema, Solucao
from .solver import cancelar_operacao, resolver

logger = logging.getLogger("nurseflow.optimizer")

app = FastAPI(
    title="NurseFlow — Otimizador de escalas",
    description="Resolve a escala mensal (regime 24x72) com Google OR-Tools CP-SAT. Uso interno da API NestJS.",
    version="1.0.0",
)


@app.get("/saude")
def saude() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/otimizar", response_model=Solucao)
def otimizar(problema: Problema) -> Solucao:
    try:
        return resolver(problema)
    except RuntimeError as erro:
        logger.error("Falha na otimização: %s", erro)
        raise HTTPException(status_code=503, detail=str(erro)) from erro


@app.delete("/operacoes/{operacao_id}")
def cancelar(operacao_id: UUID) -> dict[str, bool]:
    solver_ativo = cancelar_operacao(str(operacao_id))
    return {"cancelamentoSolicitado": True, "solverAtivo": solver_ativo}
