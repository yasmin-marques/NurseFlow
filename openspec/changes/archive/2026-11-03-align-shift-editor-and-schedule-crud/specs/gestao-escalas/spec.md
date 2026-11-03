# Spec Delta

## MODIFIED Requirements

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

### Requirement: Montar escala manualmente
O sistema MUST permitir à Coordenação iniciar ou completar um rascunho por meio da inclusão manual de plantões e profissionais cadastrados.

#### Scenario: Adicionar alocação válida
- **WHEN** a Coordenação seleciona um setor, data, turno e profissional compatível e confirma a inclusão
- **THEN** o plantão é persistido no rascunho e passa a aparecer na revisão e no calendário
- **AND** o sistema recalcula e apresenta as pendências de cobertura usando os quantitativos mínimos configurados para o setor, turno e função

#### Scenario: Rejeitar profissional não elegível
- **WHEN** o profissional está inativo, indisponível, em ausência ou não corresponde à função exigida
- **THEN** o sistema recusa a alocação e informa o motivo sem alterar o rascunho

#### Scenario: Confirmar alocação com cobertura abaixo do mínimo
- **WHEN** uma alocação válida deixa uma função ou turno abaixo do quantitativo mínimo configurado
- **THEN** o sistema apresenta a quantidade necessária, alocada e faltante sem declarar a cobertura completa
- **AND** permite a confirmação explícita da Coordenação, sem tratar a pendência de quantitativo como conflito bloqueante
- **AND** registra a decisão no histórico da escala

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
