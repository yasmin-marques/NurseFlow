# Design

## Context

No checkout público `main@d3c6814` de 17/11/2026, a Coordenação já tem `TrocasController`, `TrocasService`, página `ExchangesPage`, histórico, contadores e persistência. A migração vigente de trocas é `back-end/migrations/20261101000010-trocas.js`. Existe `MinhasTrocasController` para ambos os perfis, mas sua única operação é `GET /trocas/minhas/contagem`, usada na visão geral. A aba profissional em `front-end/src/App.tsx` ainda abre placeholder. O sino profissional usa `NotificationCenter`, que atualmente consulta apenas notificações de escala.

Este documento é a **referência do contrato profissional v1**. Preserva os campos reais de armazenamento e separa rotas profissionais de GET/POST administrativos já protegidos. Ao contrário do desenho administrativo inicial, os IDs persistidos são `vinculoSolicitanteId` e `vinculoSolicitadoId`, ambos de `PlantaoProfissional`. O ID do documento `Plantao` não é aceito no lugar do ID de vínculo.

## Goals / Non-Goals

- Entregar o fluxo do Enfermeiro inteiro, com uma API que também autorize corretamente Técnico, sem a UI específica do Técnico neste change.
- Preservar as permissões e os contratos administrativos e o ciclo atual de revisão e publicação da escala.
- Não introduzir novo roteador, fila paralela, cópia da escala oficial, canais externos ou uma segunda implementação para Técnico.

## Decisions

### Identidade, vínculos e fonte de consulta

Usar `@Perfis(Perfil.ENFERMEIRO, Perfil.TECNICO)` e `@UsuarioAtual()`. Resolver `usuario.profissionalId` para cadastro ativo ligado ao mesmo `usuario.id`, validando a formação por regra de negócio. Não aceitar `solicitanteProfissionalId`, `status`, `aceite`, versão oficial resultante ou timestamps definidos pelo cliente. Na criação, o destinatário é derivado do vínculo escolhido, identificado no resumo para confirmação.

Reutilizar a leitura da última versão oficial usada por `EscalaProfissionalService`; durante revisão aberta o profissional continua consultando o último snapshot oficial, nunca o rascunho. A revisão não impede abrir ou aceitar pedido para o snapshot oficial vigente, mas impede sua aprovação. Se uma revisão for publicada, reavaliar o pedido sobre os vínculos oficiais vigentes. Se apenas o número de versão mudou e os vínculos, seus titulares e os termos originais permanecem válidos, a Coordenação pode revalidar na versão atual. Se titular, data, horário, setor ou função do vínculo mudou, não reaproveitar consentimento para outros termos.

Exigir participantes distintos e dois vínculos distintos na mesma escala oficial e competência `ano/mes`. Usar a convenção vigente do projeto para representar data e horário, com cálculo inequívoco do instante de início. Nesta mudança, “ainda não realizado” é tratado como **ainda não iniciado em ambos os lados**; o turno noturno e a passagem de mês não alteram a competência registrada da escala. Cobrir a fronteira do horário com relógio controlado em teste.

### Validação comum

Extrair o cálculo da aptidão de `TrocasService.validarNoBanco` para operação reutilizável, sem acoplar a elegibilidade a um status de pedido. A Coordenação continua adicionando suas verificações de aceite, revisão, versão e exceção. Construir a permuta removendo as duas alocações originais e inserindo de volta as duas atribuições permutadas, conservando função, liderança e tipo/vínculo do plantão. Reaproveitar `validarAlocacoesPlantao` e `calcularPendenciasCobertura`. Validar cadastro ativo, formação/função, indisponibilidade, férias/ausência, vínculo externo, sobreposição, descanso, carga/extras e cobertura sem agravamento por setor/data/turno/função. Para descanso na fronteira de mês, usar versões oficiais adjacentes disponíveis, sem ler rascunhos como se fossem oficiais. Não introduzir regra de mesmo setor. A regra oficial de descanso e sua exceção de extra programado não devem ser reescritas na UI.

Na listagem de candidatos, filtrar em lote sobre um contexto oficial e devolver pares elegíveis pagináveis, sem explicar indisponibilidade ou limites individuais de terceiros. Revalidar no envio, no aceite e na decisão administrativa. Na abertura, impedir quando a contagem de aprovadas do **solicitante** for igual ou maior que `limiteTrocas`; zero é válido, ausência de configuração é erro explicativo, e não se usa 3 como fallback. A contagem vem do mesmo critério administrativo de trocas efetivadas de cada participante na competência. No aceite, limite atingido depois da abertura ou limite do destinatário não é autorização: a decisão final exigirá exceção explícita e justificada da Coordenação se o limite continuar atingido, sem dispensar outra regra. Configuração ausente continua impedimento. Criar, aceitar, recusar e cancelar não contam. Registro manual US11 permanece fora do escopo.

### Estados e persistência

| Estado inicial | Comando e ator | Próximo estado | Efeito |
| --- | --- | --- | --- |
| inexistente | solicitar, remetente autenticado | `aguardando_resposta` | cria registro com os dois vínculos, a competência e a notificação ao destinatário |
| `aguardando_resposta` | aceitar, destinatário autenticado | `aguardando_coordenacao` | grava `aceite.profissionalId` e `aceite.aceitoEm` no servidor e notifica remetente |
| `aguardando_resposta` | recusar, destinatário autenticado | `recusada_pelo_profissional` | encerra e notifica remetente, sem motivo obrigatório |
| `aguardando_resposta` ou `aguardando_coordenacao` | cancelar, somente remetente | `cancelada` | encerra, registra cancelamento e notifica destinatário |
| `aguardando_coordenacao` | aprovar, Coordenação | `aprovada` | permuta atômica, versão oficial nova, auditoria e aviso aos dois participantes |
| `aguardando_coordenacao` | recusar, Coordenação | `recusada_pela_coordenacao` | preserva a escala e notifica ambos com motivo obrigatório |

| Estado persistido | Rótulo profissional | Destino nas abas |
| --- | --- | --- |
| `aguardando_resposta` | Aguardando colega (remetente) / Aguardando sua resposta (destinatário) | Enviadas / Recebidas |
| `aguardando_coordenacao` | Aceita pelo colega — aguardando Coordenação (remetente) / Aceita por você — aguardando Coordenação (destinatário) | Enviadas / Recebidas, sem somar no badge profissional |
| `recusada_pelo_profissional` | Recusada pelo colega (remetente) / Recusada por você (destinatário) | Histórico |
| `recusada_pela_coordenacao` | Recusada pela Coordenação | Histórico, com motivo |
| `aprovada` | Aprovada pela Coordenação | Histórico |
| `cancelada` | Cancelada | Histórico |

Não editar as migrations antigas. Acrescentar `cancelada` ao enum e, para novos registros, guardar o resumo mínimo original dos dois vínculos (data, turno, horários, setor, função, identificadores e número de versão de origem), além de dados de cancelamento `{ profissionalId, canceladaEm }` quando aplicável. Isso preserva histórico legível mesmo após nova escala ou exclusão de vínculo. Pedidos legados continuam legíveis com a projeção disponível e indicação de contexto indisponível quando não houver informação histórica, sem inventar dados. Recusar ou cancelar pedido pendente não depende da aptidão atual dos plantões, pois não muda a escala. Se um pedido ficar inelegível, não introduzir expiração automática: mostrar impedimento ao tentar aceitar/aprovar e manter acessíveis os caminhos legítimos para encerrar.

Criar histórico profissional append-only reutilizado como recibo idempotente (por exemplo, `eventosTrocaProfissional`), com ID do pedido, ator, ação, estado de origem/destino, instante, `operacaoId` e resumo seguro. Não reutilizar `chaveIdempotencia` nem `auditoriaTrocas` administrativa para ações profissionais. Incluir índices pelos pares de participante/status e pelas chaves de evento/recibo conforme consultas e índices existentes.

### Contratos HTTP v1

As rotas profissionais ficam sob o prefixo **já existente** `/trocas/minhas`; usar `ParseObjectIdPipe` e ordenar/registrar rotas estáticas para que `GET /trocas/:id` administrativo não capture `/trocas/minhas`. Preservar a rota administrativa `POST /trocas/:id/recusar`, que não é a recusa profissional. Nomes abaixo são o contrato alvo, não a lista de rotas já implementadas.

| Método e rota | Entrada | Resultado |
| --- | --- | --- |
| `GET /trocas/minhas/contagem` | identidade da sessão | contrato existente `{ recebidas: number }`, contando recebidas em `aguardando_resposta` |
| `GET /trocas/minhas?aba=recebidas\|enviadas\|historico` | aba, `pagina`, `limite` | `{ itens, pagina, limite, total, totalPaginas }`, com ordem estável por última atualização/ID |
| `GET /trocas/minhas/plantoes` | parâmetros de período/paginação conforme consulta profissional existente | vínculos próprios futuros na última versão oficial, com a referência de competência e versão |
| `GET /trocas/minhas/plantoes/:vinculoId/candidatos` | vínculo próprio, paginação | pares `{ colega: { id, nome }, plantao, versaoOficial }`; sem CPF/COREN/contato ou dados de impedimentos privados |
| `GET /trocas/minhas/:id` | ID da troca | DTO profissional, limitado a participante, com dados de criação, resposta ou decisão |
| `POST /trocas/minhas` | `{ vinculoSolicitanteId, vinculoSolicitadoId, versaoOficialEsperada, operacaoId }` | 201 e DTO do pedido inicial; reconfirma dados oficiais e limite |
| `POST /trocas/minhas/:id/aceite` | `{ operacaoId }` | 200 e estado `aguardando_coordenacao` |
| `POST /trocas/minhas/:id/recusar` | `{ operacaoId }` | 200 e estado `recusada_pelo_profissional` |
| `POST /trocas/minhas/:id/cancelar` | `{ operacaoId }` | 200 e estado `cancelada` |
| `GET /notificacoes/trocas` | sessão, paginação se necessária | `{ notificacoes, naoLidas }` da conta, com `id, solicitacaoId, titulo, mensagem, criadoEm, lidaEm` |
| `PATCH /notificacoes/trocas/:id/lida` | ID da notificação própria | `{ id, lidaEm }`, idempotente |

DTO de troca profissional: `id, status, direcao, criadaEm, atualizadaEm, ano, mes, colega, plantaoSolicitante, plantaoSolicitado, acoesDisponiveis`. Expor datas e versão quando aplicáveis, motivo de recusa da Coordenação, não sua justificativa interna de exceção ou IDs administrativos. No DTO de detalhe e nos cartões do destinatário, use Aceita por você para o aceite; preserve a indicação Aguardando Coordenação para ambos. O resumo de plantão inclui vínculo, data, horário de início e fim, turno, setor e função. Lista Recebidas/Enviadas inclui somente pedidos ativos pela direção; Histórico inclui os terminais nos quais a sessão participou. A direção não muda depois da decisão. Se a página e o contador são consultados separadamente, reconciliar após ação sem derivar o total a partir da página visível.

Erros: 400 DTO inválido; 401 sessão inválida; 403 perfil/vínculo ou ação incompatível de participante; 404 objeto inexistente ou não visível ao ator; 409 versão, operação ou estado concorrente; 422 impedimento de negócio; 503 transação indisponível. Para erros de negócio profissionais retornar código e mensagem segura com ação sugerida, sem copiar mensagens administrativas que exponham restrições do colega.

### Concorrência, transações e notificações

O cliente gera `operacaoId` por confirmação e o conserva para retry da mesma ação. Gravar recibo com chave única por ator+operação e conferir o conteúdo da operação (ação, ID ou par e dados semânticos); retry idêntico devolve a mesma identidade e resultado confirmado sem duplicar efeitos, reaproveitamento conflitante devolve 409. Validar a autorização antes de devolver um recibo. Recarregar o estado atual do cartão após a resposta para não regredir a UI se houver decisão posterior.

Em cada comando, gravar pedido/transição, evento e notificação na mesma transação MongoDB. Atualizar o documento de solicitação com filtro pelo estado permitido para competir com aceite, recusa, cancelamento e decisão administrativa; somente um resultado terminal vence. Após conflito, ler o estado persistido e tratar como retry apenas se a chave e a intenção forem iguais. Pedidos diferentes que compartilham vínculos não garantem reserva nem cota; apenas uma aprovação compatível com vínculos e revisão vigentes pode ser efetivada. Se a publicação correr junto com o aceite, o aceite não altera plantão e não dispensa a validação final contra a versão oficial vigente. Nunca oferecer caminho não transacional para escrita.

Publicar eventos na coleção `notificacoesTroca` já usada pela Coordenação, com unicidade `eventKey + destinatarioId`. `destinatarioId` é ID de **usuário**, enquanto participação usa ID de **profissional**. Entregar os quatro tipos profissionais conforme a tabela de estados e exibir também aprovação/recusa administrativas já persistidas. Unificar no sino com os avisos de escala sem mudar contratos de `/notificacoes/escalas`: renderizador por tipo, identificadores e ações próprios, contagem de não lidas por fonte e abrir pedido em Minhas trocas com autorização revalidada. Ler a notificação não reduz o badge de recebidas pendentes.

### UI de Enfermeiro

- Em `App.tsx`, substituir o placeholder profissional para `enfermeiro` pela entrada de trocas de Enfermeiro dentro de `ProfessionalLayout`. Passar uma navegação profissional explícita à `ProfessionalOverviewPage`; seus CTAs de troca atualmente passam pela navegação administrativa. Diferenciar atalho Minhas trocas de Solicitar troca. Reutilizar a navegação por estado e informar as ações de retorno.
- Usar as referências de `telas/enfermeiro/`: `Trocas (Recebidas)`, `Trocas (Enviadas)`, `Trocas (Enviada e Cancelada)`, `Solicitação (Aceita/Recusada)` e o fluxo `Solicitar Troca (1–3)`. O cabeçalho usa nome, iniciais e perfil da sessão, nunca os nomes de exemplo.
- A jornada mostra plantões próprios, pares de colega + plantão, e resumo em duas colunas no desktop que empilham em largura menor. Preservar seleção ao voltar se válida, carregar candidatos novamente quando o vínculo inicial mudar e descartar respostas atrasadas de uma seleção anterior.
- Em Recebidas, **Você assume** é o vínculo do remetente e **[Colega] assume** é o seu. Em Enviadas, **Seu plantão** é seu vínculo original e **Plantão desejado** é o vínculo do colega. Indicar função real da alocação. Enfermeiro-chefe é função de vínculo, não perfil de acesso.
- Modais do Enfermeiro: `Container.png` recusa, `Container-1.png` cancelamento, `Container-2.png` aceite. Usar Não e confirmação com verbos claros. O feedback do aceite precisa explicitar a etapa seguinte; não usar “troca realizada”. Após recusa/cancelamento, confirmar a ação e manter o registro no Histórico, em vez de perder a solicitação na lista vazia.
- Compartilhar componentes e cliente com Técnico (abas, cartão, passo a passo, diálogos, histórico, estados de erro); a entrega da página e a validação visual de Técnico ficam no change próprio. Invalidar contadores/listas após ações e atualizar ao entrar na página e ao voltar o foco. Isolar caches por sessão e tratar respostas antigas após logout. Para tecla Tab/Escape, foco inicial/retorno, progresso anunciado, estados não baseados só em cor e mensagens acessíveis, reutilizar os componentes de UI disponíveis.

## Risks / Trade-offs

- O desenho profissional mostra um colega por linha. O par colega–plantão evita ambiguidade se houver mais de uma opção para a mesma pessoa.
- O protótipo ilustra cancelamento em Aguardando colega. RU016/RU020 e RF027 abrangem solicitações ainda não concluídas; por isso a versão especificada também permite cancelar antes da decisão da Coordenação, com disputa atômica.
- A recusa administrativa atual pode falhar quando o vínculo mudou ou a escala está em revisão, embora não altere a escala. A tarefa administrativa correspondente ajusta isso sem afrouxar os bloqueios da aprovação.
- A consulta de pares pode ser cara para escalas grandes. Pré-carregar contexto por competência, paginar e medir; não consultar o banco repetidamente para cada par nem confiar em uma lista de candidatos para autorizar a gravação.

## Migration Plan

1. Fixar DTOs/estados, alinhar o produtor ao consumidor e registrar migrações aditivas para enum, eventos, resumo original e índices necessários. Testar migração com dados administrativos anteriores.
2. Implementar leitura oficial e validação compartilhada, depois comandos profissionais e notificações, tudo testado com replica set de integração.
3. Conectar as interfaces profissionais e executar o fluxo com pedidos criados pela API, não apenas inseridos como fixture já aceita. Validar os dois perfis e as decisões administrativas antes de arquivar.
4. Em rollback, interromper novas ações, mas preservar pedidos, auditorias, notificações e versões publicadas. Não remover `cancelada` ou campos já gravados. Validar o banco do ambiente-alvo antes de liberar mutações, conforme tasks da Coordenação.
