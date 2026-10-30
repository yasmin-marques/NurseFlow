# gestao-escalas Specification

## Purpose

Permite à Coordenação criar e manter escalas mensais de forma controlada, desde a geração ou montagem inicial até a revisão, validação e consulta em calendário, preservando as regras de disponibilidade e cobertura da equipe.

## Requirements

### Requirement: Criar escala mensal
O sistema MUST permitir à Coordenação criar uma escala para um mês e ano sem substituir silenciosamente uma escala existente no mesmo período. Com confirmação explícita, uma nova geração pode substituir o conteúdo de uma escala em rascunho ou em revisão; escalas validadas, publicadas ou finalizadas são preservadas.

#### Scenario: Gerar uma nova escala automaticamente
- **WHEN** a Coordenação informa período, setores ativos e turnos a considerar e solicita a geração
- **THEN** o sistema usa as configurações, profissionais ativos, disponibilidades, restrições, cargas e quantitativos mínimos aplicáveis e salva o resultado como rascunho

#### Scenario: Impedir duplicidade de período
- **WHEN** já existe uma escala não removível para o período solicitado
- **THEN** o sistema informa o conflito e preserva a escala existente

#### Scenario: Regenerar escala durante a revisão
- **WHEN** a Coordenação confirma uma geração para um período cuja escala está em revisão
- **THEN** o sistema mantém a identidade da escala, substitui atomicamente os plantões e vínculos pelo novo resultado e retorna a escala ao estado de rascunho para nova revisão
- **AND** se a geração ou a gravação falhar, o conteúdo em revisão anterior permanece intacto

#### Scenario: Preservar escala validada ou oficial
- **WHEN** já existe uma escala validada, publicada ou finalizada no período solicitado
- **THEN** o sistema recusa a substituição e preserva a versão existente

#### Scenario: Dados insuficientes para gerar
- **WHEN** faltam setores, profissionais ou parâmetros necessários para a geração
- **THEN** o sistema informa quais dados precisam ser corrigidos e não cria uma escala parcial

### Requirement: Consultar configuração mensal por ano e mês
O sistema MUST consultar e atualizar cada configuração pelo par ano/mês, aceitando qualquer ano civil de quatro dígitos (0001–9999), sem depender do ano atual nem reutilizar configuração de outro período.

#### Scenario: Consultar qualquer período permitido
- **WHEN** a Coordenação seleciona um mês e ano permitidos pela API de configurações
- **THEN** o sistema carrega os limites daquele período, usando os valores padrão quando ainda não há configuração salva

#### Scenario: Salvar limites de um período
- **WHEN** a Coordenação salva limites para um período selecionado
- **THEN** somente a configuração daquele ano e mês é criada ou atualizada e os demais períodos permanecem inalterados

#### Scenario: Provisionar configurações mensais automaticamente
- **WHEN** a Coordenação consulta um período sem configuração existente
- **THEN** o sistema cria a configuração daquele período com limites e cargas padrão de concursado (6 plantões de 24h e 1 de 12h) e CLT (5 de 24h e 2 de 12h) para meses de 28, 29, 30 e 31 dias
- **AND** configurações antigas sem algum desses campos recebem apenas os padrões ausentes, preservando valores já editados
- **AND** a criação sob demanda evita exigir a pré-geração manual de configurações para anos futuros

#### Scenario: Editar carga regular por período
- **WHEN** a Coordenação altera os plantões regulares de 24h ou 12h para concursado ou CLT
- **THEN** o sistema salva os valores na configuração do período selecionado, usando a quantidade de dias daquele mês
- **AND** as demais durações de mês e períodos permanecem inalteradas
- **AND** a geração automática aplica as cargas atualizadas e continua respeitando as regras obrigatórias de elegibilidade, plantão e descanso

### Requirement: Gerar plantões respeitando regras de disponibilidade e descanso
A geração automática MUST observar as restrições obrigatórias de elegibilidade, intervalo entre plantões, carga e limite de extras. Quando não houver profissionais elegíveis suficientes, deve registrar vagas descobertas em vez de violar essas regras.

#### Scenario: Escalar profissional elegível
- **WHEN** o otimizador atribui um plantão
- **THEN** o profissional está ativo, possui formação compatível, está disponível na data e não tem outro plantão sobreposto

#### Scenario: Aplicar descanso obrigatório
- **WHEN** um profissional recebe plantões sucessivos
- **THEN** há no mínimo 72 horas de descanso após um plantão de 24 horas e 36 horas após um plantão de 12 horas
- **AND** a combinação de plantões diurno e noturno de 12 horas no mesmo dia é permitida
- **AND** o descanso pendente de plantão do mês anterior também é respeitado

#### Scenario: Respeitar restrições e limites individuais
- **WHEN** uma data de início está bloqueada por indisponibilidade, férias, ausência, vínculo externo ou incompatibilidade com dias fixos de disponibilidade
- **THEN** o profissional não é alocado nessa data
- **AND** os limites de carga regular, extras e total de plantões por período são respeitados

#### Scenario: Cobertura insuficiente sem violar regras obrigatórias
- **WHEN** não há profissionais elegíveis suficientes para preencher o quantitativo mínimo de setor, turno e função
- **THEN** a geração registra a vaga como descoberta e informa o quantitativo faltante, sem relaxar as regras obrigatórias

### Requirement: Cancelar geração em andamento
O sistema MUST permitir à Coordenação interromper uma geração ativa no servidor e garantir que uma operação cancelada não salve uma escala parcial.

#### Scenario: Interromper otimização ativa
- **WHEN** a Coordenação cancela uma geração enquanto o otimizador está processando a escala
- **THEN** a API encaminha o cancelamento ao solver, interrompe a operação e confirma que nenhum rascunho foi salvo

#### Scenario: Cancelar antes de iniciar o solver
- **WHEN** o cancelamento chega antes de o solver registrar a operação
- **THEN** a API impede que a otimização comece e não salva a escala

#### Scenario: Solicitar cancelamento durante a gravação
- **WHEN** a operação já entrou na etapa de persistência atômica
- **THEN** a API recusa o cancelamento e não informa falsamente que a escala foi cancelada

### Requirement: Montar escala manualmente
O sistema MUST permitir à Coordenação iniciar ou completar um rascunho por meio da inclusão manual de plantões e profissionais cadastrados.

#### Scenario: Adicionar alocação válida
- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho e passa a aparecer na revisão e no calendário

#### Scenario: Rejeitar profissional não elegível
- **WHEN** o profissional está inativo, indisponível, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

### Requirement: Consultar escalas e seus detalhes
O sistema MUST permitir à Coordenação localizar escalas por período e consultar seus metadados, alocações, pendências, conflitos, avisos e cargas profissionais.

#### Scenario: Consultar escala do período
- **WHEN** a Coordenação abre um período com escala existente
- **THEN** o sistema apresenta a escala e seu estado atual, distinguindo plantões regulares, extras, vagas descobertas e conflitos

#### Scenario: Consultar período sem escala
- **WHEN** não há escala para o período selecionado
- **THEN** o sistema informa que nenhuma escala foi encontrada e oferece iniciar a criação

### Requirement: Exibir calendário mensal e semanal
O sistema MUST apresentar os plantões em visualização mensal e semanal, com navegação entre períodos e informação suficiente para identificar cobertura e responsáveis.

#### Scenario: Alternar visualização do calendário
- **WHEN** a Coordenação seleciona a visualização mensal ou semanal
- **THEN** o sistema mostra os plantões do mesmo período na granularidade selecionada sem perder as alocações

#### Scenario: Identificar condição do plantão
- **WHEN** o calendário contém cobertura regular, extra, insuficiente ou conflito
- **THEN** cada condição é distinguível visualmente e possui uma legenda ou indicação textual acessível

### Requirement: Revisar escala gerada
O sistema MUST apresentar a escala em rascunho para revisão antes da publicação, agrupando plantões por dia e exibindo setor, turno, equipe e cobertura.

#### Scenario: Revisar composição diária
- **WHEN** a Coordenação abre a revisão de um rascunho
- **THEN** o sistema apresenta por data os responsáveis, profissionais por setor e turno, quantitativo exigido e alocado, cargas esperadas e atribuídas e pendências

#### Scenario: Exibir cargas e extras
- **WHEN** há profissionais com plantões regulares ou extras
- **THEN** o sistema apresenta suas cargas separadamente e sinaliza cargas abaixo/acima das regras configuradas

### Requirement: Editar plantão de rascunho
O sistema MUST permitir à Coordenação alterar data, turno/duração, setor, enfermeiro responsável e equipe técnica de um plantão em escala não publicada.

#### Scenario: Aplicar alteração válida
- **WHEN** a Coordenação altera um plantão e todos os profissionais escolhidos atendem às regras de disponibilidade, descanso, função e cobertura
- **THEN** o sistema salva a alteração, atualiza os dados derivados da escala e registra quem e quando alterou

#### Scenario: Rejeitar alteração conflitante
- **WHEN** uma alteração cria sobreposição, quebra descanso obrigatório, viola indisponibilidade ou excede um limite configurado
- **THEN** o sistema apresenta o conflito e mantém os dados persistidos anteriores

#### Scenario: Selecionar técnico durante a edição
- **WHEN** a Coordenação pesquisa um técnico para adicionar à equipe do setor
- **THEN** o sistema permite selecionar somente profissional técnico cadastrado e elegível e mostra o turno escolhido antes de confirmar

#### Scenario: Usar plantões de 12 horas no mesmo dia
- **WHEN** um profissional recebe plantão diurno e noturno de 12 horas no mesmo dia e essa combinação é permitida pelas regras vigentes
- **THEN** o sistema não acusa sobreposição indevida e ainda valida descanso e demais restrições aplicáveis

#### Scenario: Editar escala publicada
- **WHEN** a Coordenação tenta alterar diretamente uma escala publicada
- **THEN** o sistema impede a alteração do conteúdo publicado e exige um fluxo controlado de revisão ou nova versão, preservando a versão oficial

### Requirement: Validar cobertura e conflitos
O sistema MUST validar as alocações de uma escala antes da publicação e apresentar resultados por plantão e profissional.

#### Scenario: Validar escala sem pendências
- **WHEN** todos os plantões respeitam as regras e os quantitativos mínimos
- **THEN** o sistema informa validação concluída e permite avançar para publicação

#### Scenario: Encontrar cobertura insuficiente
- **WHEN** um turno/setor possui menos profissionais que o mínimo configurado
- **THEN** o sistema destaca a vaga, informa quantidade necessária, alocada e faltante e impede que a pendência seja apresentada como cobertura completa

#### Scenario: Encontrar conflito de profissional
- **WHEN** uma alocação viola disponibilidade, descanso, carga ou outro limite aplicável
- **THEN** o sistema identifica o profissional, plantão e regra violada e mantém a escala em revisão até correção ou decisão permitida

#### Scenario: Revalidar após alteração
- **WHEN** a Coordenação altera um plantão depois de uma validação
- **THEN** o resultado de validação anterior é invalidado e a escala precisa ser validada novamente

### Requirement: Exibir percentual de cobertura
O sistema MUST apresentar um indicador percentual que represente quantas posições profissionais exigidas pelos setores e turnos estão preenchidas.

#### Scenario: Calcular cobertura parcial
- **WHEN** há posições exigidas e algumas permanecem descobertas
- **THEN** o percentual corresponde às posições preenchidas sobre o total exigido, arredondado para baixo, e as vagas descobertas continuam identificadas

#### Scenario: Calcular cobertura completa
- **WHEN** todas as posições profissionais exigidas estão preenchidas
- **THEN** o sistema apresenta 100% de cobertura

#### Scenario: Não há quantitativos exigidos
- **WHEN** não há posições exigidas configuradas
- **THEN** o sistema apresenta o indicador como indisponível e não como 100%

### Requirement: Controlar estados e remoção de escalas
O sistema MUST controlar a transição da escala entre rascunho, revisão, validação, publicação e finalização e permitir remover somente rascunhos mediante confirmação.

#### Scenario: Avançar no fluxo de revisão
- **WHEN** a Coordenação conclui geração, revisão e validação
- **THEN** a interface indica cada etapa e o estado persistido da escala, sem permitir pular validações obrigatórias

#### Scenario: Remover rascunho confirmado
- **WHEN** a Coordenação confirma a remoção de uma escala em rascunho
- **THEN** o sistema remove a escala e seus plantões relacionados de forma consistente

#### Scenario: Preservar escala publicada
- **WHEN** a Coordenação solicita remover ou substituir uma escala publicada ou finalizada
- **THEN** o sistema recusa a operação e preserva o conteúdo oficial e seu histórico

### Requirement: Restringir operações da escala à Coordenação
O sistema MUST exigir autenticação e autorização de Coordenação para criar, editar, validar, publicar ou remover escalas.

#### Scenario: Operação sem autenticação
- **WHEN** uma requisição de alteração de escala não contém credencial válida
- **THEN** o sistema nega o acesso sem modificar dados

#### Scenario: Operação por perfil não autorizado
- **WHEN** um profissional tenta executar uma operação exclusiva da Coordenação
- **THEN** o sistema responde com acesso negado e mantém os dados inalterados
