# Tasks

## 1. Contrato e compatibilidade

- [x] 1.1 Revisar o modelo atual de restrições em `back-end/src/restricoes/` e `front-end/src/services/restriction.ts` e verificar o contrato de entrada/saída para disponibilidade, vínculo externo e ausência; confirmar compatibilidade com registros legados.
- [x] 1.2 Definir o contrato explícito de API para `tipo`, `inicio`, `fim`, `diaSemana`, `turno`, `motivo`, `observacao`, `profissionalId` e `_id`, e verificar que a documentação do delta em `specs/gestao-escalas/spec.md` reflita esse contrato.

## 2. Backend e migrações

- [x] 2.1 Ajustar DTO, schema e service de restrições para aceitar `motivo` separado de `observacao`, `turno` quando aplicável e profissional referenciado por ID; verificar 400/404/409 esperados.
- [x] 2.2 Atualizar as migrações MongoDB para aceitar campos do contrato novo e preservar registros históricos antigos; verificar a validação do conjunto `restricoes` em banco existente.
- [x] 2.3 Garantir operação atômica para recorrências semanais e rejeitar criação parcial; verificar com testes de conflito e persistência.

## 3. Front-end e edição real

- [x] 3.1 Ajustar `front-end/src/pages/Disponibility/components/AvailabilityFormModal.tsx` para representar motivo, turno/horário, dias e vigência em dados estruturados e não concatenados em texto livre.
- [x] 3.2 Atualizar `front-end/src/services/restriction.ts` para buscar profissionais por ID, persistir e editar registros reais, e não depender de nome para identificação.
- [x] 3.3 Validar que a tela de disponibilidade usa o estado correto de edição, recarga após salvar/excluir e evita bloqueios por `observacao`/`ruleType` incompatíveis.

## 4. Testes e validação

- [x] 4.1 Adicionar testes de API para disponibilidade por turno, vínculo externo com horário e ausência com motivo separado; verificar `back-end/test/restricoes-configuracoes.e2e-spec.ts`.
- [x] 4.2 Adicionar regressão para compatibilidade com registros existentes e recorrência semanal sem persistência parcial; verificar o fluxo e2e e a coleção MongoDB do banco de testes.
- [x] 4.3 Executar a suíte relevante de restrições e confirmar que os critérios de aceite do delta são satisfeitos.
