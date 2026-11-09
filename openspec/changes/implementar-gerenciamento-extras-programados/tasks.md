# Tasks — Gerenciamento de Extras Programados

## 1. Conferência da base e contratos existentes

- [x] 1.1 Comparar o checkout atual com `proposal.md`, `design.md` e os deltas em `specs/`, identificando os módulos reais de escalas, restrições, profissionais, configurações e otimizador; verificar com uma nota de inventário no próprio repositório e sem alterar o escopo das Changes 02, 03 e 04.
- [x] 1.2 Confirmar no código e nas specs canônicas o contrato atual de `Plantao`, `PlantaoProfissional`, estados da escala, `origemCobertura`, tipos de vínculo e limites de extras; verificar registrando eventuais divergências e ajustando o design **antes** de implementar campos incompatíveis.
- [x] 1.3 Identificar o mecanismo existente de transações MongoDB, guards de Coordenação, erros HTTP, auditoria e testes E2E; verificar executando os testes-base relevantes e documentando os pontos de reutilização.

## 2. Persistência e identidade dos extras programados

- [x] 2.1 Criar o módulo `extras` e o schema independente `ExtraProgramado` com data civil, opção de jornada, setor, função, substituto, motivo, coberto opcional, situação, revisão e referências opcionais à escala; verificar por testes de validação/defaults e pela ausência de um array `extrasProgramados` em `Profissional`.
- [x] 2.2 Criar índices de consulta por período/setor/situação e por profissional/data, e proteção de unicidade para vínculo de alocação e duplicatas exatas ativas; verificar inspecionando os índices MongoDB e com testes de inserção duplicada.
- [x] 2.3 Implementar o registro de eventos `CRIADO`, `EDITADO`, `CANCELADO`, `VINCULADO` e `DESVINCULADO` com autor, revisão e timestamp, sem dados sensíveis desnecessários; verificar em teste que cada mutação bem-sucedida produz o evento correto e falhas não geram eventos espúrios.
- [x] 2.4 Centralizar a interpretação de `YYYY-MM-DD` e das opções `12d`, `12n` e `24h` como intervalos completos `[inicio, fim)`; verificar por testes de madrugada, virada de mês, fim de fevereiro e fronteiras de horário, sem deslocamento de data por fuso do navegador.
- [x] 2.5 Implementar controle transacional de revisão/reserva por profissional e período, ou mecanismo equivalente de serialização, para impedir escritas conflitantes em documentos distintos; verificar com teste concorrente de duas reservas incompatíveis em que apenas uma é persistida.
- [x] 2.6 Documentar a criação aditiva de coleções/índices, compatibilidade com registros legados e estratégia de rollback sem exclusão de históricos; verificar em ambiente de teste que os índices podem ser aplicados e os plantões antigos permanecem legíveis.

## 3. Validação central de elegibilidade e conflitos

- [x] 3.1 Implementar validação de setor ativo, função, situação profissional, identidade do substituto e exigência/compatibilidade do profissional coberto conforme o motivo; verificar com testes válidos e inválidos, inclusive substituto igual ao coberto e IDs inexistentes.
- [x] 3.2 Reutilizar as regras vigentes de disponibilidade, férias, ausências, turnos e vínculos externos para validar o **intervalo completo** da jornada extra; verificar com testes para `12n`/`24h` atravessando a meia-noite, sem declarar corrigida a geração regular da Change 02.
- [x] 3.3 Considerar alocações persistidas, reservas de outros extras e meses vizinhos ao identificar sobreposições e descanso mínimo; verificar com testes de conflitos intra/intermensais e de jornada permitida segundo a regra atual para `12d` + `12n` consecutivos.
- [x] 3.4 Aplicar os limites de extras e total de plantões já vigentes por vínculo e período, descontando uma única vez a própria alocação vinculada na revalidação; verificar com testes de limite atingido, CLT/concursado/RPA e edição do mesmo registro sem falsa duplicidade.
- [x] 3.5 Preservar a semântica efetiva atual de `0`/fallback das Configurações, sem introduzir regras da Change 03; verificar documentando o comportamento observado e cobrindo-o em teste de regressão.
- [x] 3.6 Consolidar erros de validação estruturados por regra/campo e garantir que falhas não deixam reservas, alterações ou eventos parciais; verificar por testes de rejeição e rollback transacional.

## 4. API de consulta, registro, edição e cancelamento

- [x] 4.1 Criar DTOs e rotas protegidas para `GET /extras`, `GET /extras/resumo`, `GET /extras/:id`, `POST /extras`, `PATCH /extras/:id` e `POST /extras/:id/cancelar`; verificar no Swagger os schemas, os filtros e o bloqueio de mutações sem Coordenação.
- [x] 4.2 Implementar `POST /extras` com validação final no servidor e gravação atômica de programação e auditoria, inclusive quando ainda não existir escala; verificar por E2E resposta `201`, persistência após nova consulta e ausência de `plantaoId` fictício.
- [x] 4.3 Implementar `PATCH /extras/:id` com `revisaoEsperada`, revalidação integral e atualização auditada; verificar por E2E edição válida, `409` para revisão obsoleta e preservação dos dados anteriores após falha.
- [x] 4.4 Implementar cancelamento lógico com justificativa e `revisaoEsperada`, sem exclusão física nem repetição de eventos; verificar por E2E que o registro permanece consultável, deixa de ser ativo e novo cancelamento não altera contagens.
- [x] 4.5 Implementar listagem paginada por mês/ano, busca, setor, motivo e situação, detalhe por ID e indicadores calculados a partir de dados persistidos; verificar por E2E filtros, página vazia, horas/extras ativos, RPAs ativos e cobertura sem escala (`sem_escala`).
- [x] 4.6 Cobrir códigos `400`, `401`, `403`, `404`, `409` e `422` nos testes de API, com mensagens e detalhes estáveis; verificar executando a suíte E2E de Extras e garantindo que requisições inválidas não alteram o banco.
- [x] 4.7 Documentar exemplos de payload, respostas, filtros, status de vínculo (`sem_escala`, `vinculado`, `pendente_conciliacao`) e erros no Swagger ou documentação de API; verificar reproduzindo os exemplos com requisições reais.

## 5. Conciliação entre extras programados e escalas editáveis

- [x] 5.1 Adicionar uma referência opcional e exclusiva `extraProgramadoId` à atribuição `PlantaoProfissional`, sem converter indevidamente alocações regulares ou extras legados; verificar por teste de schema que registros antigos continuam válidos.
- [x] 5.2 Implementar vinculação idempotente de extra ativo à atribuição correspondente de escala editável, com referências bidirecionais e auditoria na mesma transação; verificar por E2E que vincular duas vezes mantém uma única alocação e uma única cobertura.
- [x] 5.3 Implementar edição ou cancelamento de extra vinculado retirando/atualizando somente a atribuição afetada, recalculando pendências e invalidando validação obsoleta; verificar por E2E que outros profissionais no mesmo plantão não são removidos e a vaga volta a aparecer quando pertinente.
- [x] 5.4 Impedir mudanças diretas que afetem escalas `validada`, `publicada` ou `finalizada`, mantendo snapshots oficiais imutáveis; verificar por E2E rejeição de mutação e igualdade do snapshot antes/depois da tentativa.
- [x] 5.5 Garantir rollback de extra, vínculo, cobertura, revisão e auditoria caso alguma etapa da conciliação falhe; verificar com teste transacional que não sobra estado parcialmente atualizado.
- [x] 5.6 Documentar a relação entre `ExtraProgramado`, `Plantao`, `PlantaoProfissional`, `motivo`, `tipo` e `origemCobertura`; verificar que um extra CLT ou concursado e um extra RPA conservam suas identidades e são contabilizados uma única vez.

## 6. Geração e regeneração com extras fixos no otimizador

- [x] 6.1 Estender o contrato NestJS → Python para transportar `alocacoes_fixas` com `extra_id`, profissional, setor, dia, opção e identidade de extra; verificar em teste de serialização que um extra programado não perde seu identificador.
- [x] 6.2 Evoluir os schemas de entrada e saída do otimizador Python com validação explícita de `alocacoes_fixas` e versão/capacidade do contrato; verificar por testes de API que payload inválido ou solver incompatível falha explicitamente.
- [x] 6.3 Fixar no CP-SAT as atribuições programadas elegíveis e impedir outras atribuições incompatíveis para o mesmo profissional; verificar por teste do solver que a solução mantém substituto, setor, dia e turno exatos ou retorna inviabilidade, sem trocar silenciosamente a pessoa.
- [x] 6.4 Separar extras programados fixos de atribuições regulares e extras inferidos pela carga, sem dupla contagem de cobertura, limites ou total de plantões; verificar por testes do solver para vínculos RPA, CLT e concursado e resultados com tipos corretos.
- [x] 6.5 Preparar o problema usando extras ativos dentro e fora do escopo da geração: materializar somente os pertinentes, mas considerar os demais em reservas e conflitos; verificar por testes com dois setores e com plantão que cruza o limite do mês.
- [x] 6.6 Persistir e reconciliar os IDs dos extras a partir da resposta do solver em uma transação, preservando o cadastro/histórico durante regenerações; verificar por E2E duas gerações seguidas sem duplicação e com IDs estáveis de `ExtraProgramado`.
- [x] 6.7 Proteger a geração assíncrona com revisão/fingerprint das programações e rechecagem antes do commit; verificar por teste concorrente que edição/cancelamento durante o processamento impede substituir a escala antiga por resultado obsoleto.
- [x] 6.8 Cobrir falha do solver, solução inviável, mudança de contrato e erro de gravação sem perda da escala anterior ou desvinculação definitiva; verificar pelos testes NestJS/Python e por um teste de integração com solver real.
- [x] 6.9 Documentar contrato versionado, ordem compatível de implantação backend/optimizer e bloqueio seguro de geração com solver antigo; verificar em teste de integração a detecção de versão incompatível.

## 7. Página de consulta e indicadores de Extras

- [ ] 7.1 Criar `front-end/src/services/extras.ts` com tipos, tratamento de erros e chamadas reais às rotas, incluindo paginação e indicadores; verificar por testes de serviço com respostas de sucesso e erro, sem mock como fonte de dados em produção.
- [ ] 7.2 Implementar a página em `/extras` aproveitando layout, `Drawer` e componentes existentes, tomando `design/` como referência visual; verificar navegação pelo menu e renderização em desktop/mobile sem alterar módulos não relacionados.
- [ ] 7.3 Implementar navegação por mês, busca, filtros de setor/motivo/situação e paginação sincronizados com a API; verificar por testes da página que alterar filtros atualiza consulta e resultado e que estado vazio é apresentado corretamente.
- [ ] 7.4 Implementar cards e indicadores reais de extras, horas, RPAs e cobertura, distinguindo programação sem escala de cobertura efetivada; verificar por testes com dados distintos e exibição de “cobertura não calculada” quando aplicável.
- [ ] 7.5 Implementar loading, erro, retry, labels, foco de teclado e responsividade da consulta; verificar por testes de componentes e conferência manual em larguras móvel e desktop.

## 8. Formulários de registro, edição, cancelamento e RPA

- [ ] 8.1 Implementar o drawer **Registrar extra** com data, `12d`/`12n`/`24h`, setor, função, motivo, substituto e coberto condicional, reutilizando seletores existentes; verificar por teste de formulário que os campos obrigatórios mudam conforme o motivo.
- [ ] 8.2 Integrar o registro à API com estados de salvamento, validações por campo e preservação do formulário em falhas; verificar por teste que só fecha/atualiza a listagem depois de `201` e exibe corretamente `409`/`422`.
- [ ] 8.3 Implementar o drawer **Editar extra** carregando o registro e enviando `revisaoEsperada`; verificar por teste que alterações válidas atualizam listagem/indicadores e conflito de versão não sobrescreve a edição persistida.
- [ ] 8.4 Implementar **Cancelar extra** com confirmação e justificativa obrigatória, sem remoção física da listagem histórica; verificar por teste que o cancelado não entra no resumo de ativos e não pode ser cancelado novamente como novo evento.
- [ ] 8.5 Integrar **Cadastrar RPA** ao cadastro único existente de Profissionais, com tratamento de CPF duplicado e seleção posterior por ID; verificar por teste que um cadastro válido torna o RPA selecionável e que não há novo registro em caso de duplicidade.
- [ ] 8.6 Garantir visibilidade de estado de vínculo com escala, bloqueio de edição/cancelamento em escala oficial e mensagens acessíveis; verificar por testes de interface para `sem_escala`, `vinculado`, erro de permissão e escala publicada.
- [ ] 8.7 Documentar o fluxo de uso da tela (registro antecipado, cobertura, edição, cancelamento e RPA) e atualizar testes de componentes afetados; verificar que as instruções funcionam com a API real em ambiente de teste.

## 9. Verificações integradas e preparação da entrega

- [ ] 9.1 Executar ponta a ponta, com MongoDB em replica set, backend e otimizador reais, os fluxos: extra antes da escala, geração, revisão, regeneração, edição e cancelamento; verificar que nenhuma programação gera dupla cobertura ou gravação parcial.
- [ ] 9.2 Homologar casos adversos intermodulares: férias/ausência noturna, vínculo externo, conflito entre setores, limite mensal, concorrência e tentativa de alterar escala publicada; verificar respostas e snapshots com evidências de cada cenário dos dois deltas.
- [ ] 9.3 Rodar `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, `npm run build` e `npm run lint:check` no backend; verificar que todos terminam sem falhas introduzidas pela change.
- [ ] 9.4 Rodar `npm test -- --run`, `npm run build` e `npm run lint` no frontend e a suíte Python do otimizador no ambiente com dependências instaladas; verificar conclusão sem falhas introduzidas pela change.
- [ ] 9.5 Validar `openspec validate implementar-gerenciamento-extras-programados` e `git diff --check`, revisar `git status --short` e conferir que screenshots, specs, design e tarefas versionadas correspondem ao código; verificar saídas limpas e ausência de arquivos temporários ou segredos.
- [ ] 9.6 Ensaiar implantação compatível (índices → backend/optimizer compatíveis → frontend), indisponibilidade de solver antigo e rollback coordenado sem perda do histórico; verificar que uma geração bloqueada não altera escalas ou extras existentes.
