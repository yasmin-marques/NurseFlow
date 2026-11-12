# Spec Delta

## ADDED Requirements

### Requirement: Enfermeiro e Técnico usam navegação superior com as áreas de profissional

Para os perfis Enfermeiro e Técnico, a interface SHALL apresentar uma barra superior com a marca NurseFlow ("Gestão de escalas"), as abas "Início", "Meus plantões", "Escala geral" e "Trocas", o sino de notificações com indicador de não lidas e nome e perfil do usuário. A aba ativa MUST ser destacada. Itens de gestão exclusivos da Coordenação MUST NOT ser exibidos a esses perfis, e a API continua aplicando a autorização. A Coordenação MUST manter o layout e as telas atuais.

#### Scenario: Profissional entra no sistema
- **WHEN** um Enfermeiro ou Técnico autentica
- **THEN** vê a barra superior com as quatro abas e a identificação "nome / perfil", sem o menu lateral de gestão

#### Scenario: Navegar entre áreas
- **WHEN** o profissional seleciona "Meus plantões" ou "Escala geral"
- **THEN** a página correspondente é exibida, sem o placeholder "Esta área ainda está sendo preparada"

#### Scenario: Aba Trocas do profissional
- **WHEN** o profissional seleciona "Trocas"
- **THEN** o sistema não apresenta dados fictícios; enquanto o fluxo RF015/RF016 não existir, exibe estado informando que a área está em preparação, sem contador

#### Scenario: Coordenação
- **WHEN** a Coordenação autentica
- **THEN** o layout e as telas existentes permanecem inalterados
