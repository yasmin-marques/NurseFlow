# Spec Delta

## Purpose

Permitir que a Coordenação consulte por ano as escalas oficiais publicadas e baixe o PDF referente a cada mês.

## ADDED Requirements

### Requirement: Consultar apenas escalas publicadas

A consulta do Histórico de escalas MUST exigir autenticação de Coordenação e MUST retornar somente meses com versão oficial publicada. Rascunhos, revisões e escalas nunca publicadas MUST NOT ser exibidos.

#### Scenario: Ano com meses publicados
- **WHEN** a Coordenação seleciona um ano que possui versões publicadas
- **THEN** o sistema apresenta um cartão por mês com a versão oficial mais recente daquele mês, ordenado cronologicamente

#### Scenario: Mês sem publicação
- **WHEN** um mês do ano selecionado não possui versão publicada
- **THEN** o mês não aparece como escala no histórico

#### Scenario: Ano sem publicação
- **WHEN** nenhum mês do ano selecionado possui versão publicada
- **THEN** a interface apresenta estado vazio textual, distinto de falha de carregamento

#### Scenario: Acesso sem permissão
- **WHEN** usuário não autenticado ou sem perfil de Coordenação consulta o histórico
- **THEN** o sistema responde 401 ou 403, respectivamente, sem revelar dados

### Requirement: Resumir cada escala publicada

Cada cartão MUST mostrar mês/ano, data de publicação, quantidade de plantões e percentual de cobertura/publicação somente quando calculável com dados oficiais existentes. O sistema MUST NOT inventar ou fixar esse percentual sem respaldo nos dados.

#### Scenario: Cartão mensal
- **WHEN** há uma versão oficial publicada no mês
- **THEN** o cartão apresenta os metadados correspondentes a essa versão

#### Scenario: Métrica indisponível
- **WHEN** os dados da versão não permitem calcular a métrica exibida no design
- **THEN** a interface omite ou indica indisponibilidade da métrica em vez de apresentar um valor incorreto

### Requirement: Baixar o PDF da versão representada

A ação de download MUST exportar a escala oficial correspondente ao cartão selecionado, sem incluir rascunhos ou uma versão divergente daquela usada nos metadados do cartão.

#### Scenario: Exportar escala publicada
- **WHEN** a Coordenação aciona o PDF de um cartão
- **THEN** o sistema baixa o documento da versão oficial mais recente daquele mês

#### Scenario: Falha no download
- **WHEN** a exportação do PDF falha
- **THEN** a interface informa a falha e permite tentar novamente, sem apresentar o download como concluído

### Requirement: Filtrar o histórico por ano

A interface MUST permitir selecionar o ano consultado e MUST atualizar os cartões sem misturar publicações de anos distintos. O carregamento, o estado vazio e a falha MUST ser distinguíveis e acessíveis.

#### Scenario: Trocar o ano
- **WHEN** a Coordenação escolhe outro ano
- **THEN** o sistema carrega somente escalas desse ano e ignora respostas obsoletas de consultas anteriores

#### Scenario: Falha ao consultar
- **WHEN** a consulta anual falha
- **THEN** a interface informa o erro e oferece nova tentativa
