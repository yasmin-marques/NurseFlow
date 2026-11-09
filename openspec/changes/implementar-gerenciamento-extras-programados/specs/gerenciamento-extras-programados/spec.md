# Spec Delta

## Purpose

Permite à Coordenação planejar, consultar e administrar plantões extras para cobrir afastamentos e reforçar equipes, mantendo os registros consistentes com as escalas, as regras profissionais e o histórico operacional.

## ADDED Requirements

### Requirement: Consultar extras programados por período
O sistema SHALL permitir à Coordenação consultar os extras programados por mês e ano, com situação, data, turno, setor, função, motivo, profissional designado e, quando aplicável, profissional coberto.

#### Scenario: Consultar mês com extras
- **WHEN** a Coordenação seleciona um mês com extras registrados
- **THEN** o sistema apresenta os extras desse período com suas informações e situações atualizadas

#### Scenario: Consultar mês sem extras
- **WHEN** a Coordenação seleciona um mês sem extras registrados
- **THEN** o sistema apresenta um estado vazio, sem inventar registros ou totais

#### Scenario: Buscar e filtrar extras
- **WHEN** a Coordenação informa uma busca ou seleciona filtros de motivo, situação ou setor
- **THEN** a listagem mostra apenas os registros correspondentes e permite remover os filtros

### Requirement: Exibir indicadores de extras e cobertura
O sistema SHALL apresentar indicadores calculados com dados persistidos, distinguindo extras programados ativos, horas programadas, profissionais RPA ativos e posições de cobertura ainda descobertas no período.

#### Scenario: Calcular indicadores mensais
- **WHEN** a Coordenação consulta um período
- **THEN** o sistema apresenta a quantidade de extras ativos e a soma de suas horas programadas, sem contar extras cancelados como cobertura ativa

#### Scenario: Exibir profissionais RPA
- **WHEN** há profissionais ativos com vínculo RPA cadastrados
- **THEN** o sistema apresenta a quantidade correspondente conforme o escopo identificado no indicador

#### Scenario: Exibir cobertura descoberta
- **WHEN** a escala do período possui posições não preenchidas
- **THEN** o sistema mostra o total de posições descobertas com base na cobertura real da escala, sem contabilizar extras ainda não vinculados como posições já preenchidas

#### Scenario: Não há escala no período
- **WHEN** a Coordenação consulta um período sem escala criada
- **THEN** o sistema distingue cobertura ainda não calculada de cobertura completa ou de zero vagas descobertas

### Requirement: Registrar extra programado
O sistema SHALL permitir à Coordenação registrar um extra com motivo, data, duração ou turno, setor, função e profissional substituto, preservando sua identidade, situação e vínculo com a cobertura a realizar.

#### Scenario: Registrar cobertura de afastamento
- **WHEN** a Coordenação informa um afastamento, identifica o profissional coberto, seleciona um substituto elegível e confirma a programação
- **THEN** o sistema persiste um extra relacionado ao profissional coberto, ao substituto e ao motivo da cobertura

#### Scenario: Registrar reforço de equipe
- **WHEN** a Coordenação seleciona motivo de reforço e informa um substituto elegível
- **THEN** o sistema permite registrar o extra sem exigir profissional coberto

#### Scenario: Programar extra antes da escala mensal
- **WHEN** a Coordenação registra um extra válido para um período que ainda não possui escala gerada
- **THEN** o sistema preserva a programação sem inventar uma alocação confirmada em uma escala inexistente

#### Scenario: Rejeitar campos obrigatórios ausentes
- **WHEN** a Coordenação tenta registrar um extra sem os dados exigidos para o motivo selecionado
- **THEN** o sistema informa os campos pendentes e não cria registro parcial

### Requirement: Validar elegibilidade e conflitos antes de registrar ou alterar extra
O sistema MUST verificar no servidor a formação, a situação profissional, as indisponibilidades, turnos permitidos, vínculos externos, sobreposições, descanso e limites de extras segundo as regras vigentes, recusando operações inválidas sem persistência parcial.

#### Scenario: Substituto disponível e habilitado
- **WHEN** o substituto possui formação compatível e não há restrições impeditivas para o horário integral do extra
- **THEN** o sistema permite a confirmação, observados os demais limites do período

#### Scenario: Substituto em férias ou ausência
- **WHEN** o horário do extra coincide com férias ou ausência impeditiva do substituto
- **THEN** o sistema rejeita a operação, identifica a restrição e preserva os dados anteriores

#### Scenario: Conflito com turno ou vínculo externo
- **WHEN** o horário integral do extra coincide com turno não permitido ou trabalho externo impeditivo
- **THEN** o sistema rejeita a operação conforme as regras de conflito aplicáveis ao período e informa o motivo

#### Scenario: Descanso ou limite mensal excedido
- **WHEN** o extra viola descanso obrigatório ou limite de extras aplicável ao vínculo e período
- **THEN** o sistema informa a regra violada e não confirma a programação

#### Scenario: Alocação duplicada
- **WHEN** a operação cria uma alocação duplicada do mesmo profissional na mesma cobertura ou em jornada sobreposta
- **THEN** o sistema rejeita a duplicidade sem criar registros adicionais

### Requirement: Preservar distinção entre motivo, vínculo e tipo de plantão
O sistema MUST distinguir o motivo da cobertura, o vínculo empregatício do profissional e a natureza extra da alocação, sem inferir que todo profissional RPA realiza apenas extras ou que todo extra exige RPA.

#### Scenario: Extra realizado por profissional CLT ou concursado
- **WHEN** a Coordenação seleciona profissional elegível com vínculo CLT ou concursado para cobrir extra
- **THEN** o sistema registra a alocação como extra e preserva o vínculo profissional existente

#### Scenario: Profissional RPA em extra
- **WHEN** a Coordenação designa profissional com vínculo RPA
- **THEN** o sistema preserva esse vínculo, sem substituir o motivo do extra por RPA

### Requirement: Vincular extras às escalas sem duplicação
O sistema SHALL manter a programação do extra consistente com a escala correspondente, distinguindo um extra programado de um plantão efetivamente alocado e sem criar coberturas duplicadas.

#### Scenario: Sincronizar extra com escala em revisão
- **WHEN** existe escala editável para o período e o extra é confirmado para uma cobertura válida
- **THEN** o sistema atualiza a relação entre extra e plantão de forma consistente e reflete a cobertura no resultado da escala

#### Scenario: Gerar ou regenerar escala com extra já programado
- **WHEN** uma escala é criada ou regenerada para um período que possui extras programados ativos
- **THEN** o sistema preserva a identidade dos extras, reconcilia suas relações com os plantões e não duplica coberturas

#### Scenario: Falha durante sincronização
- **WHEN** a atualização do extra e da escala não puder ser concluída integralmente
- **THEN** o sistema não informa sucesso nem deixa uma cobertura confirmada de forma inconsistente

### Requirement: Editar extras programados
O sistema SHALL permitir à Coordenação alterar extras em estado editável, reaplicando as validações e preservando os relacionamentos e o histórico do registro.

#### Scenario: Editar extra válido
- **WHEN** a Coordenação modifica data, turno, setor, motivo ou substituto e os novos dados são válidos
- **THEN** o sistema persiste a alteração e atualiza os indicadores e a relação com a escala quando aplicável

#### Scenario: Rejeitar edição conflitante
- **WHEN** os novos dados criam uma restrição impeditiva
- **THEN** o sistema rejeita a alteração e mantém a versão persistida anteriormente

#### Scenario: Registro alterado por outra operação
- **WHEN** a Coordenação tenta salvar uma edição baseada em versão desatualizada
- **THEN** o sistema informa o conflito de concorrência e preserva a versão mais recente

### Requirement: Cancelar extras preservando histórico
O sistema SHALL permitir cancelar um extra com justificativa, sem apagar o registro histórico, e atualizar a cobertura e os indicadores associados.

#### Scenario: Cancelar extra programado
- **WHEN** a Coordenação confirma o cancelamento com justificativa
- **THEN** o sistema registra o cancelamento e deixa de contar o extra como cobertura ativa

#### Scenario: Cancelar extra vinculado à escala
- **WHEN** um extra vinculado a uma escala editável é cancelado
- **THEN** a escala e os indicadores são atualizados e a eventual posição descoberta volta a ser evidenciada

#### Scenario: Repetir cancelamento
- **WHEN** é solicitado novamente o cancelamento de um extra já cancelado
- **THEN** o sistema não duplica o evento ou a alteração de cobertura e informa a situação atual

### Requirement: Respeitar o estado de publicação das escalas
O sistema MUST impedir alterações diretas que modifiquem silenciosamente o conteúdo de escalas validadas, publicadas ou finalizadas, mantendo a integridade da versão oficial.

#### Scenario: Editar extra de escala publicada
- **WHEN** a Coordenação tenta alterar ou cancelar um extra cuja efetivação alteraria uma escala publicada
- **THEN** o sistema impede a modificação direta e informa a necessidade de um fluxo autorizado de revisão ou versionamento

#### Scenario: Extra referente a escala em revisão
- **WHEN** a escala vinculada está em estado editável
- **THEN** a alteração do extra segue as validações aplicáveis e invalida resultados de validação da escala que se tornaram obsoletos

### Requirement: Cadastrar e selecionar profissionais RPA
O sistema SHALL permitir reutilizar o cadastro de profissionais para registrar pessoas com vínculo RPA e selecioná-las como substitutas, respeitando a identidade e as validações já exigidas para profissionais.

#### Scenario: Cadastrar profissional RPA válido
- **WHEN** a Coordenação fornece os dados obrigatórios de um profissional com vínculo RPA
- **THEN** o sistema registra o profissional e permite sua seleção para extras quando ele estiver ativo e elegível

#### Scenario: Rejeitar cadastro profissional duplicado
- **WHEN** a Coordenação tenta cadastrar um RPA que viola restrições de unicidade do cadastro profissional
- **THEN** o sistema informa a duplicidade e não cria novo registro

#### Scenario: Diferenciar profissionais homônimos
- **WHEN** existem profissionais com o mesmo nome
- **THEN** o sistema mantém a seleção pelo identificador individual e apresenta informação suficiente para diferenciá-los

### Requirement: Restringir gerenciamento de extras à Coordenação
O sistema MUST exigir autenticação e autorização de Coordenação para registrar, editar ou cancelar extras e cadastrar profissionais RPA.

#### Scenario: Operação sem autenticação
- **WHEN** uma operação protegida é solicitada sem credenciais válidas
- **THEN** o sistema nega a operação e não modifica os registros

#### Scenario: Perfil sem permissão
- **WHEN** um profissional sem perfil de Coordenação solicita uma operação de alteração
- **THEN** o sistema nega o acesso e preserva os dados existentes

### Requirement: Oferecer estados e feedback acessíveis na interface
O sistema SHALL apresentar listagem e formulários de extras com feedback claro de carregamento, validação, sucesso, erro e cancelamento, mantendo usabilidade em diferentes tamanhos de tela.

#### Scenario: Abrir formulário de extra
- **WHEN** a Coordenação solicita novo registro ou edição
- **THEN** o sistema apresenta os campos pertinentes ao fluxo e diferencia os dados obrigatórios dos opcionais

#### Scenario: Falha na gravação
- **WHEN** a operação retorna erro de validação, autorização, conflito ou indisponibilidade
- **THEN** o sistema apresenta a mensagem pertinente sem simular sucesso ou perder silenciosamente a edição em andamento

#### Scenario: Ação concluída
- **WHEN** a operação é confirmada pelo servidor
- **THEN** a listagem e os indicadores exibem os dados atualizados sem exigir que a Coordenação saia da página