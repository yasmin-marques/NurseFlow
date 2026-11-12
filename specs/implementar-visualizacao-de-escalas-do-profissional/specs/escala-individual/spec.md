# Spec Delta

## Purpose

Permitir que Enfermeiros e Técnicos consultem, em modo somente leitura, os próprios plantões da escala oficial publicada, em "Meus plantões", separados em próximos e anteriores.

## ADDED Requirements

### Requirement: Restringir a consulta ao próprio profissional autenticado

O sistema MUST exigir autenticação e MUST identificar o profissional exclusivamente pelo vínculo da sessão (JWT). A API MUST NOT aceitar identificador de profissional enviado pelo cliente e MUST retornar somente plantões vinculados ao profissional autenticado.

#### Scenario: Profissional consulta os próprios plantões
- **WHEN** um Enfermeiro ou Técnico autenticado abre "Meus plantões"
- **THEN** o sistema retorna somente os plantões em que ele está alocado na versão oficial publicada

#### Scenario: Requisição sem autenticação
- **WHEN** a consulta é enviada sem credenciais válidas
- **THEN** o sistema responde 401 e não revela dados de escala

#### Scenario: Usuário sem vínculo de profissional
- **WHEN** um usuário autenticado sem `profissionalId` faz a consulta
- **THEN** o sistema responde 403 e não expõe plantões de terceiros

#### Scenario: Tentativa de consultar outro profissional
- **WHEN** a requisição inclui identificador de outro profissional
- **THEN** o parâmetro é ignorado ou rejeitado e somente os plantões do usuário autenticado são retornados

### Requirement: Exibir somente a versão oficial publicada

O sistema MUST basear a consulta na versão publicada mais recente de cada mês e MUST NOT expor rascunhos, revisões em andamento ou escalas não publicadas.

#### Scenario: Escala publicada
- **WHEN** existe versão publicada para o mês
- **THEN** os plantões do profissional refletem essa versão (inclusive trocas já aprovadas)

#### Scenario: Revisão em andamento sobre escala publicada
- **WHEN** há uma revisão não publicada do mês
- **THEN** o profissional continua vendo a última versão publicada, sem as alterações da revisão

#### Scenario: Sem plantões
- **WHEN** o profissional não possui plantões publicados na aba selecionada
- **THEN** a interface exibe estado vazio textual, distinto de falha de carregamento

### Requirement: Separar plantões próximos e anteriores

A tela "Meus plantões" MUST oferecer as abas **Próximos** (padrão) e **Anteriores**. Próximos MUST listar em ordem crescente os plantões ainda não encerrados; Anteriores MUST listar os já encerrados, dos mais recentes aos mais antigos, com janela e paginação limitadas para não carregar todo o histórico.

#### Scenario: Aba Próximos
- **WHEN** o profissional abre "Meus plantões"
- **THEN** vê os plantões futuros ou em andamento em ordem cronológica, cada um com o selo textual "TRABALHANDO"

#### Scenario: Aba Anteriores
- **WHEN** o profissional seleciona "Anteriores"
- **THEN** vê os plantões já encerrados com o selo textual "TRABALHADO"

#### Scenario: Plantão que atravessa a meia-noite
- **WHEN** um plantão termina no dia seguinte ao de início
- **THEN** é listado no dia de início com o horário completo e só passa a "anterior" após o término

### Requirement: Detalhar cada plantão no cartão

Cada cartão MUST apresentar o dia e o dia da semana, a duração e o horário (ex.: "24 horas · 07h—07h"), o setor, o enfermeiro chefe (liderança) e as equipes do plantão agrupadas em "Enfermeiros" e "Outros técnicos", apenas com nomes. O sistema MUST NOT expor CPF, COREN, e-mail, telefone ou restrições.

#### Scenario: Visualizar cartão
- **WHEN** um plantão é exibido
- **THEN** o cartão mostra dia, duração/horário, setor, enfermeiro chefe e as listas de enfermeiros e demais técnicos do mesmo plantão

#### Scenario: Plantão extra
- **WHEN** o plantão é do tipo extra
- **THEN** a interface o identifica textualmente como extra

#### Scenario: Dados pessoais
- **WHEN** a resposta da API é inspecionada
- **THEN** não contém CPF, COREN, e-mail, telefone ou restrições de nenhum profissional

### Requirement: Comunicar estados e acessibilidade

A interface MUST apresentar carregamento, vazio e erro com "Tentar novamente", operar por teclado (abas com semântica de tabs) e não depender apenas de cor para os selos. A tela MUST ser somente leitura.

#### Scenario: Falha ao carregar
- **WHEN** a consulta falha
- **THEN** a interface informa a falha e oferece tentar novamente

#### Scenario: Navegar por teclado
- **WHEN** o profissional usa teclado nas abas Próximos/Anteriores
- **THEN** alcança e ativa as abas com foco visível

#### Scenario: Sem ações de edição
- **WHEN** a tela é exibida
- **THEN** não há ação de editar, excluir, publicar ou gerar escala

### Requirement: Indicar a sincronização com Google Agenda como indisponível

A tela "Meus plantões" MUST exibir o botão "Google Agenda" do protótipo em estado desabilitado, perceptível como indisponível por texto ou dica (não só por cor), sem executar nenhuma ação.

#### Scenario: Botão desabilitado
- **WHEN** o profissional tenta acionar "Google Agenda" por clique ou teclado
- **THEN** nada acontece e nenhuma requisição é enviada
