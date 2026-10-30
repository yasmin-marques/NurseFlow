# scale-workflow-interface Specification

## Purpose

Define como a Coordenação acompanha e opera o ciclo de vida da escala pela interface, com informações mensais e semanais, validações explícitas e painéis consistentes com o design NurseFlow Web.

## Requirements

### Requirement: A interface de Escala apresenta a navegação e o contexto do usuário
A interface SHALL apresentar a estrutura de navegação e o contexto de Escala conforme a referência visual, usando a identidade do usuário autenticado.

#### Scenario: Coordenação abre a tela Escala
- **WHEN** a Coordenação abre a tela Escala
- **THEN** a navegação apresenta a marca NurseFlow com o subtítulo "Gestão de escalas", a seção "GESTÃO", os itens "Visão geral", "Escala", "Profissionais", "Disponibilidade", "Extras", "Trocas", "Setores" e "Histórico", além de "Configurações"
- **AND** "Escala" aparece ativo, "Trocas" apresenta o indicador ilustrado com "3", e o rodapé identifica o usuário e seu perfil, como "Paloma Ferreira" e "Coordenação" na referência
- **AND** a barra superior apresenta "Escala", busca, notificações com indicador de não lidas e o avatar do usuário
- **AND** o cabeçalho da página mostra "Escala", "Liderança, equipes e setores organizados por dia de plantão.", "Exportar PDF" e "Gerar Escala Automaticamente", sem ações adicionais
- **AND** "Exportar PDF" abre o painel de exportação e "Gerar Escala Automaticamente" abre o painel de configuração, sem iniciar ações diretamente

### Requirement: O fluxo da escala comunica etapa e estado atual
A interface SHALL manter o badge de estado, o stepper de quatro etapas e as ações disponíveis coerentes com a situação persistida da escala.

#### Scenario: Não existe escala para o período
- **WHEN** a Coordenação abre um período sem escala gerada
- **THEN** o fluxo mostra "AGUARDANDO GERAÇÃO" e as etapas "Gerar escala", "Revisar", "Validar conflitos" e "Publicar"
- **AND** o fluxo informa "Gere, revise e publique somente depois de validar os conflitos."
- **AND** o painel mostra "Crie uma escala usando os dados da equipe" e "O sistema considera status, restrições, ausências, descanso, cobertura mínima, extras, setores e turnos individuais."
- **AND** o painel oferece "Configurar geração"

#### Scenario: Escala está em revisão
- **WHEN** existe uma escala em revisão
- **THEN** o fluxo mostra "EM REVISÃO", destaca "Revisar" e oferece "Editar escala", "Gerar novamente", "Salvar alterações" e "Validar e publicar"

#### Scenario: Alterações foram salvas e aguardam validação
- **WHEN** alterações da escala são salvas com sucesso e ainda aguardam validação
- **THEN** o fluxo mostra "ALTERAÇÕES SALVAS", destaca "Validar conflitos" e mantém as ações de revisão correspondentes
- **AND** oferece "Editar escala", "Gerar novamente", "Salvar alterações" e "Validar e publicar"

#### Scenario: O lote de alterações falha ao salvar
- **WHEN** a validação do servidor, a revisão esperada ou a persistência do lote falha
- **THEN** nenhuma alteração do lote é persistida e a revisão da escala permanece inalterada
- **AND** a interface mantém as alterações staged, informa o erro e não avança o stepper para "ALTERAÇÕES SALVAS"

#### Scenario: Escala foi publicada
- **WHEN** a publicação da escala é concluída
- **THEN** o fluxo mostra "PUBLICADA", marca as quatro etapas como concluídas e oferece somente "Editar escala"

### Requirement: O calendário mensal resume cobertura por dia
A interface SHALL exibir um calendário mensal com navegação, legenda e resumo de liderança e quantitativos para cada dia com dados.

#### Scenario: Coordenação consulta o mês
- **WHEN** a Coordenação seleciona a visualização "Mês"
- **THEN** a tela mostra o mês e o ano, as setas de navegação e o alternador "Mês | Semana"
- **AND** a legenda identifica "Escala regular", "Cobertura por restrição" e "Conflito para revisar" por cores distintas
- **AND** a grade usa os dias "Dom", "Seg", "Ter", "Qua", "Qui", "Sex" e "Sáb"
- **AND** cada dia com dados apresenta o número, "CHEFE", o nome da liderança, a quantidade de enfermeiros e a quantidade de técnicos
- **AND** a navegação do mês fica em um cartão separado do calendário e não apresenta a ação "Hoje"
- **AND** após a grade, não há revisão por data/turno, painéis independentes de pendências/conflitos/alertas ou quadro de cargas; somente a faixa informativa de jornadas

#### Scenario: Dia exige atenção de cobertura
- **WHEN** um dia tem cobertura por restrição ou conflito identificado
- **THEN** o dia é destacado em laranja ou vermelho, respectivamente, e apresenta o alerta associado, como "1 setor abaixo do mínimo"

#### Scenario: Coordenação consulta a orientação de jornada
- **WHEN** o calendário mensal é exibido
- **THEN** a faixa informativa mostra "Jornadas de 12 horas são usadas somente quando há uma restrição específica, sempre com cobertura automática no turno complementar."

### Requirement: A visualização semanal detalha equipes e cobertura por dia
A interface SHALL permitir consultar e editar cada dia da semana, apresentando a composição da equipe e os turnos associados aos dados da escala em cartões com estados visuais distintos para dias regulares e dias com conflito.

#### Scenario: Coordenação navega entre semanas
- **WHEN** a Coordenação seleciona "Semana"
- **THEN** a tela oferece "‹ Semana anterior", o intervalo da semana, como "8–14 de junho", e "Próxima semana ›"
- **AND** apresenta um cartão por dia com data, dia da semana, "Cobertura diária" e "Editar"

#### Scenario: Dia semanal tem cobertura irregular
- **WHEN** um dia apresenta irregularidade ou conflito de cobertura
- **THEN** seu cartão destaca o dia e a cobertura em estado de revisão e mostra um aviso vermelho com o motivo, como setores abaixo do mínimo ou conflitos para revisar
- **AND** a área de liderança e a composição das equipes permanecem visíveis abaixo do aviso

#### Scenario: Dia semanal não tem conflito
- **WHEN** um dia apresenta cobertura sem irregularidades ou conflitos
- **THEN** seu cartão mostra a identificação do dia e a cobertura diária em estilo regular, sem faixa ou aviso de conflito
- **AND** apresenta a liderança em destaque verde suave e mantém a composição das equipes visível

#### Scenario: Coordenação consulta os profissionais de um dia
- **WHEN** a Coordenação expande ou consulta um cartão diário
- **THEN** as equipes são agrupadas como "ENFERMEIRO CHEFE · LIDERANÇA GERAL", "ENFERMEIROS · 2 EM CAMPO" e "TÉCNICOS · 3 POR SETOR EM CADA TURNO", com quantitativos atualizados pelos dados exibidos
- **AND** cada grupo mostra profissionais com avatar de iniciais, nome, função, setor e turno
- **AND** a liderança exibe "Plantão 24 horas · 07h—07h · Responsável pelos setores A, B e Emergência"
- **AND** os exemplos de turno incluem "Baixa · 07h—19h · restrição" e "Retorna · 19h—07h · cobertura"
- **AND** o cartão diário, a navegação e a ação "Editar" seguem a composição da captura "NurseFlow Web - Escala (Editar)"

### Requirement: A geração automática valida o escopo antes de criar a escala
A interface SHALL permitir configurar período, setores e turnos e informar os critérios usados na geração antes de criar uma escala como rascunho. Deve permitir substituir explicitamente escalas em rascunho ou revisão, preservando estados validados e oficiais.

#### Scenario: Coordenação configura uma geração
- **WHEN** a Coordenação seleciona "Configurar geração"
- **THEN** abre um painel lateral "Configurar geração automática" com o subtítulo "Defina o período e o escopo da nova escala."
- **AND** o aviso "Nova escala" informa "A escala será criada como rascunho e poderá ser revisada antes da publicação."
- **AND** o painel apresenta "Data inicial", "Data final", "Setores considerados" e "Turnos aplicáveis" como seleções
- **AND** os exemplos de setores são "Setor A", "Setor B" e "Emergência", e os turnos são "24 horas", "Diurno" e "Noturno"
- **AND** "O que será validado" lista "Profissionais ativos e disponíveis", "Férias, afastamentos e restrições", "Descanso dos técnicos e sobreposição", "Cobertura mínima por setor e turno" e "Enfermeiro chefe e responsabilidades"
- **AND** o intervalo inicial e final representa um mês completo, pois a API atual cria escalas mensais
- **AND** o rodapé oferece "Cancelar" e "Gerar Escala"

#### Scenario: Período ou escopo da geração é inválido
- **WHEN** a Coordenação tenta gerar com datas inválidas ou sem setor ou turno selecionado
- **THEN** a interface identifica o campo que precisa de correção, preserva as escolhas válidas e não inicia a geração

#### Scenario: Substituir escala em revisão
- **WHEN** o período selecionado possui uma escala em revisão
- **THEN** a interface permite confirmar explicitamente a substituição
- **AND** informa que o conteúdo atual só será substituído após uma geração concluída
- **AND** não permite substituir escalas validadas, publicadas ou finalizadas

#### Scenario: Geração é solicitada
- **WHEN** a Coordenação solicita a geração com período e escopo válidos
- **THEN** o fluxo permanece visível e a área do calendário é substituída pela superfície branca de carregamento com spinner e "Gerando a escala..."
- **AND** informa "Verificando profissionais disponíveis, restrições, descansos, setores, lideranças, extras e cobertura mínima."
- **AND** apresenta os indicadores "Disponibilidade", "Restrições" e "Cobertura por setor"
- **AND** ao concluir com sucesso, apresenta a escala para revisão sem publicá-la automaticamente
- **AND** se a geração falhar, reabre o painel com as seleções preservadas e informa o erro sem apresentar sucesso

### Requirement: Selecionar o período das configurações mensais
A interface SHALL permitir consultar e alterar as configurações mensais para qualquer ano civil de quatro dígitos (0001–9999) e qualquer um dos 12 meses, mantendo cada período isolado.

#### Scenario: Consultar configurações de outro período
- **WHEN** a Coordenação seleciona um mês diferente na tela de configurações
- **THEN** a interface carrega os limites correspondentes ao ano e mês selecionados
- **AND** não permite trocar de período enquanto há alterações não salvas

### Requirement: O cabeçalho encaminha para os painéis de ação ilustrados
A interface SHALL abrir os painéis de exportação e geração a partir das duas ações do cabeçalho, sem downloads ou alterações diretas.

#### Scenario: Coordenação prepara exportação
- **WHEN** a Coordenação seleciona "Exportar PDF"
- **THEN** abre o drawer de exportação com opções de escala geral e por setor, aviso de assinatura e ações "Cancelar" e "Gerar PDF"

#### Scenario: Coordenação configura geração
- **WHEN** a Coordenação seleciona "Gerar Escala Automaticamente"
- **THEN** abre o drawer de configuração sem iniciar a geração até a confirmação em "Gerar Escala"

### Requirement: A edição de plantão valida a equipe antes de aplicar alterações
A interface SHALL permitir alterar liderança, setor e equipe de um plantão, incluindo técnicos e enfermeiros, e somente confirmar a alteração após as validações correspondentes.

#### Scenario: Coordenação edita um plantão
- **WHEN** a Coordenação seleciona "Editar" para um dia
- **THEN** abre o painel "Editar plantão · 8 de junho" com o subtítulo "Ajuste profissionais, setor, turno e responsabilidade." e os campos "Enfermeiro chefe" e "Setor"
- **AND** exibe "Equipe do plantão", o contador de profissionais, cartões removíveis e "Adicionar profissional ao plantão"
- **AND** apresenta as validações "Status e disponibilidade", "Férias, afastamentos e restrições", "Conflito de horário", "Descanso obrigatório" e "Sobreposição de plantões"
- **AND** mostra "Alteração válida" apenas quando todas as validações forem aprovadas
- **AND** oferece "Cancelar", "Validar conflitos" e "Aplicar alteração"

#### Scenario: Coordenação valida e aplica uma alteração staged
- **WHEN** a Coordenação seleciona "Validar conflitos" em um formulário de plantão
- **THEN** o sistema valida o conjunto staged contra a revisão atual sem persistir alterações
- **AND** "Aplicar alteração" acrescenta ao conjunto staged somente um formulário válido
- **AND** cancelar o formulário descarta apenas as mudanças ainda não aplicadas, sem remover outras alterações staged

#### Scenario: Coordenação salva alterações staged
- **WHEN** a Coordenação seleciona "Salvar alterações" com um ou mais plantões staged
- **THEN** o sistema revalida e persiste todo o lote em uma única transação e incrementa a revisão da escala uma vez
- **AND** após sucesso, a interface limpa o conjunto staged e mostra "ALTERAÇÕES SALVAS" com a etapa "Validar conflitos" ativa
- **AND** se a gravação falhar, nenhuma alteração é persistida e o conjunto staged é preservado para correção ou nova tentativa

#### Scenario: Coordenação adiciona um profissional ao plantão
- **WHEN** a Coordenação seleciona "Adicionar profissional ao plantão"
- **THEN** o painel permite selecionar um técnico ou enfermeiro ativo ainda não escalado no plantão
- **AND** adicionar o profissional mantém o turno do plantão e não solicita nome ou turno adicionalmente
- **AND** o formulário oferece "Cancelar" e "Adicionar ao plantão"

#### Scenario: Não há profissionais disponíveis para adicionar
- **WHEN** todos os técnicos e enfermeiros ativos já estão escalados no plantão
- **THEN** a interface informa que todos já estão no plantão e impede nova inclusão

### Requirement: Notificações distinguem itens lidos e não lidos
A interface SHALL apresentar as notificações em painel lateral, indicar o estado de leitura e permitir marcar itens como lidos.

#### Scenario: Coordenação abre as notificações
- **WHEN** a Coordenação seleciona o botão de notificações
- **THEN** abre o painel "Notificações" com a orientação "Veja as informações e escolha o próximo passo"
- **AND** cada item apresenta seu conteúdo e indicador de lido ou não lido
- **AND** o rodapé oferece "Cancelar" e "Marcar como lidas"

#### Scenario: Coordenação marca notificações como lidas
- **WHEN** a Coordenação seleciona "Marcar como lidas"
- **THEN** os itens não lidos são atualizados visualmente como lidos e o indicador de não lidas é atualizado

### Requirement: A exportação prepara PDF geral ou por setor
A interface SHALL permitir escolher o escopo do PDF e informar os campos de assinatura incluídos antes de iniciar a exportação.

#### Scenario: Coordenação configura a exportação
- **WHEN** a Coordenação seleciona "Exportar PDF"
- **THEN** abre o painel "Exportar PDF" com o subtítulo "Prepare o documento para assinatura" e as opções "Escala geral de junho" e "Por setor"
- **AND** informa "Inclui campos para assinatura da Coordenação e Diretoria"
- **AND** oferece "Cancelar" e "Gerar PDF"

#### Scenario: Coordenação gera um PDF
- **WHEN** a Coordenação seleciona um escopo válido e solicita "Gerar PDF"
- **THEN** a exportação usa o escopo selecionado e disponibiliza o documento gerado
- **AND** uma falha informa que a exportação não foi concluída e permite tentar novamente sem perder a seleção

### Requirement: A publicação informa cobertura e exige confirmação adequada ao resultado
A interface SHALL validar novamente a escala, apresentar os indicadores de cobertura e disponibilidade e só exibir publicação concluída após confirmação bem-sucedida.

#### Scenario: Escala tem coberturas abaixo do mínimo
- **WHEN** a validação identifica coberturas abaixo do mínimo sem outros conflitos de disponibilidade
- **THEN** o painel mostra "Escala com pontos para revisar", "2 coberturas abaixo do mínimo" e "Revise os setores e turnos indicados no calendário"
- **AND** mostra "Todos os plantões estão cobertos", "Dois enfermeiros estão garantidos durante as 24 horas", "Sem conflitos de disponibilidade" e "Status, férias, afastamentos, restrições e descansos validados."
- **AND** informa "Todos os enfermeiros serão notificados após a publicação."
- **AND** oferece "Publicar com pendências" em vez de "Confirmar publicação"

#### Scenario: Escala apresenta outro conflito impeditivo
- **WHEN** a validação identifica conflito de disponibilidade, descanso ou outro erro além de cobertura abaixo do mínimo
- **THEN** a interface informa o conflito e não oferece a ação "Publicar com pendências"
- **AND** a escala permanece sem publicação até que o conflito seja corrigido e validado novamente

#### Scenario: Escala está pronta para publicação
- **WHEN** cobertura, quantitativo mínimo e restrições são validados sem pendências
- **THEN** o painel mostra "Escala pronta para publicação" e "Cobertura, quantitativo e restrições foram validados novamente."
- **AND** confirma "Todos os plantões estão cobertos", "Quantitativo mínimo atendido", "Todos os setores mantêm três técnicos por turno.", "Sem conflitos de disponibilidade" e "Status, férias, afastamentos, restrições e descansos validados."
- **AND** informa "Todos os enfermeiros serão notificados após a publicação." e oferece "Confirmar publicação"

#### Scenario: Publicação falha ou a escala ainda não foi validada
- **WHEN** a validação ou a confirmação de publicação falha
- **THEN** a interface não mostra o estado "PUBLICADA", informa a falha e mantém a Coordenação no estado que permite revisar e tentar novamente

### Requirement: A interface comunica carregamento, erro e ausência de dados
A interface SHALL fornecer feedback visível para operações assíncronas e estados sem dados, sem substituir falhas por sucesso nem apresentar conteúdo inventado.

#### Scenario: Uma operação está em andamento
- **WHEN** geração, validação, publicação ou exportação está em andamento
- **THEN** a interface indica carregamento, impede submissões duplicadas e mantém visível o contexto da operação

#### Scenario: Uma operação falha
- **WHEN** uma operação retorna erro
- **THEN** a interface informa que a operação falhou, preserva os dados preenchidos quando possível e oferece uma ação de recuperação apropriada

#### Scenario: Um período ou lista não tem dados
- **WHEN** não há escala, equipe ou notificações para exibir
- **THEN** a interface apresenta um estado vazio contextualizado e uma ação aplicável, sem mostrar nomes ou quantitativos de exemplo como se fossem dados reais
