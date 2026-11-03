# Proposal

## Why

A geração automática de escalas ainda trata a disponibilidade como dado textual e incompleto, o que dificulta a correta aplicação de turnos, recorrência semanal e regras de descanso. O ajuste é necessário para que a alocação considere disponibilidade e indisponibilidade por turno como dados estruturados, reduzindo conflitos e evitando escalas inválidas.

## What Changes

- Aplicar a disponibilidade por turno e recorrência semanal no cálculo da escala automática.
- Separar turnos e dias de disponibilidade das observações livres em restrições e regras de funcionamento.
- Garantir que a geração de escalas respeite indisponibilidade por turno, dias fixos e conflitos de recorrência.
- Validar a escala gerada com base em regras de descanso e carga sem depender de texto livre em `observacao`.
- Documentar a mudança no modelo de dados e no fluxo de revisão/validação da escala.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `gestao-escalas`: ajusta a geração, validação e revisão de escalas para considerar disponibilidade por turno e recorrência semanal como dados estruturados.

## Impact

- Módulo de geração e revisão de escalas em [back-end/src/escalas](back-end/src/escalas)
- Modelo e regras de restrições/profissionais em [back-end/src/restricoes](back-end/src/restricoes) e [back-end/src/profissionais](back-end/src/profissionais)
- Fluxo de validação e cobertura da escala no otimizador e na API de escalas
- Dados de disponibilidade e recorrência já persistidos em banco, sem quebrar compatibilidade com registros legados
