# Spec Delta

## Purpose

Permite transformar uma escala revisada em referência oficial da equipe e entregar uma cópia legível para consulta e impressão, com comunicação explícita das publicações e alterações relevantes.

## ADDED Requirements

### Requirement: Publicar escala validada
O sistema MUST permitir à Coordenação publicar uma escala validada e preservar o conteúdo e o estado oficiais resultantes da publicação.

#### Scenario: Publicar escala sem pendências
- **WHEN** a Coordenação confirma a publicação de uma escala validada sem conflitos ou vagas descobertas
- **THEN** o sistema altera o estado para publicada, registra responsável e instante da publicação e disponibiliza a escala para consulta

#### Scenario: Confirmar publicação com pendências
- **WHEN** há vagas descobertas ou alertas que podem ser aceitos e a Coordenação escolhe publicar mesmo assim
- **THEN** o sistema apresenta as pendências com setor, turno e quantitativos e só publica após confirmação explícita, mantendo essas pendências visíveis na escala

#### Scenario: Recusar confirmação com conflito bloqueante
- **WHEN** a escala contém conflito que viola regra obrigatória ou não pode ser aceito como pendência
- **THEN** o sistema impede a publicação e informa o que deve ser corrigido

#### Scenario: Repetir publicação
- **WHEN** a Coordenação envia novamente uma publicação já concluída
- **THEN** o sistema não cria publicação duplicada nem duplica as notificações

### Requirement: Preservar versão publicada
O sistema MUST preservar a versão oficial publicada e registrar alterações posteriores sem sobrescrever o conteúdo que os usuários já consultaram.

#### Scenario: Tentar alterar versão oficial
- **WHEN** a Coordenação solicita alteração direta de plantão publicado
- **THEN** o sistema não substitui silenciosamente a versão oficial e solicita iniciar uma revisão ou nova versão controlada

#### Scenario: Registrar publicação e alteração
- **WHEN** uma escala é publicada ou uma versão posterior é publicada
- **THEN** o sistema registra autor, data/hora e versão correspondente para consulta e rastreabilidade

### Requirement: Notificar eventos da escala
O sistema MUST apresentar notificações aos profissionais afetados quando uma escala for publicada ou quando uma alteração publicada afetar seus plantões.

#### Scenario: Notificar publicação
- **WHEN** a Coordenação publica uma escala
- **THEN** os profissionais abrangidos recebem uma notificação que identifica o período e permite acessar a escala publicada

#### Scenario: Notificar alteração publicada
- **WHEN** uma nova versão publicada altera os plantões de um profissional
- **THEN** o profissional afetado recebe uma notificação que identifica o período e a atualização

#### Scenario: Consultar e marcar notificações lidas
- **WHEN** o usuário abre o painel de notificações e marca as notificações como lidas
- **THEN** o sistema exibe os eventos de escala disponíveis e persiste o estado de leitura

### Requirement: Exportar escala para PDF
O sistema MUST permitir à Coordenação exportar a escala publicada em PDF completo ou separada por setor.

#### Scenario: Exportar escala geral
- **WHEN** a Coordenação escolhe exportação geral para uma escala publicada
- **THEN** o sistema gera um PDF com todos os setores, datas, turnos, profissionais, estado da cobertura e campos de assinatura da Coordenação e Diretoria

#### Scenario: Exportar por setor
- **WHEN** a Coordenação escolhe exportação por setor
- **THEN** o sistema gera um arquivo identificável para cada setor incluído, contendo somente os respectivos plantões

#### Scenario: Manter legibilidade de impressão
- **WHEN** o PDF é impresso em preto e branco ou em cópia reprográfica
- **THEN** textos, datas, turnos, distinção de extras e pendências permanecem legíveis sem depender exclusivamente de cores

#### Scenario: Exportar escala com pendências
- **WHEN** a Coordenação exporta uma escala publicada com pendências aceitas
- **THEN** o PDF identifica as vagas descobertas e os quantitativos faltantes sem representar cobertura incompleta como completa

#### Scenario: Exportar escala inexistente ou não publicada
- **WHEN** a Coordenação solicita exportação para um período sem escala publicada
- **THEN** o sistema informa que não há documento oficial disponível e não gera um PDF apresentado como publicado
