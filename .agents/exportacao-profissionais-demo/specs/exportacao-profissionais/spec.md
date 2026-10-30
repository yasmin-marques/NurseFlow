# Spec Delta

## Purpose

Permite à Coordenação levar para uma planilha Excel o recorte da lista de profissionais que está na tela, sem expor dados de autenticação.

## ADDED Requirements

### Requirement: Exportar a lista visível de profissionais para Excel
A tela Profissionais SHALL oferecer a ação "Exportar Excel", ao lado de "Filtros", que baixa uma planilha `.xlsx` contendo exatamente os profissionais visíveis, respeitando busca, filtros e ordenação aplicados.

#### Scenario: Exportar sem filtros
- **WHEN** a Coordenação aciona "Exportar Excel" sem busca nem filtros
- **THEN** o navegador baixa um arquivo `nurseflow-profissionais-AAAA-MM-DD.xlsx` com a data local do dia
- **AND** a planilha contém todos os profissionais carregados, ordenados por nome (A—Z)

#### Scenario: Exportar recorte filtrado e ordenado
- **WHEN** a Coordenação aplica busca, filtros de formação, vínculo ou situação e/ou ordenação Z—A e aciona "Exportar Excel"
- **THEN** a planilha contém somente os profissionais exibidos, na mesma ordem da tela

#### Scenario: Botão indisponível sem dados
- **WHEN** a lista está carregando, há uma exportação em andamento ou nenhum profissional está visível
- **THEN** o botão "Exportar Excel" fica desabilitado
- **AND** durante a exportação o rótulo exibe "Exportando..."

#### Scenario: Falha na geração
- **WHEN** a geração da planilha falha
- **THEN** a tela exibe o alerta "Não foi possível gerar a planilha." e o botão volta a ficar disponível

### Requirement: Estrutura e formatação da planilha
A planilha SHALL ter uma aba "Profissionais" com cabeçalho na primeira linha e uma linha por profissional.

#### Scenario: Colunas
- **WHEN** a planilha é gerada
- **THEN** as colunas, em ordem, são "Nome completo", "CPF", "E-mail", "COREN", "Formação", "Tipo de vínculo", "Situação", "Data de cadastro" e "Última atualização"
- **AND** o cabeçalho é destacado (negrito, fundo verde), fica congelado e possui autofiltro
- **AND** a largura das colunas se ajusta ao conteúdo

#### Scenario: Valores traduzidos
- **WHEN** uma linha é escrita
- **THEN** a formação aparece como "Enfermeiro" ou "Técnico de enfermagem"
- **AND** o vínculo aparece como "CLT", "RPA" ou "Concursado"
- **AND** a situação aparece como "Ativo", "Desativado", "Afastado" ou "Férias"

#### Scenario: CPF e COREN preservados como texto
- **WHEN** o CPF ou o COREN começa com zeros ou contém pontuação
- **THEN** a célula é gravada como texto (formato `@`) sem perder zeros nem pontuação

#### Scenario: Datas em padrão brasileiro
- **WHEN** o profissional possui data de cadastro e de última atualização válidas
- **THEN** as células são datas reais, com formato `dd/mm/yyyy hh:mm`

#### Scenario: Datas ausentes ou inválidas
- **WHEN** a data de cadastro ou de atualização está ausente ou é inválida
- **THEN** a célula permanece em branco

#### Scenario: Sem resultados
- **WHEN** a exportação ocorre com lista vazia
- **THEN** a planilha contém somente o cabeçalho

### Requirement: Não exportar dados de autenticação
A planilha SHALL conter somente as nove colunas definidas e MUST NOT incluir senha, token ou identificadores internos.

#### Scenario: Campos extras no objeto de origem
- **WHEN** o objeto do profissional contém campos além dos exportáveis, como senha, token ou `usuarioId`
- **THEN** nenhum desses valores aparece na planilha e a planilha tem exatamente 9 colunas

### Requirement: Geração no navegador
A planilha SHALL ser gerada no navegador a partir dos dados já carregados pela listagem de profissionais, sem chamada de API específica de exportação. O acesso aos dados segue a restrição da API de profissionais à Coordenação.

#### Scenario: Exportar sem requisição adicional
- **WHEN** a Coordenação aciona "Exportar Excel"
- **THEN** o arquivo é montado a partir da lista em memória e baixado localmente

### Requirement: Filtro por quatro situações
O filtro de situação SHALL permitir "Todos", "Ativos", "Desativados", "Afastados" e "Férias", e a busca SHALL continuar encontrando por nome, COREN ou CPF (somente dígitos).

#### Scenario: Filtrar por cada situação
- **WHEN** a Coordenação seleciona uma das situações
- **THEN** a lista e a exportação contêm somente profissionais naquela situação

#### Scenario: Combinar filtros e busca
- **WHEN** a Coordenação combina formação, vínculo, situação e termo de busca
- **THEN** só permanecem os profissionais que atendem a todos os critérios

#### Scenario: Resumo do filtro
- **WHEN** a Coordenação seleciona uma situação no modal de filtros
- **THEN** o resumo do modal exibe o rótulo correspondente (Ativo, Desativado, Afastado ou Férias)

### Requirement: Expor datas de criação e atualização
O front-end SHALL mapear `createdAt` e `updatedAt` retornados pela API de profissionais para o modelo de profissional.

#### Scenario: Listar profissionais com datas
- **WHEN** a lista de profissionais é carregada da API
- **THEN** cada profissional carrega `createdAt` e `updatedAt` quando a API os informa
