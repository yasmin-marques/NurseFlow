# Design

## Context

A tela `front-end/src/pages/Professionals/Professionals.tsx` lista os profissionais carregados por `listProfessionals()` (paginação consumida no serviço) e aplicava busca, filtros e ordenação diretamente no componente e no modal de filtros. A API já retorna quatro situações (`ativo`, `desativado`, `afastado`, `ferias`) e `createdAt`/`updatedAt`, mas o front-end reduzia a situação a ativo/inativo no filtro e descartava as datas. O seed `back-end/scripts/seed-demo.js` criava 9 profissionais e era executado imediatamente ao ser carregado.

## Goals / Non-Goals

**Goals:**
- Exportar para `.xlsx` exatamente o que a Coordenação vê na tela.
- Usar uma única implementação de filtro/busca/ordenação para a listagem e para a exportação.
- Oferecer dados de demonstração suficientes para exercitar todas as situações e a exportação.

**Non-Goals:**
- Endpoint de exportação no servidor, outros formatos ou importação.
- Alterar API, permissões, schemas ou migrations.

## Decisions

- **Geração no navegador com `exceljs`.** A planilha é montada a partir da lista já carregada, sem novo endpoint. A biblioteca é carregada por `import('exceljs')` dentro de `buildProfessionalsWorkbook`, de modo que só é baixada quando o usuário exporta.
- **Módulo `filters.ts` compartilhado.** `applyProfessionalView(professionals, filters, search)` concentra filtro por formação, vínculo e situação, busca (nome, COREN, CPF por dígitos) e ordenação `localeCompare` pt-BR. `Professionals.tsx` o usa para a listagem e para o argumento da exportação, o que garante que "o que está na tela" e "o que é exportado" não divirjam. `ProfessionalFilters`, `initialFilters` e `STATUS_LABEL` saíram do modal para esse módulo.
- **Situação com quatro valores.** `ProfessionalFilters.status` passou de `all | active | inactive` para `ProfessionalStatus | all`. `statusOf` usa `apiStatus` e, na falta dele, deriva de `status` booleano. O modal ganhou as opções "Afastados" e "Férias".
- **Separação em `services/professionalsExport.ts`.** `buildProfessionalsWorkbook` (puro, testável), `professionalsFileName` (data local `AAAA-MM-DD`) e `exportProfessionalsXlsx` (Blob + `URL.createObjectURL` + âncora de download + `revokeObjectURL`).
- **Colunas declarativas.** Uma lista `COLUMNS` define cabeçalho, extrator de valor e marcação `text`/`date`. CPF e COREN usam formato `@` (texto) para preservar zeros e pontuação; datas usam `dd/mm/yyyy hh:mm` e viram `null` se ausentes ou inválidas. Somente essas nove colunas são lidas do profissional, o que impede vazamento de campos extras.
- **Largura e cabeçalho.** Largura calculada pelo maior valor textual da coluna (mínimo pelo cabeçalho ou pelo formato de data) mais 3; cabeçalho em negrito, fundo `FF285F34`, painel congelado na linha 1 e autofiltro.
- **Estado do botão.** `Professionals.tsx` mantém `exporting`; o botão fica desabilitado enquanto carrega, exporta ou não há linhas visíveis. Falhas exibem "Não foi possível gerar a planilha." no alerta existente.
- **Datas no modelo.** `ApiProfessional` e `Professional` ganharam `createdAt`/`updatedAt` opcionais, mapeados em `fromApi`.
- **Seed testável.** `seed-demo.js` passou a exportar `{ PEOPLE, cpf, seed }` e a chamar `seed()` somente se `require.main === module`. A contagem exibida ao final usa `PEOPLE.length` e `restrictions.length` em vez de números fixos.
- **Seed ampliado.** `PEOPLE` passou a ter 27 entradas (`CE-10001` a `CE-10027`), com os 18 novos profissionais cobrindo as quatro situações, três vínculos e duas formações; profissionais `desativado` recebem `desativadoEm = ts`. Sete restrições novas foram acrescentadas, alinhadas às situações `ferias`/`afastado` dos novos profissionais.
- **Teste e2e do seed.** `back-end/test/seed-demo.e2e-spec.ts` usa o helper de banco de teste existente (`iniciarBanco`, `aplicarMigrations`) e valida distribuição, CPFs/COREN/e-mails, vínculo usuário-profissional, restrições, idempotência e proteções.

## Risks / Trade-offs

- [A planilha depende dos dados em memória; listas muito grandes são processadas no navegador] → Aceito para o volume atual; `exceljs` é carregada sob demanda para não pesar o carregamento inicial.
- [`exceljs` adiciona uma dependência volumosa ao front-end (`package-lock.json` cresce)] → Mitigado pelo `import()` dinâmico.
- [Datas são exibidas no fuso do arquivo/Excel a partir de instantes UTC] → O teste valida o instante ISO armazenado; o formato exibido é `dd/mm/yyyy hh:mm`.
- [`seed-demo.js` mudou de encoding no diff: surgiu um BOM e os acentos de comentários e de uma mensagem aparecem corrompidos (`Ã­`, `Ã§`)] → Observado no diff da branch; afeta comentários e mensagens de log, não os dados (os nomes com acento em `PEOPLE` aparecem íntegros). Recomenda-se revisar a codificação do arquivo antes do merge. Este trabalho de documentação não altera código.
- [A mensagem de seed desabilitado foi alterada de "não é true" para "true"] → Mudança de texto observada no diff, sem efeito funcional; não é requisito.
- [A mensagem final do seed informava "12 configurações mensais" e passou a informar "2 configurações mensais"] → Mudança de texto no log observada no diff; a criação das configurações não faz parte desta mudança e não foi verificada aqui.
