# Proposal

## Why

Hoje a etapa da Coordenação pode decidir pedidos acordados, mas não recebe pedidos reais sem o fluxo dos profissionais. Enfermeiros precisam negociar uma permuta diretamente no NurseFlow, saber em que etapa ela está e continuar seguindo a escala publicada até a decisão final. Este change entrega a visão do Enfermeiro e a infraestrutura de trocas que também será consumida pela visão do Técnico.

## What Changes

- Adicionar a página profissional **Minhas trocas** no perfil Enfermeiro, com **Recebidas**, **Enviadas**, **Histórico**, badge real de pedidos recebidos pendentes e entrada **Nova solicitação**.
- Implementar o fluxo **Solicitar troca** em três passos: plantão próprio, par colega–plantão elegível e revisão/envio. O servidor verifica os dois vínculos na escala oficial e aplica a competência e o limite configurado.
- Permitir ao destinatário aceitar ou recusar, e ao remetente cancelar um pedido ainda pendente. Registrar o histórico e notificar os envolvidos de acordo com a etapa.
- Integrar o aceite à fila administrativa existente, sem publicar a escala nem contabilizar troca nessa etapa. Exibir o resultado da Coordenação a partir do mesmo registro.
- Entregar os serviços, contratos e testes de domínio compartilhados, com autenticação e autorização dos dois perfis profissionais. O Técnico terá entrada, navegação e testes de interface próprios no change dedicado.

## Capabilities

### New Capabilities

Nenhuma. O domínio continua sendo `trocas`.

### Modified Capabilities

- `trocas`: acrescentar solicitação, aceite, recusa, cancelamento, histórico e notificações profissionais, com a UI de Enfermeiro e contrato reutilizado pelo Técnico. Os requisitos novos são aditivos à especificação administrativa.

## Impact

- Front-end React/TypeScript: entrada de Trocas para Enfermeiro, páginas e componentes do fluxo profissional, cliente tipado e notificações autenticadas pelo perfil.
- API NestJS/Mongoose: estender o domínio administrativo existente com comandos e consultas profissionais, validações, concorrência, eventos de auditoria e notificação. Preservar rotas e DTOs administrativos.
- Escala oficial: somente leitura pelo produtor. A alteração atômica e a publicação de nova versão continuam sob responsabilidade da decisão administrativa.
- Não inclui UI do Técnico, registro manual de troca (US11), mudanças no gerador, novos canais externos ou mudanças na pasta `scale-workflow-interface`.

## References and Dependencies

- Documento de Especificação de Requisitos NurseFlow v1.3, de 16/11/2026: ON004, RU011–RU014 e RU016, RF015/US19, RF016/US20, RF017/US21, RF019/US23, RF023/US28 e RF027/US32, RN010–RN014, RN016, RN018–RN022, RNF004/RNF006/RNF009, DA21–DA23.
- Referências visuais: `telas/enfermeiro/` em `telas.zip`.
- Consumidor: change `implementar-tela-de-trocas`. A entrega conjunta só está integrada quando um aceite feito pela API profissional real entra na fila, pode ser decidido pela Coordenação e o resultado chega aos profissionais. A descrição de contrato compartilhado v1 está no [design.md](design.md).
