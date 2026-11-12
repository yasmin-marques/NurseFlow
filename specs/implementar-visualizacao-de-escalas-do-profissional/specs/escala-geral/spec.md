# Spec Delta

## Purpose

Permitir que Enfermeiros e Técnicos vejam, em modo somente leitura, quem está de plantão na escala oficial publicada, por mês e semana, com detalhe diário e sem dados pessoais.

## ADDED Requirements

### Requirement: Restringir a escala geral a usuários com vínculo e à versão publicada

O sistema MUST exigir autenticação e vínculo de profissional, e MUST basear a consulta na versão oficial publicada mais recente do mês, nunca em rascunho ou revisão. O sistema MUST NOT expor CPF, COREN, e-mail, telefone ou restrições.

#### Scenario: Sem autenticação ou sem vínculo
- **WHEN** a consulta é feita sem token válido ou por usuário sem vínculo de profissional
- **THEN** o sistema responde 401 ou 403, respectivamente, sem revelar dados

#### Scenario: Mês sem escala publicada
- **WHEN** o mês não possui versão publicada
- **THEN** a interface informa "escala não publicada" sem erro

#### Scenario: Dados pessoais
- **WHEN** a resposta é inspecionada
- **THEN** contém apenas nome, cargo/função, liderança, setor, horário e tipo/regime

### Requirement: Navegar por mês e por semana

A tela "Escala geral" MUST exibir o título, a mensagem "Veja quem estará de plantão. Dados pessoais não são exibidos.", um seletor de mês (anterior/seguinte) e a navegação "Semana anterior" / "Próxima semana" com o intervalo da semana (ex.: "8—14 de junho"), iniciando na semana corrente.

#### Scenario: Abrir a tela
- **WHEN** o profissional abre "Escala geral"
- **THEN** vê o mês e a semana correntes e um cartão por dia

#### Scenario: Trocar de semana ou mês
- **WHEN** seleciona "Semana anterior", "Próxima semana" ou outro mês
- **THEN** a lista é atualizada sem misturar dias de outros períodos e, ao cruzar o limite do mês, o mês exibido acompanha a semana

### Requirement: Resumir cada dia em um cartão

Cada cartão MUST mostrar o dia e a abreviação do dia da semana, o turno com horário (ex.: "DIURNO · 07h—19h", "NOTURNO · 19h—07h"), o nome do responsável (enfermeiro chefe do dia) e o setor/área. Dias sem plantão publicado MUST ser indicados textualmente.

#### Scenario: Cartão do dia
- **WHEN** um dia possui plantão publicado
- **THEN** o cartão mostra data, turno e horário, responsável e setor/área, e é acionável por clique ou teclado

#### Scenario: Dia sem plantão
- **WHEN** não há plantão publicado no dia
- **THEN** o dia aparece com indicação textual de ausência de escala

### Requirement: Detalhar a cobertura diária em modal rolável

Ao selecionar um dia, o sistema MUST abrir um modal com data, tipo ("Cobertura diária"), mês/ano, enfermeiro chefe com liderança geral e setores sob sua responsabilidade, a lista de enfermeiros e a de técnicos com contagens (ex.: "2 em 24H", "3 por setor em cada turno") e, para cada pessoa, nome, cargo, setor e regime (ex.: "24 horas · 07h—07h", "Diurno · 07h—19h · restrição", "Noturno · 19h—07h · cobertura"). O conteúdo MUST rolar dentro do modal quando exceder a altura, mantendo cabeçalho e botão de fechar visíveis.

#### Scenario: Abrir detalhes do dia
- **WHEN** o profissional seleciona um dia
- **THEN** o modal exibe chefe, enfermeiros e técnicos com setor e regime de cada um

#### Scenario: Lista longa
- **WHEN** o dia possui muitos profissionais
- **THEN** a lista rola dentro do modal e a página de fundo não rola

#### Scenario: Fechar e retornar o foco
- **WHEN** o profissional fecha o modal (botão, Esc ou clique fora)
- **THEN** o foco retorna ao cartão de origem

#### Scenario: Regime por origem de cobertura
- **WHEN** o vínculo tem origem de restrição ou cobertura complementar
- **THEN** o regime é rotulado textualmente ("restrição" ou "cobertura"), sem depender apenas de cor
