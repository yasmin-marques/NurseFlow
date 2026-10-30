# Specs OpenSpec

Esta pasta reúne as especificações vigentes das capacidades já implementadas. Mudanças ainda não aplicadas ficam em `../changes/`; suas specs delta só passam a representar o comportamento vigente após implementação, revisão e arquivamento.

## Linha de base observada no repositório

- A aplicação possui autenticação por token e perfis de Coordenação, Enfermeiro e Técnico. A Coordenação mantém profissionais, disponibilidade/restrições, setores e configurações mensais.
- As configurações mensais são consultadas e atualizadas pelo par ano/mês, sem vinculação ao ano atual. O sistema aceita anos civis de quatro dígitos (0001–9999).
- O back-end gera uma escala mensal como rascunho em `POST /escalas/gerar`, e permite substituir explicitamente um rascunho ou uma escala em revisão. Escalas validadas, publicadas e finalizadas não são substituídas.
- A geração usa NestJS, MongoDB e o serviço interno FastAPI/OR-Tools. Respeita elegibilidade, restrições, descanso de 72h após plantões de 24h e de 36h após plantões de 12h (com exceção da sequência diurno/noturno de 12h no mesmo dia), limites de carga e extras; insuficiência de equipe é registrada como vaga descoberta.
- O ciclo de escala inclui consulta por período, montagem e edição de plantões, validação, revisão, publicação, exportação PDF e notificações. Os requisitos vigentes detalham as regras em [gestão de escalas](./gestao-escalas/spec.md), [publicação](./publicacao-escalas/spec.md) e [interface do fluxo](./scale-workflow-interface/spec.md).

Esta linha de base descreve o código observado, não todas as capacidades pretendidas nos documentos de requisitos. Para o fluxo proposto de escala, consulte [a mudança ativa](../changes/gerenciar-ciclo-de-vida-de-escalas/README.md) e seus requisitos delta.

## Referências

- [Stack documentada](../../docs/arquitetura/STACK.md)
- [Requisitos — entrega 2](../../docs/Documento%20de%20Especifica%C3%A7%C3%A3o%20de%20Requisitos%20-%20NurseFlow%20-%20entrega%202.pdf)
- [Diagramas de atividades](../../docs/diagramas/diagramas_atividade/DIAGRAMAS_ATIVIDADES.md)
- [Designs de Tela](../../design/nurseflow/)
