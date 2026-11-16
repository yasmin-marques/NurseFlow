# Spec Delta

## MODIFIED Requirements

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

### Requirement: Montar escala manualmente

O sistema MUST permitir à Coordenação iniciar ou completar um rascunho por meio da inclusão manual de plantões e profissionais cadastrados, respeitando a disponibilidade por turno e a vigência das restrições do profissional.

#### Scenario: Adicionar alocação válida

- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho e passa a aparecer na revisão e no calendário

#### Scenario: Adicionar alocação válida por turno

- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho, passa a aparecer na revisão e no calendário e considera a disponibilidade do profissional naquele turno

#### Scenario: Rejeitar profissional não elegível

- **WHEN** o profissional está inativo, indisponível, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

#### Scenario: Rejeitar profissional não elegível por turno

- **WHEN** o profissional está inativo, indisponível naquele turno, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

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
