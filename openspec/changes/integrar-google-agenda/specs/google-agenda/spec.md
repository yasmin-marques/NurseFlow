# Spec Delta

## Purpose

Permitir que Enfermeiros e Técnicos enviem seus plantões oficiais ao Google Agenda, de forma unidirecional, segura e sem acoplar a publicação de escalas ao serviço externo (RU015, RU022, RF013, US17, RNF008, DA27).

## ADDED Requirements

### Requirement: Restringir a integração ao próprio profissional

O sistema MUST permitir conectar, sincronizar e desativar a integração somente a Enfermeiro e Técnico autenticados, cada um apenas sobre a própria conexão e os próprios plantões, identificados exclusivamente pelo JWT. A Coordenação MUST publicar escalas sem conectar conta Google.

#### Scenario: Coordenação ou anônimo acessa a integração

- **WHEN** a Coordenação ou um usuário não autenticado chama uma rota da integração
- **THEN** o sistema responde 403/401 e não altera nada

#### Scenario: Profissional informa o id de outro

- **WHEN** um profissional envia o id de outro profissional em corpo ou query
- **THEN** o sistema ignora o valor e opera somente sobre o profissional autenticado

### Requirement: Conectar por OAuth 2.0 no backend

O sistema MUST usar consentimento explícito com acesso offline e escopo `calendar.events`, `state` de uso único, vinculado ao profissional e com expiração, e MUST armazenar o refresh token cifrado, sem expô-lo ao frontend, aos logs ou ao Git.

#### Scenario: Conexão concluída

- **WHEN** o Google redireciona com um `state` válido e as permissões exigidas
- **THEN** a integração fica `conectada`, `sincronizaAgenda` fica verdadeiro e uma sincronização inicial é enfileirada

#### Scenario: State inválido, reutilizado ou expirado, consentimento negado ou escopo insuficiente

- **WHEN** o callback chega nessas condições
- **THEN** nenhuma conexão é criada e o navegador volta ao frontend com o motivo

### Requirement: Sincronizar os plantões oficiais sem duplicatas

O sistema MUST criar ou atualizar um evento por plantão oficial do profissional usando identidade estável (profissional + plantão), com data, início/fim no fuso do sistema (inclusive plantões que terminam no dia seguinte), setor, subsetor (quando houver), tipo de plantão (quando disponível) e função, e MUST NOT enviar dados de pacientes, colegas ou observações internas. Repetições, reprocessamentos e execuções paralelas MUST NOT duplicar eventos, e uma tarefa antiga MUST NOT sobrescrever um estado oficial mais recente.

#### Scenario: Sincronização manual

- **WHEN** o profissional aciona *Sincronizar agora*
- **THEN** o sistema só informa sucesso quando o processamento termina sem falhas; falha parcial ou total é informada como tal

#### Scenario: Publicação, alteração oficial ou troca aprovada

- **WHEN** uma versão oficial é confirmada
- **THEN** os profissionais afetados com integração ativa têm uma tarefa criada na mesma transação, e rascunhos, revisões abertas e trocas pendentes nada enviam

#### Scenario: Plantão perdido

- **WHEN** o profissional deixa de ter um plantão na versão oficial
- **THEN** somente o evento criado pelo NurseFlow para esse plantão é removido e eventos pessoais permanecem

### Requirement: Isolar falhas do Google

O sistema MUST NOT depender de resposta do Google para publicar, alterar escalas ou aprovar trocas. Falhas temporárias MUST ser reprocessadas com tentativas limitadas, e autorização expirada ou revogada MUST colocar a integração em `reconexao_necessaria`. Um evento MUST NOT ser considerado sincronizado sem confirmação do Google.

#### Scenario: Google indisponível

- **WHEN** a publicação ocorre com o Google indisponível
- **THEN** a publicação conclui, a tarefa permanece na fila com espera crescente e vira `falha` após o limite de tentativas

### Requirement: Desativar preservando eventos

Ao desativar, o sistema MUST interromper novos envios, descartar o token e preservar os eventos já exportados.

#### Scenario: Desativação

- **WHEN** o profissional desativa a sincronização
- **THEN** nenhuma tarefa nova é criada para ele e os eventos existentes permanecem no Google Agenda
