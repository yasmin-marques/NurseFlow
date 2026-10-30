# Tasks

Legenda: `[x]` = comprovado no código da branch e/ou por teste executado; `[ ]` = não comprovado nesta documentação.

## 1. Filtros e modelo de dados do front-end

- [x] 1.1 Extrair `applyProfessionalView`, `ProfessionalFilters`, `initialFilters`, `STATUS_LABEL` e `statusOf` para `pages/Professionals/filters.ts`, usando-os na listagem; coberto por testes de `applyProfessionalView`.
- [x] 1.2 Estender o filtro de situação a `ativo`, `desativado`, `afastado` e `ferias` no modal de filtros e no resumo; coberto por testes de filtro por cada situação.
- [x] 1.3 Mapear `createdAt` e `updatedAt` em `services/professionals.ts` e `types.ts`; coberto por `professionals.test.ts`.

## 2. Exportação para Excel

- [x] 2.1 Adicionar a dependência `exceljs` e o ícone `Download`.
- [x] 2.2 Implementar `services/professionalsExport.ts` (colunas, textos, datas, largura, cabeçalho, congelamento, autofiltro e nome do arquivo); coberto por `professionalsExport.test.ts` com leitura da planilha gerada.
- [x] 2.3 Adicionar o botão "Exportar Excel" em `Professionals.tsx` com estados de desabilitado/"Exportando..." e mensagem de erro.
- [x] 2.4 Executar `professionalsExport.test.ts` e `professionals.test.ts` (vitest): 14 testes passaram na verificação desta documentação.
- [ ] 2.5 Verificar manualmente o download e a abertura do arquivo em Excel a partir da interface (não comprovado).

## 3. Demo Seed

- [x] 3.1 Ampliar `PEOPLE` para 27 profissionais (`CE-10001` a `CE-10027`) com `desativadoEm` para desativados.
- [x] 3.2 Acrescentar 7 restrições de outubro de 2026 (total 16).
- [x] 3.3 Exportar `{ PEOPLE, cpf, seed }` e executar `seed()` apenas via `require.main === module`.
- [x] 3.4 Escrever `test/seed-demo.e2e-spec.ts` (distribuição, identificadores, restrições, idempotência e proteções).
- [ ] 3.5 Executar o teste e2e do seed (não executado: o teste roda o seed em banco de teste, e esta documentação não o executou).

## 4. Documentação

- [x] 4.1 Atualizar o README com a tabela de logins (27), a tabela de restrições de outubro de 2026 e a seção "Exportação de profissionais (Excel)".
- [x] 4.2 Criar os artefatos OpenSpec desta mudança.

## 5. Verificação integrada

- [ ] 5.1 Executar a suíte completa do front-end, lint e build (não executados).
- [ ] 5.2 Executar a suíte do back-end, lint e build (não executados).
- [ ] 5.3 Revisar a codificação de `back-end/scripts/seed-demo.js` (BOM e acentos corrompidos em comentários e em uma mensagem, observados no diff).
