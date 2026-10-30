# Implementar tela de perfil

Esta change planeja criar a tela de perfil pessoal para os usuários autenticados do NurseFlow, respeitando a identidade da sessão, as permissões e o shell da aplicação.

Aplicação: o cartão do usuário no rodapé do menu lateral e o avatar do cabeçalho abrem a tela de perfil; o cartão inferior não encerra mais a sessão. O perfil é desenhado como a superfície independente do design; sair é uma ação explícita no próprio cartão.

## Artefatos

- [Proposal](./proposal.md): motivo, escopo e capacidade afetada.
- [Spec do perfil](./specs/perfil-usuario/spec.md): acesso, dados próprios, estados e requisitos visuais/interativos.
- [Design](./design.md): contexto técnico, decisões, segurança, riscos e pendências da referência.
- [Tasks](./tasks.md): checklist de confirmação, implementação e validação.

## Materiais de referência

- `../../../design/nurseflow/NurseFlow Web - Perfil.jpeg`: referência visual anexada e preservada no projeto.
- `../../../docs/arquitetura/STACK.md`: stack documentada.
- `../../../docs/diagramas/diagramas_atividade/DIAGRAMAS_ATIVIDADES.md`: regras dos fluxos de autenticação e de gestão de profissionais. O fluxo de perfil pessoal não está descrito nesses diagramas e não deve ser confundido com edição de profissionais pela Coordenação.
- `../../../openspec/specs/README.md`: linha de base das capacidades vigentes.

## Como prosseguir

Revise a referência visual e resolva as pendências da spec antes de aplicar esta change. Depois, implemente as tarefas pelo fluxo OpenSpec e arquive somente após a implementação e a validação.
