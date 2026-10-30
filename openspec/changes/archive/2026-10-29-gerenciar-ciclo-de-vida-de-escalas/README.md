# Gerenciar ciclo de vida de escalas

Esta mudança planeja implementar o fluxo completo de escalas representado em `imagens_exemplo/`, aproveitando a geração automática que já existe no back-end.

## Artefatos

- [Proposal](./proposal.md): por que implementar o fluxo e seus limites.
- [Spec de gestão](./specs/gestao-escalas/spec.md): geração, CRUD, calendário, revisão, edição, validação e estados.
- [Spec de publicação](./specs/publicacao-escalas/spec.md): publicação, preservação de versões, notificações e PDF.
- [Design](./design.md): persistência, transações, API, interface, riscos e migração.
- [Tasks](./tasks.md): checklist de implementação/testes organizado em grupos.

## Materiais de referência

- `../../imagens_exemplo/`: configurações e geração, revisão, calendários mensal/semanal, edição de plantões/equipe, validação, publicação, notificações e exportação.
- `../../docs/Documento de Especificação de Requisitos - NurseFlow - entrega 2.pdf`: requisitos de negócio e histórias de usuário, especialmente geração, edição, validação, publicação e PDF.
- `../../docs/diagramas/diagramas_atividade/DIAGRAMAS_ATIVIDADES.md`: fluxos DA11–DA20.

Os documentos e as imagens são material de referência para os requisitos e a interface; esta mudança não cria uma funcionalidade de importação/OCR de arquivos. Trocas de plantão não fazem parte do escopo.

## Como prosseguir

Revise proposal, specs e design antes de iniciar. Quando aprovados, implemente as caixas de `tasks.md` pelo fluxo OpenSpec (`/opsx-apply`) e arquive somente depois da implementação e validação.
