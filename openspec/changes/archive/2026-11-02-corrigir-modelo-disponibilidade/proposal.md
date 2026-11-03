# Proposal

## Why

O modelo atual de disponibilidade e ausências mistura regras de negócio em texto livre, ignora turnos e vínculos externos em dados persistidos, e usa referência por nome em vez de ID. Isso impede edição real, recorrência semanal consistente e compatibilidade com registros existentes.

## What Changes

- Padronizar o registro de disponibilidade, vínculos externos e ausências com campos explícitos para motivo, observação, vigência, dia/turno e profissional por ID.
- Definir contratos de entrada e saída da API para restrições, incluindo regras de recorrência semanal, validação e compatibilidade com dados antigos.
- Corrigir a edição e a persistência real das restrições no front-end e no back-end, sem persistência parcial de recorrências semanais.
- Validar compatibilidade com registros já existentes e manter o comportamento de geração de escala sem quebrar históricos.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `gestao-escalas`: corrige a modelagem e a API de disponibilidade, vínculos externos, ausências e recorrências, mantendo compatibilidade com registros existentes e profissionais referenciados por ID.

## Impact

- `back-end/src/restricoes/`
- `back-end/migrations/`
- `front-end/src/services/restriction.ts`
- `front-end/src/pages/Disponibility/`
- consumo da API de escalas e regras de geração que usam `profissionalId` e restrições.
