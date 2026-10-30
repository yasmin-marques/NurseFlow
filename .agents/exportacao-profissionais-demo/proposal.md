# Proposal

## Why

A Coordenação consulta e filtra os profissionais na tela **Profissionais**, mas não consegue levar esse recorte para uma planilha. Além disso, o filtro de situação só distinguia "ativos" e "desativados", embora a API já exponha quatro situações (`ativo`, `desativado`, `afastado`, `ferias`). Para demonstrar e testar a exportação e os filtros, o seed de demonstração tinha apenas 9 profissionais, nenhum desativado.

## What Changes

- Adicionar o botão **Exportar Excel** à tela Profissionais, que baixa uma planilha `.xlsx` com exatamente os profissionais visíveis (busca, filtros e ordenação aplicados).
- Estender o filtro de situação para as quatro situações da API e extrair a lógica de filtragem/busca/ordenação para um módulo compartilhado entre a listagem e a exportação.
- Expor `createdAt` e `updatedAt` dos profissionais no front-end para as colunas de data da planilha.
- Expandir o Demo Seed de 9 para 27 profissionais (incluindo situações `desativado`, `afastado` e `ferias`) e de 9 para 16 restrições de outubro de 2026.
- Tornar o script do seed importável (`module.exports`) e cobri-lo com teste e2e; documentar tudo no README.

## Capabilities

### New Capabilities
- `exportacao-profissionais`: exportação da lista filtrada de profissionais para Excel e filtro por quatro situações.
- `demo-seed`: dados de demonstração de profissionais, usuários e restrições, com idempotência e proteções de ambiente.

### Modified Capabilities

## Impact

- Front-end: `Professionals.tsx`, `ProfessionalFiltersModal.tsx`, novo `filters.ts`, novo `services/professionalsExport.ts`, `services/professionals.ts`, `types.ts`, `components/icons.tsx` (ícone `Download`) e nova dependência `exceljs`.
- Back-end: `scripts/seed-demo.js` e novo teste `test/seed-demo.e2e-spec.ts`. Nenhuma alteração de API, schema ou migration.
- Documentação: `README.md`.

## Out of Scope

- Exportação em outros formatos (CSV, PDF) ou de outras listas.
- Endpoint de exportação no servidor: a planilha é gerada no navegador.
- Importação de profissionais por planilha.
- Alterações na API, em permissões ou na geração de escalas.
