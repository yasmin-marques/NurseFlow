# Spec Delta

## MODIFIED Requirements

### Requirement: A edição de plantão valida a equipe antes de aplicar alterações
A interface SHALL permitir editar, em um único modal lateral por dia, a equipe de um setor com o plantão de cada profissional (24 horas, diurno ou noturno), definir o enfermeiro-chefe e somente aplicar alterações depois de validar as regras e apresentar o estado da cobertura mínima.

#### Scenario: Coordenação edita um plantão
- **WHEN** a Coordenação seleciona "Editar" ao lado de um dia
- **THEN** abre o modal lateral "Editar plantões · 8 de junho" com o seletor de "Setor" e o campo "Enfermeiro chefe (plantão 24h)"
- **AND** lista todos os profissionais do setor naquele dia, cada um com o seu plantão, com cartões removíveis e a ação "Adicionar técnico ao setor"
- **AND** identifica visualmente o enfermeiro-chefe sem confundi-lo com os demais membros da equipe
- **AND** oferece "Cancelar", "Validar conflitos" e "Aplicar e salvar"
- **AND** o botão de edição existe uma única vez por dia, e não por plantão

#### Scenario: Enfermeiro-chefe é uma marca do plantão de 24 horas
- **WHEN** a Coordenação escolhe o enfermeiro-chefe
- **THEN** a lista oferece somente enfermeiros que já estão escalados em plantão de 24 horas naquele dia e setor
- **AND** a escolha apenas marca a liderança, sem criar plantão nem alterar a equipe
- **AND** plantões de 12 horas não possuem enfermeiro-chefe
- **AND** o enfermeiro-chefe também é contado e listado entre os enfermeiros em campo

#### Scenario: Coordenação adiciona um profissional ao plantão
- **WHEN** a Coordenação abre "Adicionar técnico ao setor"
- **THEN** o formulário permite pesquisar pelo nome e selecionar somente um técnico cadastrado, ativo e ainda não incluído no plantão
- **AND** permite escolher "24 horas", "Diurno" ou "Noturno" antes de adicionar
- **AND** a escolha de turno atualiza o turno/duração do plantão inteiro e se aplica a todos os profissionais nele alocados
- **AND** o formulário oferece "Cancelar" e "Adicionar à equipe"

#### Scenario: Não há profissionais disponíveis para adicionar
- **WHEN** todos os técnicos ativos já estão no plantão ou nenhum técnico ativo está disponível
- **THEN** a interface informa que não há técnico elegível para adicionar e impede a inclusão

#### Scenario: Coordenação valida e aplica uma alteração staged
- **WHEN** a Coordenação seleciona "Validar conflitos" em um formulário de plantão
- **THEN** o sistema valida o conjunto staged contra a revisão atual sem persistir alterações
- **AND** apresenta erros de alocação e pendências de quantitativo mínimo separadamente, identificando setor, data, turno, função, quantidade necessária, alocada e faltante
- **AND** apresenta "Alteração válida" somente quando não houver conflito bloqueante e mantém qualquer pendência de cobertura identificada como aviso
- **AND** acrescenta ao conjunto staged somente uma alteração sem conflito bloqueante depois que a Coordenação reconhecer explicitamente o aviso de cobertura abaixo do mínimo
- **AND** cancelar o formulário descarta apenas as mudanças ainda não aplicadas, sem remover outras alterações staged

#### Scenario: Coordenação reconhece cobertura abaixo do mínimo
- **WHEN** a pré-validação encontra vaga abaixo do quantitativo mínimo configurado, sem conflito bloqueante
- **THEN** a interface mantém visíveis a cobertura pendente e suas quantidades e solicita confirmação explícita antes de aplicar a alteração staged
- **AND** registra a decisão para que a persistência da alteração possa auditá-la

#### Scenario: Coordenação salva alterações staged
- **WHEN** a Coordenação seleciona "Aplicar e salvar" no modal, ou "Salvar alterações" com alterações que continuam pendentes após uma falha
- **THEN** o sistema revalida e persiste todo o lote em uma única transação e incrementa a revisão da escala uma vez
- **AND** após sucesso, a interface limpa o conjunto staged e mostra "ALTERAÇÕES SALVAS" com a etapa "Validar conflitos" ativa
- **AND** se a gravação falhar, nenhuma alteração é persistida e o conjunto staged é preservado para correção ou nova tentativa
- **AND** a validação apresenta cada conflito uma única vez, somente para os profissionais da equipe editada

## ADDED Requirements

### Requirement: A interface distingue validação de publicação ao regenerar
A interface SHALL permitir substituir explicitamente uma escala validada cuja versão atual ainda não foi publicada, sem confundir o estado validado com publicação efetiva. Escalas publicadas ou finalizadas continuam protegidas contra substituição.

#### Scenario: Regenerar escala validada ainda não publicada
- **WHEN** a consulta atual do período informa uma escala em estado `validada`
- **THEN** a interface permite confirmar explicitamente a substituição, informa que o conteúdo só será trocado após a geração concluída e envia a confirmação à API
- **AND** não apresenta a escala como publicada
- **AND** após sucesso, atualiza a tela com o rascunho regenerado e sua nova revisão

#### Scenario: Bloquear escala publicada ou finalizada
- **WHEN** a consulta do período informa uma escala `publicada` ou `finalizada`
- **THEN** a interface explica o estado real e impede a substituição
- **AND** mantém visível o conteúdo oficial sem iniciar nova geração

### Requirement: A revisão do plantão identifica o enfermeiro-chefe
A interface SHALL apresentar o enfermeiro-chefe dos plantões de 24 horas na revisão por data e turno, distinguindo-o dos demais profissionais e indicando sua ausência quando não houver liderança registrada. Plantões de 12 horas não possuem enfermeiro-chefe.

#### Scenario: Plantão de 24 horas possui enfermeiro-chefe
- **WHEN** a Coordenação consulta a revisão de um plantão de 24 horas que possui profissional marcado como liderança
- **THEN** a revisão destaca o nome desse profissional com o rótulo "Enfermeiro chefe" no plantão correspondente
- **AND** mantém todos os enfermeiros, inclusive o chefe, e os técnicos identificados por função

#### Scenario: Plantão de 24 horas não possui enfermeiro-chefe
- **WHEN** a Coordenação consulta a revisão de um plantão de 24 horas sem liderança registrada
- **THEN** a revisão informa explicitamente "Nenhum enfermeiro chefe escalado" e não atribui liderança a outro profissional

#### Scenario: Plantão de 12 horas
- **WHEN** a Coordenação consulta a revisão de um plantão de 12 horas
- **THEN** a revisão não exibe linha de enfermeiro-chefe

### Requirement: A criação manual apresenta o turno e a cobertura mínima
A interface SHALL permitir configurar o turno da equipe na criação manual e apresentar alertas de cobertura calculados com base nos quantitativos mínimos do setor antes de confirmar a inclusão.

#### Scenario: Coordenação inicia montagem manual sem escala no período
- **WHEN** a Coordenação abre um período sem escala e seleciona "Montar manualmente"
- **THEN** o sistema cria um rascunho usando o período atual e abre o formulário de inclusão manual
- **AND** se a criação falhar, informa o erro sem apresentar o rascunho como criado

#### Scenario: Coordenação cria plantão manualmente
- **WHEN** a Coordenação inicia a criação manual de um plantão
- **THEN** pode selecionar setor, data, "24 horas", "Diurno" ou "Noturno", e profissionais cadastrados; o enfermeiro-chefe só pode ser indicado em plantão de 24 horas
- **AND** a escolha do turno aplica-se ao plantão e a todos os profissionais nele alocados
- **AND** a validação apresenta os quantitativos mínimos configurados para o setor, turno e funções, com as quantidades alocadas e vagas restantes

#### Scenario: Plantão deixa o setor abaixo do mínimo
- **WHEN** a equipe proposta não completa o quantitativo mínimo configurado para o setor e turno
- **THEN** a interface identifica a cobertura pendente e suas quantidades antes de confirmar
- **AND** não apresenta a cobertura como completa nem oculta a pendência
- **AND** permite prosseguir somente após a Coordenação reconhecer explicitamente o alerta, sem tratar a pendência como conflito bloqueante

#### Scenario: Plantão atende ao mínimo configurado
- **WHEN** a equipe proposta atende aos quantitativos mínimos do setor para o turno escolhido
- **THEN** a interface confirma a cobertura mínima para cada função sem substituir os demais resultados de validação
