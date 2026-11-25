# Spec Delta

## Purpose

Garantir que **Técnicos de Enfermagem** possam utilizar a jornada de solicitações de troca do NurseFlow com tela e contexto próprios, utilizando o **domínio profissional compartilhado**: solicitar a troca de dois plantões aptos, aceitar/recusar pedidos recebidos, cancelar pedidos enviados pendentes e acompanhar o resultado definitivo da Coordenação, sem jamais editar a escala por conta própria.

> **Dependência:** a API e as regras profissionais comuns estão em `openspec/changes/implementar-trocas-enfermeiro/design.md` (referência relativa a este arquivo: `../../../implementar-trocas-enfermeiro/design.md`). Esta spec acrescenta requisitos **específicos de experiência, acesso e homologação do Técnico** à capacidade `trocas`, sem declarar um segundo módulo. Os fluxos básicos de solicitação/resposta e o cancelamento pertencem ao contrato profissional v1.

## ADDED Requirements

### Requirement: Disponibilizar a área profissional de trocas ao Técnico

O sistema MUST permitir que o usuário autenticado com perfil **Técnico** acesse **Minhas trocas** e **Solicitar troca** em sua área profissional, com identificação correta de sessão e as abas **Recebidas**, **Enviadas** e **Histórico**. O sistema MUST NOT apresentar ações de aprovação, recusa administrativa, edição ou publicação da escala nessa área.

#### Scenario: Técnico abre Trocas

- **WHEN** um Técnico autenticado seleciona Trocas no menu ou um atalho da visão geral
- **THEN** o sistema apresenta Minhas trocas com o contexto e dados do Técnico, sem abrir página da Coordenação ou placeholder

#### Scenario: Iniciar nova solicitação

- **WHEN** o Técnico seleciona Nova solicitação
- **THEN** o sistema abre a primeira etapa de Solicitar troca, preservando a navegação profissional e permitindo retornar sem gravar

#### Scenario: Técnico tenta acessar rota administrativa

- **WHEN** uma sessão de Técnico acessa diretamente uma rota de aprovação/recusa administrativa ou sua tela por manipulação de URL/estado
- **THEN** a API nega a ação e a interface não oferece esses controles, preservando pedido, escala e auditoria

### Requirement: Isolar dados de trocas por identidade e perfil

O sistema MUST obter a identidade do Técnico da sessão autenticada, associá-la ao cadastro profissional correto e mostrar apenas seus pedidos recebidos e enviados, seus vínculos próprios na seleção e os dados mínimos necessários dos colegas. O sistema MUST proteger esse isolamento também nas consultas e nas ações diretas da API.

#### Scenario: Consultar pedido próprio

- **WHEN** um Técnico consulta pedido em que é solicitante ou destinatário
- **THEN** o sistema apresenta o resumo dos dois vínculos, colega, direção, situação e ações permitidas à sua participação

#### Scenario: Consultar ou modificar pedido de terceiro

- **WHEN** um Técnico tenta ler, aceitar, recusar ou cancelar pedido de que não participa
- **THEN** a API nega a consulta/alteração sem expor dados privados ou modificar o registro

#### Scenario: Alternar de usuário no navegador

- **WHEN** a sessão de um Enfermeiro ou outro Técnico termina e um novo Técnico autentica no mesmo navegador
- **THEN** listas, seleção parcial, badge, notificações e requisições antigas não aparecem na nova sessão

#### Scenario: Exibir colegas para seleção

- **WHEN** a API devolve candidatos aptos para o plantão próprio
- **THEN** a interface mostra apenas a identificação necessária e o plantão do colega, sem CPF, COREN, contato ou detalhes de restrições privadas

### Requirement: Consultar Recebidas, Enviadas e Histórico com direção correta

O sistema MUST separar as solicitações recebidas e enviadas pelo Técnico, preservar os dois vínculos da permuta e mostrar seus estados finais no Histórico. A interface MUST usar dados persistidos, sem preencher listas com exemplos das imagens.

#### Scenario: Consultar Recebidas

- **WHEN** o Técnico seleciona Recebidas
- **THEN** o sistema mostra pedidos em que ele é o destinatário, com colega, plantão oferecido pelo solicitante, plantão que ele oferece e situação correta

#### Scenario: Consultar Enviadas

- **WHEN** o Técnico seleciona Enviadas
- **THEN** o sistema mostra os pedidos criados por ele e distingue **Seu plantão** de **Plantão desejado**, incluindo data, horário, setor e função de cada um

#### Scenario: Consultar Histórico

- **WHEN** o Técnico seleciona Histórico
- **THEN** o sistema mostra pedidos concluídos enviados e recebidos com status final, instante e motivo de recusa administrativa quando existente

#### Scenario: Nenhum pedido corresponde à aba

- **WHEN** a API retorna uma lista vazia válida
- **THEN** a interface apresenta mensagem contextual de ausência de pedidos, sem tratar zero como erro nem inserir solicitações fictícias

### Requirement: Exibir contagem real de recebidas aguardando resposta

O sistema MUST exibir um contador profissional obtido do backend, correspondente às solicitações **recebidas por aquela sessão em `aguardando_resposta`**. O contador MUST NOT incorporar pedidos enviados, aceitos/aguardando Coordenação ou notificações lidas e MUST NOT usar valores fixos.

#### Scenario: Novo pedido recebido

- **WHEN** outro profissional cria uma solicitação válida dirigida ao Técnico
- **THEN** o contador de recebidas pendentes da sessão reflete esse pedido após atualização dos dados

#### Scenario: Pedido recebido foi aceito ou recusado

- **WHEN** o destinatário confirma uma resposta e o servidor persiste a transição
- **THEN** o pedido deixa de contar como aguardando resposta, sem desaparecer indevidamente do acompanhamento

#### Scenario: Contagem zero ou serviço indisponível

- **WHEN** a API retorna zero ou falha ao consultar a contagem
- **THEN** a interface distingue zero real de indisponibilidade e não substitui falha por número ilustrativo

### Requirement: Selecionar plantão próprio e candidato técnico aptos

O sistema MUST oferecer um fluxo de **três etapas** que consulte somente vínculos próprios da versão oficial, ainda não iniciados, e apresente pares **colega–plantão** elegíveis para permuta. As duas alocações resultantes MUST respeitar formação e função, disponibilidade, descanso, cobertura, competência e demais regras comuns; nenhum Técnico pode assumir função de Enfermeiro ou Enfermeiro-chefe.

#### Scenario: Selecionar plantão próprio

- **WHEN** o Técnico inicia a primeira etapa
- **THEN** são apresentados somente seus vínculos oficiais elegíveis, com data, horário/turno, setor e função reais

#### Scenario: Selecionar colega e plantão

- **WHEN** o Técnico escolhe um vínculo próprio válido e avança à etapa de candidatos
- **THEN** vê pares de colega e plantão identificáveis, aptos para a permuta daquele vínculo, inclusive múltiplos plantões distintos do mesmo colega quando elegíveis

#### Scenario: Tentar assumir função incompatível

- **WHEN** a permuta atribuiria a qualquer Técnico função de Enfermeiro ou Enfermeiro-chefe
- **THEN** a opção é excluída dos candidatos e uma tentativa direta é rejeitada pelo servidor sem criar a solicitação

#### Scenario: Dois plantões em competências distintas

- **WHEN** os vínculos selecionados pertencem a meses/anos ou escalas oficiais distintos, ou já começaram
- **THEN** o backend recusa o envio, informa o impedimento aplicável e mantém a escala inalterada

#### Scenario: Compatibilidade de setor fixo e subsetor

- **WHEN** o Técnico ou Enfermeiro seleciona um colega
- **THEN** os profissionais devem ter a mesma formação e o mesmo setor fixo cadastrado
- **AND** Técnicos devem ter o mesmo subsetor; ausência de subsetor corresponde somente a outra ausência
- **AND** a cobertura continua sendo avaliada pelos setores dos plantões

#### Scenario: Mudar o plantão na primeira etapa

- **WHEN** o Técnico retorna ao primeiro passo e seleciona outro vínculo
- **THEN** o candidato escolhido anteriormente é descartado e a seleção é validada novamente para o novo contexto

#### Scenario: Resposta de candidatos desatualizada

- **WHEN** a escala ou a aptidão muda após a consulta inicial
- **THEN** a confirmação no servidor refaz as validações e não permite envio baseado apenas no estado exibido anteriormente

### Requirement: Revisar e solicitar troca como Técnico

O sistema MUST apresentar os **dois plantões** e o colega destinatário na revisão final, exigir confirmação explícita de envio e persistir a solicitação inicialmente em `aguardando_resposta`, sem alteração de plantões oficiais nem consumo de limite. MUST verificar o limite configurado para a competência ao abrir a solicitação.

#### Scenario: Enviar uma proposta válida

- **WHEN** o Técnico revisa um par apto e seleciona Enviar solicitação
- **THEN** o servidor cria um único pedido `aguardando_resposta`, notifica o destinatário e a interface mostra **Aguardando colega**

#### Scenario: Solicitante atingiu o limite configurado

- **WHEN** o Técnico já atingiu seu limite vigente de trocas aprovadas no mês
- **THEN** a API impede nova solicitação, mostra uma explicação e não presume que o limite seja sempre três

#### Scenario: Falha durante o envio

- **WHEN** o envio falha ou sua confirmação não chega ao navegador
- **THEN** o sistema não afirma que a solicitação foi criada e permite reconciliar/repetir a operação com idempotência sem criar pedido duplicado

### Requirement: Permitir ao Técnico responder pedidos recebidos

O sistema MUST oferecer **Aceitar troca** e **Recusar** apenas ao Técnico destinatário de pedido em `aguardando_resposta`, com confirmações próprias. Aceitar MUST avançar para `aguardando_coordenacao` e MUST NOT efetivar a troca; recusar MUST encerrar como `recusada_pelo_profissional` e notificar o remetente.

#### Scenario: Abrir confirmação de aceite

- **WHEN** o Técnico seleciona Aceitar troca em uma recebida pendente
- **THEN** o sistema apresenta o modal de aceite com opções Não e confirmação afirmativa, sem enviar comando antes da confirmação

#### Scenario: Confirmar aceite válido

- **WHEN** o Técnico confirma o aceite e o servidor revalida e grava a resposta
- **THEN** o pedido passa a `aguardando_coordenacao`, fica elegível à fila da Coordenação e a escala oficial permanece inalterada

#### Scenario: Recusar pedido recebido

- **WHEN** o Técnico confirma a recusa de pedido que aguarda sua resposta
- **THEN** a solicitação passa a `recusada_pelo_profissional`, o remetente é notificado e nenhum plantão é alterado

#### Scenario: Aceite não está mais permitido

- **WHEN** o destinatário tenta aceitar pedido cancelado, recusado, alterado ou que deixou de ser apto
- **THEN** a API bloqueia a transição, informa o estado/impedimento e não registra aceite falso nem adiciona pendência à Coordenação

#### Scenario: Fechar ou negar confirmação

- **WHEN** o Técnico seleciona Não, fecha o modal ou usa Escape
- **THEN** o sistema fecha o diálogo sem enviar ação e preserva o estado da solicitação

### Requirement: Permitir cancelamento do pedido enviado ainda não concluído

O sistema MUST permitir ao **remetente Técnico** cancelar uma solicitação ainda em `aguardando_resposta` ou `aguardando_coordenacao`, mediante confirmação. MUST proibir o cancelamento de pedido com decisão final, registrar `cancelada` no histórico e retirar eventual pendência da Coordenação sem alterar a escala.

#### Scenario: Cancelar antes do aceite

- **WHEN** o Técnico remetente confirma o cancelamento de pedido `aguardando_resposta`
- **THEN** o servidor registra `cancelada`, notifica o destinatário e mostra o resultado no Histórico

#### Scenario: Cancelar depois do aceite e antes da decisão

- **WHEN** o remetente confirma o cancelamento de pedido `aguardando_coordenacao`
- **THEN** o pedido sai da fila e do contador administrativo, passa a `cancelada` e conserva histórico/escala sem nova versão

#### Scenario: Tentar cancelar pedido concluído

- **WHEN** o Técnico tenta cancelar pedido aprovado, recusado ou já cancelado
- **THEN** o sistema nega uma nova transição e não desfaz decisões anteriores

#### Scenario: Decisão concorrente ao cancelamento

- **WHEN** cancelamento e decisão da Coordenação competem sobre o mesmo pedido
- **THEN** no máximo uma transição final é persistida; a outra operação não cria status, versão, contagem ou notificações contraditórios

### Requirement: Acompanhar decisão da Coordenação sem antecipar a troca

O sistema MUST preservar a etapa obrigatória da Coordenação para todo pedido aceito. MUST mostrar status final, motivo de eventual recusa administrativa, notificações relevantes e, após **aprovação efetivada**, recarregar os plantões da última versão oficial.

#### Scenario: Pedido aceito aguarda a Coordenação

- **WHEN** o colega aceita a troca solicitada pelo Técnico
- **THEN** o Técnico vê **Aguardando Coordenação** e seus plantões oficiais continuam como antes

#### Scenario: Coordenação aprova troca de Técnicos

- **WHEN** a Coordenação valida e aprova definitivamente o pedido
- **THEN** ambos os Técnicos veem status aprovado, notificações e as novas atribuições carregadas da versão oficial atualizada

#### Scenario: Coordenação recusa com motivo

- **WHEN** a Coordenação recusa a solicitação aceita
- **THEN** os dois profissionais visualizam a recusa e o motivo, e a escala oficial não é alterada

#### Scenario: Escala tem revisão administrativa aberta

- **WHEN** há revisão não publicada do período durante a análise de uma troca já aceita
- **THEN** a interface profissional conserva a última versão publicada e o pedido pendente, sem simular aprovação

### Requirement: Integrar notificações de troca ao contexto Técnico

O sistema MUST expor ao Técnico apenas notificações de troca destinadas à sua conta, incluindo pedido recebido, aceite, recusa, cancelamento e decisão administrativa, e integrá-las às notificações de escala existentes sem confundir leitura com resposta.

#### Scenario: Receber pedido

- **WHEN** uma solicitação é criada para o Técnico
- **THEN** o sistema apresenta uma notificação de troca na sua conta, com caminho para abrir o pedido próprio

#### Scenario: Marcar aviso como lido

- **WHEN** o Técnico marca uma notificação sua como lida
- **THEN** a notificação atualiza `lidaEm`, mas o pedido continua com seu estado original até uma ação legítima

#### Scenario: Abrir notificação de outro usuário

- **WHEN** o Técnico tenta acessar o ID de notificação destinada a outra conta
- **THEN** a API impede leitura ou atualização sem revelar o conteúdo do evento

### Requirement: Manter experiência clara, acessível e recuperável

O sistema MUST reproduzir a organização visual dos 11 protótipos do Técnico com componentes funcionais, mensagens e controles acessíveis, estados de carregamento, vazio, processamento, conflito e erro. A interface MUST continuar utilizável por teclado e em telas estreitas, sem depender apenas de cores para transmitir status.

#### Scenario: Confirmar por teclado

- **WHEN** o Técnico navega por abas, cartões, assistente e diálogos usando teclado
- **THEN** pode focar e acionar os controles, compreender o estado e retornar ao acionador após fechar o diálogo

#### Scenario: Falha de rede na lista ou na ação

- **WHEN** a consulta ou operação falha
- **THEN** o sistema mostra mensagem compreensível, informa a ação possível e não representa falha como sucesso

#### Scenario: Tela estreita

- **WHEN** o Técnico usa largura reduzida
- **THEN** os dois plantões permanecem identificáveis, os comandos são acessíveis e o conteúdo não exige interação impossível

#### Scenario: Clique repetido durante processamento

- **WHEN** o Técnico tenta confirmar várias vezes a mesma operação
- **THEN** a interface evita múltiplos envios intencionais e a API garante que não sejam criados resultados duplicados
