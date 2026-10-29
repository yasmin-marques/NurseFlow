# NurseFlow — Otimizador de escalas

Serviço FastAPI + Google OR-Tools (CP-SAT) usado **somente** pela API NestJS. Não acessa o banco: recebe o problema pronto e devolve alocações e vagas descobertas.

- `POST /otimizar` — corpo/resposta em `app/schemas.py` (documentação interativa em `/docs`).
- `GET /saude` — healthcheck.
- Modelo e restrições: `app/solver.py` (docstring no topo).

```bash
docker compose -f ../db/docker-compose.yml up -d --build --wait optimizer   # http://localhost:8000
docker run --rm -v "$PWD:/w" -w /w python:3.12-slim sh -c "pip install -q -r requirements-dev.txt && pytest -q"
```
