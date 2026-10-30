# Specs OpenSpec

Esta pasta reúne as especificações vigentes das capacidades já implementadas. Mudanças ainda não aplicadas ficam em `../changes/`; suas specs delta só passam a representar o comportamento vigente após implementação, revisão e arquivamento.

## Linha de base observada no repositório

- A aplicação possui autenticação por token e perfis de Coordenação, Enfermeiro e Técnico. A Coordenação mantém profissionais, disponibilidade/restrições, setores e configurações mensais.
- O back-end gera uma escala mensal como rascunho em `POST /escalas/gerar` e consulta uma escala por identificador em `GET /escalas/:id`. A geração usa NestJS, MongoDB e o serviço interno FastAPI/OR-Tools; há validação de disponibilidade, descanso, cargas, extras e quantitativos mínimos, com vagas descobertas e conflitos no resultado.
- O modelo atual aceita uma escala por mês, com estados rascunho, publicada e finalizada. Ainda não há rotas para listar por período, montar manualmente, editar plantões, validar/transicionar o fluxo, publicar, exportar PDF ou gerenciar notificações de escala.
- O front-end já tem páginas integradas para profissionais, disponibilidade, setores e configurações. A opção “Escala” existe na navegação, mas ainda exibe uma área em preparação, não o calendário apresentado nos protótipos.

Esta linha de base descreve o código observado, não todas as capacidades pretendidas nos documentos de requisitos. Para o fluxo proposto de escala, consulte [a mudança ativa](../changes/gerenciar-ciclo-de-vida-de-escalas/README.md) e seus requisitos delta.

## Referências

- [Stack documentada](../../docs/arquitetura/STACK.md)
- [Requisitos — entrega 2](../../docs/Documento%20de%20Especifica%C3%A7%C3%A3o%20de%20Requisitos%20-%20NurseFlow%20-%20entrega%202.pdf)
- [Diagramas de atividades](../../docs/diagramas/diagramas_atividade/DIAGRAMAS_ATIVIDADES.md)
- [Designs de Tela](../../design/nurseflow/)
