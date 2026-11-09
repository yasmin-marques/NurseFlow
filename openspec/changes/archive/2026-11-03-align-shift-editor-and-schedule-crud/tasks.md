# Tasks

## 1. Auditar o CRUD e suas referências

- [x] 1.1 Mapear criação, geração, listagem, detalhe, inclusão, pré-validação, edição unitária/em lote, revisão, validação, publicação e remoção de rascunho contra requisitos, diagramas, OpenSpec e casos da planilha; verificar o mapa com a cobertura existente em `back-end/test/escalas.e2e-spec.ts` e `front-end/src/services/scales.test.ts`.
- [x] 1.2 Registrar testes de regressão para cada divergência confirmada pela auditoria, incluindo seleção/inferência do enfermeiro-chefe, criação manual e consistência entre configuração setorial e pendências; executar os testes focados correspondentes.

## 2. Corrigir pré-validação e persistência de cobertura

- [x] 2.1 Fazer a pré-validação do lote retornar pendências por setor, data, turno e função, calculadas com os mínimos configurados e a mesma regra usada na persistência; testar plantões de 12h/24h e a contagem do enfermeiro-chefe entre os enfermeiros.
- [x] 2.2 Implementar confirmação explícita de cobertura abaixo do mínimo sem permitir que ela ignore conflitos impeditivos; persistir a decisão na auditoria junto com o lote e verificar atomicidade, revisão concorrente e histórico com testes E2E.
- [x] 2.3 Corrigir divergências encontradas na inclusão e edição unitária para atualizar mínimos e pendências dos escopos anterior e novo; executar os testes unitários de regras de plantão e os E2E de inclusão/edição.
- [x] 2.4 Permitir regeneração confirmada de escala validada ainda não publicada, preservando estados e snapshots publicados; cobrir a atualização de status/revisão e a rejeição de substituição sem confirmação com testes front-end e E2E.

## 3. Alinhar modal e criação manual

- [x] 3.1 Implementar os estados fechado e de inclusão dos protótipos, separando profissional em foco e enfermeiro-chefe e oferecendo busca de técnico cadastrado com seleção de 24h/diurno/noturno aplicada ao plantão inteiro; validar comportamento e acessibilidade com testes do modal.
- [x] 3.2 Corrigir a seleção inicial do enfermeiro-chefe para usar os valores reais do cadastro e nunca inferir liderança pela ordem da equipe; cobrir profissional sem liderança registrada e seleção explícita com testes de interface.
- [x] 3.3 Completar a criação manual com entrada para criar rascunho vazio, seleção de turno e apresentação da cobertura prevista; exigir reconhecimento explícito quando abaixo do mínimo e verificar a inclusão sem conflito e com alerta por testes de interface e serviço.

## 4. Exibir liderança e validar o fluxo integral

- [x] 4.1 Destacar o enfermeiro-chefe no plantão correspondente da revisão por data/turno e informar quando não houver liderança, sem promovê-la automaticamente; validar com testes da revisão.
- [x] 4.2 Atualizar os casos funcionais/documentação afetados e executar os testes focados de escala no front-end e back-end; confirmar que revisão, autorização, versionamento, publicação e remoção de rascunho mantêm os comportamentos existentes.
