# Spec Delta

> As regras de negócio profissionais abaixo se aplicam a Enfermeiros e Técnicos. A composição de interface descrita para Enfermeiro não substitui a especificação da tela de Técnico.

## ADDED Requirements

### Requirement: Isolar acesso de profissionais às próprias trocas

O sistema MUST autenticar Enfermeiro e Técnico e associar cada operação ao profissional cadastrado vinculado à sessão. MUST limitar listas, detalhes, comandos e notificações ao papel desse profissional em cada pedido, sem expor dados pessoais ou restrições individuais dos colegas.

#### Scenario: Enfermeiro acessa suas trocas

- **WHEN** um Enfermeiro autenticado e vinculado a um cadastro profissional acessa Trocas
- **THEN** o sistema apresenta Minhas trocas no contexto do perfil Enfermeiro, sem abas ou comandos exclusivos da Coordenação

#### Scenario: Acessar pedido ou notificação de terceiro

- **WHEN** um profissional tenta consultar ou manipular pedido alheio ou ler/marcar uma notificação de outro destinatário
- **THEN** o sistema nega a operação sem revelar conteúdo nem alterar dados

#### Scenario: Sessão ou perfil incompatível

- **WHEN** as credenciais são inválidas, o perfil não é profissional ou não há vínculo profissional válido
- **THEN** o sistema nega o fluxo profissional e não aceita perfil, ator ou status declarados pelo cliente

### Requirement: Escolher dois vínculos elegíveis na escala oficial

O sistema MUST oferecer somente plantões próprios ainda não iniciados na versão oficial vigente e pares colega–plantão elegíveis. MUST avaliar a permuta inteira para ambos os profissionais, respeitando formação e função dos vínculos, competência mensal, disponibilidade, restrições, descanso, sobreposição, carga e cobertura segundo as regras da escala.

#### Scenario: Escolher o plantão a oferecer

- **WHEN** o Enfermeiro inicia Nova solicitação
- **THEN** o primeiro passo mostra seus plantões elegíveis com data, horário, setor e função e não mostra plantões de rascunhos, iniciados ou de outros profissionais como selecionáveis

#### Scenario: Selecionar colega e plantão em conjunto

- **WHEN** o profissional escolhe um plantão próprio
- **THEN** o segundo passo permite selecionar um par de colega apto e um vínculo específico do mesmo mês e ano, identificando o plantão caso o colega tenha mais de uma opção

#### Scenario: Impedir permuta que não atende às funções ou à folga

- **WHEN** o colega não pode assumir a função de um dos vínculos ou a permuta projetada viola o descanso ou outra regra obrigatória
- **THEN** o par não é oferecido como opção elegível e o envio direto pela API é recusado sem criar pedido

#### Scenario: Não há opção válida

- **WHEN** não há colega e plantão aptos para o vínculo selecionado
- **THEN** o sistema apresenta estado vazio explicativo com opção de voltar, sem revelar informações privadas dos colegas

### Requirement: Registrar solicitação profissional sem alterar a escala

O sistema MUST permitir revisar os dois vínculos e enviar o pedido em `aguardando_resposta` somente se os dados oficiais e o limite de abertura continuarem válidos. O envio MUST registrar o pedido e notificar o destinatário uma única vez, sem modificar escala ou consumir cota mensal.

#### Scenario: Confirmar o envio de um pedido válido

- **WHEN** o profissional revisa o colega, seu plantão e o plantão desejado e confirma Enviar solicitação
- **THEN** o pedido aparece em Enviadas com Aguardando colega e o destinatário recebe uma notificação interna dirigida ao pedido

#### Scenario: Impedir abertura no limite mensal

- **WHEN** o solicitante já atingiu o limite configurado para a competência comum dos plantões
- **THEN** o sistema informa o impedimento e não cria o pedido nem a notificação, sem oferecer exceção profissional

#### Scenario: Dados mudam depois da seleção

- **WHEN** um vínculo muda de titular, deixa de existir, já começou, não pertence à competência ou a permuta deixa de ser elegível antes de enviar
- **THEN** o sistema recusa o envio, informa como atualizar a seleção e preserva a escala

#### Scenario: Repetir o envio

- **WHEN** o cliente repete a mesma operação de envio após falha de resposta
- **THEN** o sistema retorna o mesmo resultado autorizado sem duplicar pedido, histórico ou notificação

### Requirement: Responder solicitação recebida em duas etapas

Somente o destinatário MUST poder aceitar ou recusar um pedido em `aguardando_resposta`, mediante confirmação. O sistema MUST revalidar as condições atuais antes de aceitar, registrar a resposta e informar o solicitante. Somente o aceite registrado pelo servidor MUST colocar a troca em `aguardando_coordenacao`.

#### Scenario: Aceitar sem efetivar

- **WHEN** o destinatário confirma o aceite e a permuta segue elegível
- **THEN** o sistema registra autor e instante do aceite, notifica o remetente e apresenta Aguardando Coordenação aos dois, com a autoria do aceite adequada a cada visão, sem alterar vínculos, versão oficial ou contagem mensal

#### Scenario: Estado dos vínculos ou aptidão muda antes do aceite

- **WHEN** o destinatário confirma o aceite e os vínculos ou as condições obrigatórias já não permitem a permuta
- **THEN** o sistema informa o impedimento, não envia o pedido à Coordenação e não persiste um falso aceite

#### Scenario: Recusar uma solicitação recebida

- **WHEN** o destinatário confirma a recusa de pedido que ainda aguarda sua resposta
- **THEN** o sistema registra `recusada_pelo_profissional`, notifica o solicitante e encerra o pedido sem exigir justificativa administrativa nem mudar a escala

#### Scenario: Abandonar o diálogo

- **WHEN** o profissional escolhe Não ou fecha a confirmação sem confirmar
- **THEN** o sistema não registra resposta ou cancelamento

### Requirement: Cancelar solicitação própria ainda pendente

Somente o remetente MUST poder cancelar, mediante confirmação, um pedido ainda aguardando o colega ou a Coordenação. O cancelamento MUST encerrar o pedido, registrar ator e instante no histórico, notificar o destinatário e impedir decisão administrativa posterior sobre esse pedido. Um pedido terminal MUST NOT ser cancelável.

#### Scenario: Cancelar antes da resposta

- **WHEN** o remetente confirma Cancelar solicitação em um pedido aguardando colega
- **THEN** o pedido sai das listas ativas, fica no Histórico como Cancelada e deixa de aceitar ações do colega

#### Scenario: Cancelar após o aceite e antes da decisão

- **WHEN** o remetente confirma o cancelamento enquanto o pedido aguarda a Coordenação e seu comando é confirmado primeiro
- **THEN** o pedido fica Cancelada, desaparece da fila da Coordenação e sua contagem de pendências é atualizada, sem alteração da escala ou consumo de cota

#### Scenario: Decisão administrativa e cancelamento concorrentes

- **WHEN** uma decisão terminal administrativa e um cancelamento disputam o mesmo pedido
- **THEN** apenas uma conclusão é registrada, a operação perdedora recebe conflito e não há efeitos parciais ou duplicados

### Requirement: Acompanhar trocas e resultados profissionais

O sistema MUST apresentar ao profissional suas solicitações recebidas, enviadas e concluídas, distinguindo as etapas de resposta e Coordenação. MUST mostrar os dois plantões com sua direção corretamente identificada e manter o status independente da cor. O badge profissional MUST contar apenas pedidos recebidos ainda em `aguardando_resposta` do usuário autenticado.

#### Scenario: Exibir as abas de Enfermeiro

- **WHEN** um Enfermeiro abre Minhas trocas
- **THEN** vê Recebidas, Enviadas e Histórico com dados próprios, Nova solicitação e estados de carregamento, vazio, erro e tentativa novamente

#### Scenario: Mostrar a direção da permuta

- **WHEN** o profissional consulta a solicitação recebida
- **THEN** Você assume aponta para o plantão oferecido pelo remetente e o colega assume aponta para o plantão originalmente do destinatário

#### Scenario: Acompanhar decisão aprovada

- **WHEN** a Coordenação aprova e publica atomicamente a troca
- **THEN** ambos veem Aprovada pela Coordenação no histórico, recebem o resultado e veem os novos plantões em Meus plantões a partir da versão oficial

#### Scenario: Acompanhar recusa pela Coordenação

- **WHEN** a Coordenação recusa a solicitação
- **THEN** ambos veem Recusada pela Coordenação e seu motivo visível, recebem o resultado e continuam vendo os plantões anteriores na escala oficial

#### Scenario: Recarregar estado após erro ou conflito

- **WHEN** uma falha de rede ou conflito impede a confirmação de um comando
- **THEN** a interface não anuncia sucesso e permite retomar ou recarregar a partir do estado persistido, sem duplicar efeitos

#### Scenario: Operar com teclado e leitor de tela

- **WHEN** o profissional navega pelas abas, passos, cartões e diálogos sem mouse
- **THEN** consegue identificar seleção, etapa, status, ações e resultados por rótulos e foco acessível
