# Design

## Context

O NurseFlow distingue os perfis **Coordenação**, **Enfermeiro** e **Técnico**. Na arquitetura descrita no Documento de Requisitos v1.3, a interface é React/TypeScript, a API é NestJS/Mongoose e a versão oficial publicada da escala é a fonte de verdade. O Técnico pode consultar e propor trocas, mas não pode editar nem publicar a escala (RN014; RF023/US28).

Na linha de base auditada durante a preparação das changes anteriores, `ProfessionalLayout` e a visão geral profissional já existiam, o perfil `tecnico` já era reconhecido e `GET /trocas/minhas/contagem` atendia aos perfis profissionais; a página de Trocas profissional ainda precisava ser implementada. **Inspecionar o checkout atual antes de alterar o código**, pois o change `implementar-trocas-enfermeiro` pode ter adicionado serviços e componentes desde então.

A change `implementar-tela-de-trocas` já define a fila de decisão administrativa e a regra de que uma solicitação só chega à Coordenação após aceite do colega. A change `implementar-trocas-enfermeiro` define o **contrato profissional v1**, incluindo rotas, DTOs, modelo de histórico/cancelamento, idempotência, autenticação e validação de permuta. **Não criar uma implementação de domínio separada para o Técnico.**

## Referências visuais

Abrir e observar os **arquivos no diretório `design/nurseflow/` na raiz do projeto**, compartilhado com os protótipos de Coordenação. Os arquivos equivalentes também constam no material `telas.zip`, na subpasta `telas/tecnico/`, porém com nomes de `Container` diferentes. No repositório, utilizar os nomes informados abaixo:

| Superfície | Imagem em `design/nurseflow/` | Comportamento a implementar |
| --- | --- | --- |
| Pedidos recebidos | `NurseFlow Web - Trocas (Recebidas).png` | Cartão de solicitação, dois plantões, ações **Recusar** e **Aceitar troca** somente para pedido pendente recebido |
| Pedidos enviados | `NurseFlow Web - Trocas (Enviadas).png` | Cartão enviado, situação **Aguardando resposta** e ação **Cancelar solicitação** quando permitida |
| Envio cancelado | `NurseFlow Web - Trocas (Enviada e Cancelada).png` | Lista ativa atualizada após confirmação; pedido cancelado preservado no Histórico |
| Solicitar: passo 1 | `NurseFlow Web - Solicitar Troca (1).png` | Escolha de plantão próprio da versão oficial |
| Solicitar: passo 2 | `NurseFlow Web - Solicitar Troca (2).png` | Escolha do colega e do vínculo desejado, somente entre pares aptos |
| Solicitar: passo 3 | `NurseFlow Web - Solicitar Troca (3).png` | Revisão dos dois plantões e envio explícito |
| Aceite concluído | `NurseFlow Web - Solicitação (Aceita).png` | Feedback de aceite; estado definitivo **Aguardando Coordenação**, sem permuta oficial |
| Recusa concluída | `NurseFlow Web - Solicitação (Recusada).png` | Feedback de recusa pelo profissional; pedido no Histórico |
| Modal de aceite | `Container (sim, aceitar).png` | **Não** / **Sim, quero aceitar**; confirma consentimento, não aprovação da escala |
| Modal de recusa | `Container (sim, recusar).png` | **Não** / **Sim, quero recusar**; recusa do colega, distinta da recusa da Coordenação |
| Modal de cancelamento | `Container (sim, cancelar).png` | **Não** / **Sim, quero cancelar**; apenas remetente e pedido não concluído |

**Nota sobre os protótipos:** as 11 imagens do Técnico mostram a mesma jornada principal em layout profissional, mas não há imagem específica do Histórico, de erros de rede ou de conflito de dados. Criar esses estados a partir dos componentes e das regras documentadas, sem mascarar ausência de dados por listas de exemplo. Identidade, nome, avatar e rótulo ocupacional devem vir da sessão. O texto de exemplo das imagens não determina nomes, datas, funções ou formação persistidas.

## Goals / Non-Goals

**Goals**

- Entregar uma experiência funcional, responsiva e acessível para o perfil Técnico, sem acesso às ações da Coordenação.
- Reutilizar telas e serviços compartilháveis com Enfermeiro **sem confundir os pontos de entrada, permissões, dados e testes de cada perfil**.
- Reproduzir a hierarquia visual e os estados reais das imagens e integrar ações à API persistida.
- Exibir a mesma situação da solicitação em Técnico, Enfermeiro e Coordenação, sem antecipar a atualização da escala.

**Non-Goals**

- Criar `TrocasTecnicosModule`, novos schemas, coleção, fila, status ou rota `/trocas/tecnicos`.
- Refazer o módulo de Coordenação ou a implementação-base da API profissional.
- Permitir ao Técnico definir disponibilidade, editar/publicar escalas, autorizar exceções de limite ou aprovar definitivamente uma troca.
- Implementar Google Agenda, troca manual ou notificações externas.

## Decisions

### 1. Entrada específica do Técnico, componentes reutilizáveis

O ramo do perfil `tecnico` em `App.tsx` deve montar o fluxo profissional dentro de `ProfessionalLayout`. A entrada/identidade de Técnico é distinta da do Enfermeiro mesmo quando utiliza componentes comuns como `MinhasTrocasPage`, `SolicitarTrocaWizard`, `TrocaCard` e `ConfirmarTrocaDialog` (nomes apenas sugestivos).

- Menu **Trocas** abre **Minhas trocas** do Técnico. Botão **Nova solicitação** e atalhos da visão geral abrem o passo 1.
- A navegação **Voltar** entre etapas preserva apenas seleções ainda válidas. Mudança do vínculo próprio limpa o par colega–plantão anteriormente escolhido.
- Não reutilizar `activeItem` administrativo para controlar a navegação do profissional e não introduzir roteador apenas para esta mudança se o projeto usa navegação por estado.
- Cabeçalho, nome, abreviação do avatar, função e dados do perfil vêm do usuário/cadastro ativo. Não copiar a pessoa fictícia do protótipo.
- Em logout, troca de conta ou perfil, invalidar consultas, seleção do assistente, contador e notificações em memória para impedir vazamento de dados entre sessões.

### 2. Uma única API e uma única fonte oficial

Consumir as rotas profissionais do contrato v1 em `../implementar-trocas-enfermeiro/design.md`. Elas são **compartilhadas** entre Enfermeiro e Técnico; o backend aplica `@Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)` e deriva o `Profissional` do JWT. Não confiar na formação ou no solicitante enviados pelo navegador.

| Operação do Técnico | Contrato compartilhado esperado |
| --- | --- |
| Recebidas, Enviadas e Histórico | `GET /trocas/minhas?aba=recebidas\|enviadas\|historico` |
| Contagem das recebidas pendentes | `GET /trocas/minhas/contagem` |
| Plantões próprios disponíveis | `GET /trocas/minhas/plantoes` |
| Pares de colega–plantão elegíveis | `GET /trocas/minhas/plantoes/:vinculoId/candidatos` |
| Detalhe do pedido próprio | `GET /trocas/minhas/:id` |
| Enviar pedido | `POST /trocas/minhas` |
| Aceitar pedido recebido | `POST /trocas/minhas/:id/aceite` |
| Recusar pedido recebido | `POST /trocas/minhas/:id/recusar` |
| Cancelar pedido enviado | `POST /trocas/minhas/:id/cancelar` |
| Notificações de trocas | `GET /notificacoes/trocas` e `PATCH /notificacoes/trocas/:id/lida` |

A lista e os detalhes precisam refletir os **dois vínculos `PlantaoProfissional`**, não apenas IDs de `Plantao`: `vinculoSolicitanteId` e `vinculoSolicitadoId`. Não permitir atribuir `profissionalSolicitadoId`, status ou prova de aceite diretamente pelo cliente. O backend deriva o destinatário do vínculo escolhido. Consultar somente o último snapshot **oficial** publicado; não tratar rascunho nem revisão em andamento como escala válida.

A versão publicada usada no envio deve ser identificada no contrato. Se a versão ou os termos de algum vínculo mudaram, o servidor deve revalidar e negar consentimento para termos alterados; o front-end informa conflito e oferece atualização da seleção.

### 3. Formação/função e regras obrigatórias da permuta

O Técnico só pode assumir função compatível com a formação **Técnico de Enfermagem**. Um vínculo cuja função é **Enfermeiro** ou **Enfermeiro-chefe** não é opção apta para um Técnico e não pode ser aceito por requisição direta. A função é atributo do vínculo de plantão, conforme RN016, e não pode ser inferida apenas pelo nome do setor.

A API deve considerar as duas alocações **pós-troca**, verificando participantes cadastrados e ativos, formação e função, escala e mês/ano comuns, ambos os plantões ainda não iniciados, restrições e ausências, choques de horário, descanso 24x72/12h, cargas e extras, cobertura por setor/data/turno/função sem agravamento e estado/versão oficial. A troca exige a mesma formação e setor fixo; técnicos também devem ter o mesmo subsetor, inclusive quando ambos não têm subsetor.

`limiteTrocas` é configurado para a competência e nunca deve ser substituído por um valor fixo `3` no front-end. Bloquear novo pedido quando o **solicitante** já atingiu o limite de abertura; somente trocas **aprovadas e efetivadas** consomem uma unidade por participante. Se o destinatário atingir o limite, ou o limite mudar após abertura, a decisão administrativa aplica a regra de exceção da Coordenação, com justificativa e sem afastar outras restrições. Não exibir a cota privada do colega.

### 4. Abas, linguagem e estados

| Situação persistida | Rótulo contextual para Técnico | Exibição |
| --- | --- | --- |
| `aguardando_resposta` | **Aguardando sua resposta** (Recebidas) / **Aguardando colega** (Enviadas) | Lista ativa; somente o destinatário pode aceitar/recusar; remetente pode cancelar |
| `aguardando_coordenacao` | **Aceita por você — aguardando Coordenação** / **Aceita pelo colega — aguardando Coordenação** | Lista ativa, sem ações de resposta; remetente pode cancelar enquanto a decisão não ocorreu |
| `recusada_pelo_profissional` | **Recusada por você** / **Recusada pelo colega** | Histórico |
| `cancelada` | **Cancelada** | Histórico |
| `recusada_pela_coordenacao` | **Recusada pela Coordenação**, com motivo | Histórico |
| `aprovada` | **Aprovada pela Coordenação** | Histórico; escala oficial já atualizada |

- **Recebidas** lista pedidos dirigidos ao Técnico; **Enviadas** lista os que ele criou; **Histórico** lista as conclusões nas duas direções.
- No cartão **Recebidas**, **Você assume** significa o plantão originalmente oferecido pelo solicitante; no cartão **Enviadas**, **Seu plantão** é o vínculo do remetente, e **Plantão desejado** é o vínculo do colega. As duas datas/horários e funções precisam ser identificáveis.
- O badge profissional usa **somente recebidas em `aguardando_resposta`**, independentemente de notificações lidas. `0` é retorno válido; erro de consulta não é `0` confirmado nem número ilustrativo.
- Buscar novamente os dados após ação confirmada, retorno à página e recuperação de foco, observando as práticas já usadas no projeto. Não mostrar sucesso antes do commit do servidor.
- Histórico permanece legível mesmo após troca aprovada, revisão posterior da escala ou cancelamento; usar o resumo original preservado pelo backend.

### 5. Fluxo de três etapas

1. **Selecionar meu plantão:** consultar vínculos próprios futuros da versão oficial. Mostrar data, horário/turno, setor, função e identificação de extra se aplicável; impedir seleção não elegível.
2. **Selecionar colega e plantão:** consultar pares elegíveis para o vínculo escolhido; mostrar identidade mínima do colega e dados do plantão oferecido, sem CPF, COREN, contatos ou detalhes de indisponibilidade de terceiros. Um colega pode ter vários vínculos, cada um como opção distinta.
3. **Revisar e enviar:** confirmar claramente os dois plantões e o destinatário. Enviar `vinculoSolicitanteId`, `vinculoSolicitadoId`, `versaoOficialEsperada` e `operacaoId` conforme contrato compartilhado. Só anunciar **Solicitação enviada — aguardando resposta do colega** após resposta positiva.

Respostas atrasadas de consultas não podem sobrescrever seleções posteriores. Erro de rede mantém a revisão e oferece tentativa segura com a mesma chave idempotente. Se a aptidão mudar, informar que é necessário atualizar dados e selecionar novamente.

### 6. Confirmações e transições

- **Aceitar:** apenas destinatário do pedido em `aguardando_resposta`, com modal verde; o servidor revalida e muda para `aguardando_coordenacao`. **Não alterar Meus plantões nem afirmar que a troca foi realizada.**
- **Recusar:** apenas destinatário pendente, com modal vermelho; finaliza `recusada_pelo_profissional` e notifica o remetente. Não usar o endpoint administrativo de recusa, que exige justificativa da Coordenação.
- **Cancelar:** apenas remetente em `aguardando_resposta` ou `aguardando_coordenacao`, com modal vermelho; finaliza `cancelada`, remove o pedido da fila administrativa se já aceito, notifica o colega e mantém histórico. Não permitir cancelar `aprovada`, `recusada_pelo_profissional`, `recusada_pela_coordenacao` ou `cancelada`.
- **Não / fechar / Escape:** nenhuma chamada de escrita. Confirmar desabilita ações duplicadas, mostra processamento e usa resultado persistido. Repor foco no controle originador e fornecer mensagens textuais para erro/resultado.

Cancelamento e aceite/recusa/decisão podem concorrer: o servidor deve aplicar transição condicionada por estado e idempotência. Na colisão, exibir 409/estado atualizado sem anunciar dois resultados finais. Não resolver corrida com botão desabilitado como única proteção.

### 7. Integração com Coordenação, notificações e escala

O aceite do Técnico cria **a mesma** solicitação `aguardando_coordenacao` que é consumida pela interface administrativa. O pedido não aparece na fila antes do acordo. A Coordenação pode aprovar ou recusar com motivo e, durante revisão aberta, a aprovação fica bloqueada até a resolução, sem excluir a pendência.

Após decisão administrativa, a página do Técnico e seu histórico exibem o status final; em recusa, o motivo de forma legível. Integre notificações de troca ao sino profissional preservando notificações de publicação/alteração. A marcação da notificação como lida **não** altera a solicitação. Abrir uma notificação direciona ao pedido próprio, respeitando a autorização.

A versão oficial continua intacta em pedido enviado, aceito, recusado ou cancelado. **Somente uma aprovação efetivada pela Coordenação** gera a nova versão oficial; Meus plantões e Escala geral devem carregar a versão publicada mais recente, sem trocar alocações otimisticamente no navegador.

## Risks / Trade-offs

- **Confundir perfis:** telas visualmente próximas podem induzir dados vazados, atalhos errados ou permissões administrativas. Mitigação: entrada por perfil, filtros na API e testes com sessões distintas.
- **Divergência de fontes visuais:** o ZIP recebido chama os diálogos `Container.png`, `Container-1.png` e `Container-2.png`; no repositório, usar os nomes `Container (sim, ...)` informados para `design/nurseflow/`.
- **Base profissional ainda não concluída:** UI pode ser iniciada, mas ações reais dependem das rotas do change Enfermeiro. Mitigação: contrato único e teste final sem mocks.
- **Histórico ausente nas imagens:** seguir os estados reais e os cartões, mantendo motivo de recusa administrativa e dados originais.
- **Mudar a escala após aceite:** violaria o fluxo em duas etapas. Mitigação: não atualizar plantões até a decisão administrativa oficial.
- **Transação e concorrência:** cancelamento disputando com aprovação pode afetar integridade. Mitigação: reutilizar as garantias transacionais e idempotentes do serviço compartilhado.

## Migration Plan / Ordem de execução

1. Inspecionar o checkout e confirmar as rotas e componentes entregues em `implementar-trocas-enfermeiro`.
2. Integrar a entrada do perfil Técnico, menu, atalhos, contagem e limpeza de sessão.
3. Reutilizar e adaptar componentes compartilhados para as 11 telas/estados do Técnico; ligar todos os comandos ao cliente autenticado.
4. Validar visualmente com `design/nurseflow/` e executar testes de UI, acessibilidade, perfis e regra de função.
5. Homologar end-to-end com **Técnico A → Técnico B → Coordenação → Técnicos A/B** para aprovação, recusa e cancelamento; verificar escala, notificações e histórico reais.
6. Executar suíte/build relevantes e atualizar checklist. Não executar `/opsx-archive`, commit, push ou merge sem comando explícito.

**Nenhuma migration exclusiva do Técnico:** qualquer schema/enum/histórico profissional faltante pertence ao contrato e à change compartilhados; não criar alterações paralelas para esta interface.
