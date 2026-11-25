# NurseFlow — Otimizador de escalas

Serviço FastAPI + Google OR-Tools (CP-SAT) usado **somente** pela API NestJS. Não acessa o banco: recebe o problema pronto e devolve alocações e vagas descobertas.

- `POST /otimizar` — corpo/resposta em `app/schemas.py` (documentação interativa em `/docs`).
- `plantao24h` é o mínimo por função em cada turno: um plantão de 24h cobre diurno e noturno; um plantão regular de 12h cobre apenas seu turno.
- A carga regular é uma meta flexível priorizada após a cobertura; déficits são retornados sem tornar a geração inviável.
- Plantões de 24h e 12h respeitam seus descansos mínimos, disponibilidade e limites de extras.
- `GET /saude` — healthcheck.
- Modelo e restrições: `app/solver.py` (docstring no topo).

```bash
docker compose -f ../db/docker-compose.yml up -d --build --wait optimizer   # http://localhost:8000
docker run --rm -v "$PWD:/w" -w /w python:3.12-slim sh -c "pip install -q -r requirements-dev.txt && pytest -q"
```
