# gestao-escalas Specification

## Purpose

Permite à Coordenação criar e manter escalas mensais de forma controlada, desde a geração ou montagem inicial até a revisão, validação e consulta em calendário, preservando as regras de disponibilidade e cobertura da equipe.

## Requirements

### Requirement: Criar escala mensal
O sistema MUST permitir à Coordenação criar uma escala para um mês e ano sem substituir silenciosamente uma escala existente no mesmo período. Com confirmação explícita, uma nova geração pode substituir o conteúdo de uma escala em rascunho, em revisão ou validada cuja versão atual ainda não foi publicada; escalas publicadas ou finalizadas são preservadas.

#### Scenario: Gerar uma nova escala automaticamente

- **WHEN** a Coordenação informa período, setores ativos e turnos a considerar e solicita a geração
- **THEN** o sistema usa as configurações, profissionais ativos, disponibilidades, restrições, cargas e quantitativos mínimos aplicáveis e salva o resultado como rascunho
- **AND** em cada plantão de 24 horas, marca um enfermeiro da equipe como enfermeiro-chefe; plantões de 12 horas não têm chefe

#### Scenario: Impedir duplicidade de período

- **WHEN** já existe uma escala não substituível para o período solicitado
- **THEN** o sistema informa o conflito e preserva a escala existente

#### Scenario: Regenerar escala durante a revisão

- **WHEN** a Coordenação confirma uma geração para um período cuja escala está em revisão
- **THEN** o sistema mantém a identidade da escala, substitui atomicamente os plantões e vínculos pelo novo resultado e retorna a escala ao estado de rascunho para nova revisão
- **AND** se a geração ou a gravação falhar, o conteúdo em revisão anterior permanece intacto

#### Scenario: Regenerar escala validada ainda não publicada
- **WHEN** a Coordenação confirma explicitamente a geração para um período cuja escala está validada, mas a versão atual ainda não foi publicada
- **THEN** o sistema mantém a identidade da escala, substitui atomicamente os plantões e vínculos, retorna a escala ao estado de rascunho e invalida a validação do conteúdo substituído
- **AND** preserva snapshots oficiais publicados anteriormente, se existirem
- **AND** se a geração ou a gravação falhar, o conteúdo e a validação anteriores permanecem intactos

#### Scenario: Preservar escala validada ou oficial

- **WHEN** já existe uma escala publicada ou finalizada no período solicitado
- **THEN** o sistema recusa a substituição e preserva a versão oficial existente

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

O sistema MUST aplicar disponibilidade por turno e recorrência semanal ao cálculo automático de escalas, usando campos estruturados para turno, dias, vigência e motivo em vez de interpretar observações textuais. A geração automática MUST observar as restrições obrigatórias de elegibilidade, intervalo entre plantões, carga e limite de extras. Quando não houver profissionais elegíveis suficientes, deve registrar vagas descobertas em vez de violar essas regras.

#### Scenario: Escalar profissional elegível

- **WHEN** o otimizador atribui um plantão
- **THEN** o profissional está ativo, possui formação compatível, está disponível na data e não tem outro plantão sobreposto

#### Scenario: Escalar profissional elegível por turno e disponibilidade

- **WHEN** o otimizador atribui um plantão para um profissional com disponibilidade por turno e recorrência semanal
- **THEN** o profissional está ativo, possui formação compatível, atende ao turno solicitado, está disponível na data e não tem outro plantão sobreposto

#### Scenario: Aplicar descanso obrigatório

- **WHEN** um profissional recebe plantões sucessivos
- **THEN** há no mínimo 72 horas de descanso após um plantão de 24 horas e 36 horas após um plantão de 12 horas
- **AND** a combinação de plantões diurno e noturno de 12 horas no mesmo dia é permitida
- **AND** o descanso pendente de plantão do mês anterior também é respeitado

#### Scenario: Aplicar descanso obrigatório mesmo com disponibilidade por turno

- **WHEN** um profissional recebe plantões sucessivos em turnos diurnos ou noturnos
- **THEN** há no mínimo 72 horas de descanso após um plantão de 24 horas e 36 horas após um plantão de 12 horas
- **AND** a combinação de plantões diurno e noturno de 12 horas no mesmo dia é permitida
- **AND** a disponibilidade por turno e as regras de recorrência são respeitadas ao calcular a elegibilidade e a carga

#### Scenario: Respeitar restrições e limites individuais

- **WHEN** uma data de início está bloqueada por indisponibilidade, férias, ausência, vínculo externo ou incompatibilidade com dias fixos de disponibilidade
- **THEN** o profissional não é alocado nessa data
- **AND** os limites de carga regular, extras e total de plantões por período são respeitados

#### Scenario: Respeitar restrições e limites individuais por turno

- **WHEN** uma data de início está bloqueada por indisponibilidade, férias, ausência, vínculo externo ou incompatibilidade com dias fixos de disponibilidade
- **THEN** o profissional não é alocado nessa data
- **AND** os limites de carga regular, extras e total de plantões por período são respeitados
- **AND** a decisão considera o turno exato solicitado ao invés de interpretar texto livre em `observacao`

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

O sistema MUST permitir à Coordenação iniciar ou completar um rascunho por meio da inclusão manual de plantões e profissionais cadastrados, respeitando a disponibilidade por turno e a vigência das restrições do profissional.

#### Scenario: Adicionar alocação válida

- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho e passa a aparecer na revisão e no calendário
- **AND** o sistema recalcula e apresenta as pendências de cobertura usando os quantitativos mínimos configurados para o setor, turno e função

#### Scenario: Adicionar alocação válida por turno

- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho, passa a aparecer na revisão e no calendário e considera a disponibilidade do profissional naquele turno

#### Scenario: Rejeitar profissional não elegível

- **WHEN** o profissional está inativo, indisponível, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

#### Scenario: Rejeitar profissional não elegível por turno

- **WHEN** o profissional está inativo, indisponível naquele turno, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

#### Scenario: Confirmar alocação com cobertura abaixo do mínimo
- **WHEN** uma alocação válida deixa uma função ou turno abaixo do quantitativo mínimo configurado
- **THEN** o sistema apresenta a quantidade necessária, alocada e faltante sem declarar a cobertura completa
- **AND** permite a confirmação explícita da Coordenação, sem tratar a pendência de quantitativo como conflito bloqueante
- **AND** registra a decisão no histórico da escala

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

O sistema MUST permitir à Coordenação alterar data, turno/duração, setor, enfermeiro-chefe (somente em plantão de 24 horas) e equipe de um plantão em escala não publicada.

#### Scenario: Aplicar alteração válida

- **WHEN** a Coordenação altera um plantão e todos os profissionais escolhidos atendem às regras de disponibilidade, descanso, função e cobertura
- **THEN** o sistema salva a alteração, atualiza os dados derivados da escala e registra quem e quando alterou
- **AND** recalcula as pendências de cobertura segundo os quantitativos mínimos configurados para os setores, turnos e funções afetados

#### Scenario: Rejeitar enfermeiro-chefe fora do plantão de 24 horas
- **WHEN** uma alteração indica liderança em plantão de 12 horas, ou mais de um chefe, ou um chefe que não seja enfermeiro da equipe
- **THEN** o sistema rejeita a alteração com mensagem clara e mantém os dados persistidos anteriores

#### Scenario: Validar apenas a equipe editada
- **WHEN** a Coordenação valida um lote de alterações
- **THEN** os erros de descanso, carga e disponibilidade são reportados somente para os profissionais da equipe editada
- **AND** os plantões dos demais profissionais continuam considerados na agenda para detectar sobreposição

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

#### Scenario: Confirmar edição com cobertura abaixo do mínimo
- **WHEN** uma edição válida deixa uma função ou turno abaixo do quantitativo mínimo configurado
- **THEN** o sistema atualiza a pendência e informa as quantidades necessária, alocada e faltante sem declarar a cobertura completa
- **AND** permite a confirmação explícita da Coordenação, sem tratar a pendência de quantitativo como conflito bloqueante
- **AND** registra a decisão no histórico sem persistir parcialmente o restante das alterações

### Requirement: Validar cobertura e conflitos

O sistema MUST validar as alocações de uma escala antes da publicação usando dados estruturados de disponibilidade por turno, recorrência semanal e compromissos externos, e apresentar resultados por plantão e profissional.

#### Scenario: Validar escala sem pendências

- **WHEN** todos os plantões respeitam as regras e os quantitativos mínimos
- **THEN** o sistema informa validação concluída e permite avançar para publicação

#### Scenario: Validar escala com restrições estruturadas

- **WHEN** todos os plantões respeitam as regras de disponibilidade, descanso, turno e quantitativos mínimos
- **THEN** o sistema informa validação concluída e permite avançar para publicação

#### Scenario: Encontrar cobertura insuficiente

- **WHEN** um turno/setor possui menos profissionais que o mínimo configurado
- **THEN** o sistema destaca a vaga, informa quantidade necessária, alocada e faltante e impede que a pendência seja apresentada como cobertura completa

#### Scenario: Encontrar conflito de profissional

- **WHEN** uma alocação viola disponibilidade, descanso, carga ou outro limite aplicável
- **THEN** o sistema identifica o profissional, plantão e regra violada e mantém a escala em revisão até correção ou decisão permitida

#### Scenario: Encontrar conflito de profissional por disponibilidade por turno

- **WHEN** uma alocação viola disponibilidade, descanso, carga ou outro limite aplicável em um turno específico
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

### Requirement: Disponibilidade por turno e recorrência semanal

O sistema MUST persistir disponibilidade por turno (diurno/noturno/flexível) e recorrência semanal em registros explícitos, sem empilhar a regra em observação textual.

#### Scenario: Registrar indisponibilidade por dia fixo

- **WHEN** a Coordenação envia `POST /profissionais/:profissionalId/restricoes` com `tipo = "indisponivel"`, `inicio`, `fim`, `diaSemana` e `motivo`
- **THEN** o sistema grava `profissionalId`, `tipo`, `inicio`, `fim`, `diaSemana`, `motivo`, `observacao` e, quando aplicável, `turno`, e responde `201` com os mesmos campos e `_id`

#### Scenario: Registrar disponibilidade por turno permitido

- **WHEN** a Coordenação envia `tipo = "disponivel"` com `turno = "diurno"` ou `"noturno"`
- **THEN** o sistema aceita somente os turnos válidos, valida a vigência e usa esse dado na geração automática de escalas, sem depender de texto livre em `observacao`

#### Scenario: Rejeitar recorrência parcial

- **WHEN** a criação de uma regra recorrente falha para qualquer dia do conjunto
- **THEN** o sistema não persiste nenhum registro daquele lote e retorna erro de validação ou conflito, preservando o estado anterior

### Requirement: Vinculo externo com horário e dias de compromisso

O sistema MUST separar vínculo externo de observação, armazenando instituição, tipo de vínculo, dias da semana, turno/horário e vigência como dados estruturados.

#### Scenario: Cadastrar vínculo externo com agenda semanal

- **WHEN** a Coordenação registra um compromisso externo com `tipo = "vinculo_externo"`, `instituicao`, `tipoVinculo`, `diasSemana`, `turno` e `vigencia`
- **THEN** o sistema salva esses campos explicitamente e, ao montar a escala, considera o compromisso no cálculo de indisponibilidade e conflitos

#### Scenario: Rejeitar horário não representável

- **WHEN** o payload informa turno/horário fora do conjunto suportado
- **THEN** o sistema rejeita a requisição com `400` e não cria um registro parcial

### Requirement: Motivo separado da observação

O sistema MUST distinguir `motivo` de `observacao` para férias, ausências e outros eventos, preservando observação apenas como texto complementar.

#### Scenario: Registrar ausência com motivo explícito

- **WHEN** a Coordenação envia `tipo = "ausencia"` ou `"ferias"` com `motivo = "licenca_medica" | "ferias" | "atestado" | "outro"`
- **THEN** o sistema persiste o motivo em campo próprio e mantém `observacao` opcional para contexto adicional, sem concatenar ambos em uma única string

#### Scenario: Exibir ausência sem confundir com folga comum

- **WHEN** o sistema lista registros de disponibilidade
- **THEN** as ausências e férias aparecem com motivo explícito e não como uma regra genérica de indisponibilidade

### Requirement: Edição real das restrições

O sistema MUST permitir atualização completa e segura de registros de restrições, em vez de aceitar somente criação e exclusão.

#### Scenario: Atualizar restrição existente

- **WHEN** a Coordenação envia `PATCH /profissionais/:profissionalId/restricoes/:restricaoId` com campos alterados
- **THEN** o sistema valida a nova vigência e o conjunto de dias/turno, persiste a alteração e retorna o documento atualizado

#### Scenario: Rejeitar atualização que gera conflito

- **WHEN** uma atualização produz sobreposição com outra regra do mesmo profissional
- **THEN** o sistema mantém o documento anterior e responde `409` ou `400` com explicação do conflito

### Requirement: Recorrências semanais sem persistência parcial

O sistema MUST criar ou atualizar todas as recorrências semanais em uma operação atômica, sem persistir apenas algumas repetições quando o lote falha.

#### Scenario: Persistir lote semanal inteiro

- **WHEN** a Coordenação salva uma recorrência semanal para um intervalo contendo múltiplos dias da semana
- **THEN** o sistema grava todas as ocorrências válidas ou a operação inteira falha, sem registros parciais em banco

#### Scenario: Consultar recorrências por profissional

- **WHEN** a Coordenação consulta a lista de restrições de um profissional
- **THEN** o retorno mostra apenas registros persistidos válidos, com `diaSemana` e `motivo` estruturados e sem duplicatas por concatenação textual

### Requirement: Compatibilidade com registros existentes

O sistema MUST aceitar registros legados sem quebrar leitura, listagem e conflito de escalas, migrando o contrato antigo para campos explícitos sem perda de histórico.

#### Scenario: Ler dados históricos sem `motivo`

- **WHEN** o banco contém registros antigos com `observacao` e sem `motivo`
- **THEN** a API continua lendo esses registros, retorna `motivo = null` ou um valor derivado para compatibilidade e mantém a operação de listagem funcional

#### Scenario: Reconciliar schema em banco existente

- **WHEN** a migração aplicada encontra documentos anteriores da coleção `restricoes`
- **THEN** o validador e os endpoints continuam aceitando os campos existentes e os campos novos, sem expulsar o histórico

### Requirement: Referência de profissionais por ID

O sistema MUST referenciar profissionais por `profissionalId` e não por nome em todas as regras de disponibilidade e ausência, preservando integridade entre front-end e back-end.

#### Scenario: Criar regra com profissional válido por ID

- **WHEN** a Coordenação seleciona um profissional na tela de disponibilidade
- **THEN** a API usa o `id` do profissional na requisição e não o nome, evitando ambiguidade e registros inconsistente ao reordenar nomes ou editar dados cadastrais

#### Scenario: Rejeitar profissional inexistente ou inválido

- **WHEN** o payload usa `.id` inexistente ou formato inválido
- **THEN** o sistema responde `404` ou `400` e não cria uma restrição associada a um registro inexistente

### Requirement: Contrato explícito da API de restrições

O sistema MUST publicar e obedecer a um contrato de entrada/saída para restrições, com campos obrigatórios e opcionais explícitos, como `tipo`, `inicio`, `fim`, `diaSemana`, `turno`, `motivo`, `observacao`, `profissionalId` e `_id`.

#### Scenario: Contrato de resposta

- **WHEN** a API retorna uma restrição
- **THEN** o payload inclui `tipo`, `inicio`, `fim`, `diaSemana`, `motivo`, `observacao`, `profissionalId`, `createdAt`, `updatedAt` e `_id`, sem campos concatenados em `observacao` para representar estrutura de negócio

#### Scenario: Contrato de validação

- **WHEN** o cliente envia dados fora do enum, datas inválidas, dia da semana fora de 0..6 ou texto excedendo 300 caracteres
- **THEN** o sistema responde `400` e não grava nada
