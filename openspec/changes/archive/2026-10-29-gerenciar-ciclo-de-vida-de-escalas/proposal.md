# Proposal

## Why

O NurseFlow já gera uma escala mensal como rascunho e possui cadastros, disponibilidade, setores e configurações, mas ainda não oferece uma interface para consultar, editar, validar, publicar ou exportar uma escala. As telas de referência em `imagens_exemplo/` descrevem um fluxo de ponta a ponta que falta conectar ao modelo e à API atuais.

## What Changes

- Implementar o ciclo de vida da escala mensal: criar por geração automática ou edição manual, consultar por período, revisar e atualizar rascunhos, validar conflitos e cobertura, publicar e remover somente rascunhos.
- Criar uma interface funcional para o fluxo da escala, com calendário mensal/semanal, revisão agrupada por dia e turno, indicadores de carga e cobertura, estados do fluxo, detalhes e edição de plantões.
- Permitir editar setor, horário/turno, enfermeiro responsável e equipe técnica, selecionando profissionais cadastrados e disponíveis; validar cada alteração antes de aplicá-la.
- Apresentar conflitos, pendências de cobertura, carga esperada/atribuída, plantões regulares e extras. Permitir publicação com pendências somente após confirmação explícita da Coordenação, sem ocultá-las.
- Publicar a escala e disponibilizar exportação PDF geral ou por setor, preparada para impressão e assinaturas da Coordenação e Diretoria.
- Apresentar notificações relacionadas à publicação e às alterações da escala.
- Não incluir importação de arquivos de `docs/` ou `imagens_exemplo/` como funcionalidade do produto. Esses materiais são referências para especificar e construir as telas; os fluxos de troca de plantão permanecem fora deste change.

## Capabilities

### New Capabilities

- `gestao-escalas`: criação automática e manual, consulta, revisão, edição, validação, cobertura, estados e remoção segura de rascunhos.
- `publicacao-escalas`: publicação, notificações de escala e exportação PDF geral ou segmentada por setor.

### Modified Capabilities

Nenhuma. O projeto ainda não possui specs de capacidades existentes.

## Impact

- API NestJS e persistência MongoDB: ampliar `back-end/src/escalas/` e suas migrations para operações, transições de estado, validações e integridade do ciclo de vida.
- Otimizador FastAPI/OR-Tools: reutilizar o gerador atual como parte do fluxo de geração; manter as regras duras e as pendências descobertas no contrato de resposta.
- Front-end React: substituir a área de escala ainda não implementada em `front-end/src/App.tsx` por calendário, revisão, edição, validação, publicação, notificações e exportação integrados à API.
- Cobertura de testes: acrescentar testes unitários, de integração/API e de interface para permissões da Coordenação, transições, validação de regras e comportamento visual/funcional.
- Referências: Documento de Requisitos (entrega 2), diagramas de atividades DA11–DA20 e imagens em `imagens_exemplo/`.
