# OpenSpec Changes

Cada diretório nesta pasta representa uma mudança planejada. Mudanças ativas usam o fluxo definido em `../config.yaml` e devem manter seus artefatos juntos:

- `proposal.md`: motivo, escopo e capacidades afetadas.
- `specs/<capacidade>/spec.md`: requisitos e cenários verificáveis da mudança.
- `design.md`: decisões técnicas, riscos e migração.
- `tasks.md`: checklist de implementação e verificação.
- `README.md`: índice e contexto específico da mudança.

Use nomes de diretório em `kebab-case`, uma mudança por objetivo coeso e os comandos OpenSpec para criar, validar, aplicar e arquivar mudanças. Não mova uma mudança concluída para `archive/` antes de implementar e revisar seus artefatos.

## Mudança ativa

- [`align-frontend-with-nurseflow-design/`](./align-frontend-with-nurseflow-design/README.md): fidelidade visual da tela mensal/semanal de Escala e de seus painéis.
- [`gerenciar-ciclo-de-vida-de-escalas/`](./gerenciar-ciclo-de-vida-de-escalas/README.md): CRUD e fluxo de gestão, validação, publicação, notificações e exportação de escalas.
- [`implementar-tela-de-perfil/`](./implementar-tela-de-perfil/README.md): tela de perfil pessoal dos usuários autenticados baseada na imagem de referência.
