# Spec Delta

## Purpose

Permitir que a Coordenação consulte por ano o histórico de solicitações de troca já decididas, com resultado, envolvidos e responsável.

## ADDED Requirements

### Requirement: Exibir somente decisões finalizadas

A consulta do Histórico de trocas MUST exigir autenticação de Coordenação e MUST exibir apenas solicitações com resultado final aprovado ou recusado. Solicitações pendentes ou aguardando aceite MUST NOT aparecer.

#### Scenario: Decisões no ano selecionado
- **WHEN** a Coordenação seleciona um ano com trocas decididas
- **THEN** o sistema lista as decisões do ano, das mais recentes para as mais antigas

#### Scenario: Solicitação ainda pendente
- **WHEN** uma solicitação não possui resultado final
- **THEN** ela não é incluída no Histórico de trocas

#### Scenario: Ano sem decisões
- **WHEN** o ano selecionado não possui solicitações finalizadas
- **THEN** a interface apresenta estado vazio textual, distinto de falha de carregamento

#### Scenario: Acesso sem permissão
- **WHEN** usuário não autenticado ou sem perfil de Coordenação consulta o histórico
- **THEN** o sistema responde 401 ou 403, respectivamente, sem revelar dados

### Requirement: Resumir cada decisão de troca

Cada item MUST apresentar a data da decisão final, os nomes do solicitante e do profissional solicitado, o resultado e o responsável real registrado para a decisão. Recusas do profissional e da Coordenação MUST ser apresentadas textualmente como recusadas, sem atribuir a decisão ao usuário atual.

#### Scenario: Troca aprovada
- **WHEN** uma solicitação foi aprovada
- **THEN** o histórico identifica os profissionais envolvidos, a data, o responsável e o resultado "Aprovada"

#### Scenario: Troca recusada
- **WHEN** uma solicitação foi recusada pelo profissional ou pela Coordenação
- **THEN** o histórico identifica os profissionais, data, responsável e resultado "Recusada"

#### Scenario: Dados mínimos
- **WHEN** o sistema retorna um item do histórico
- **THEN** a resposta contém somente os nomes e metadados necessários à linha, sem dados de contato ou dados pessoais não necessários

### Requirement: Navegar pelo histórico anual paginado

A interface MUST permitir selecionar o ano, MUST paginar listas longas, e MUST manter carregamento, vazio e erro como estados distintos. Abas, paginação e seletor de ano MUST ser utilizáveis por teclado e acessíveis.

#### Scenario: Paginar resultados
- **WHEN** há mais decisões que o limite de itens da página
- **THEN** a Coordenação pode acessar as páginas seguintes sem duplicar ou omitir itens

#### Scenario: Trocar o ano
- **WHEN** a Coordenação seleciona outro ano
- **THEN** a lista recarrega para aquele ano e a paginação volta ao início

#### Scenario: Falha ao consultar
- **WHEN** a consulta do histórico falha
- **THEN** a interface informa o erro e oferece nova tentativa
