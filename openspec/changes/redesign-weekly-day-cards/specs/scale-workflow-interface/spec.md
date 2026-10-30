# Spec Delta

## MODIFIED Requirements

### Requirement: A visualização semanal detalha equipes e cobertura por dia
A interface SHALL permitir consultar e editar cada dia da semana, apresentando a composição da equipe e os turnos associados aos dados da escala em cartões com estados visuais distintos para dias regulares e dias com conflito.

#### Scenario: Coordenação navega entre semanas
- **WHEN** a Coordenação seleciona "Semana"
- **THEN** a tela oferece "‹ Semana anterior", o intervalo da semana, como "8–14 de junho", e "Próxima semana ›"
- **AND** apresenta um cartão por dia com data, dia da semana, "Cobertura diária" e "Editar"

#### Scenario: Dia semanal tem cobertura irregular
- **WHEN** um dia apresenta irregularidade ou conflito de cobertura
- **THEN** seu cartão destaca o dia e a cobertura em estado de revisão e mostra um aviso vermelho com o motivo, como setores abaixo do mínimo ou conflitos para revisar
- **AND** a área de liderança e a composição das equipes permanecem visíveis abaixo do aviso

#### Scenario: Dia semanal não tem conflito
- **WHEN** um dia apresenta cobertura sem irregularidades ou conflitos
- **THEN** seu cartão mostra a identificação do dia e a cobertura diária em estilo regular, sem faixa ou aviso de conflito
- **AND** apresenta a liderança em destaque verde suave e mantém a composição das equipes visível

#### Scenario: Coordenação consulta os profissionais de um dia
- **WHEN** a Coordenação expande ou consulta um cartão diário
- **THEN** as equipes são agrupadas como "ENFERMEIRO CHEFE · LIDERANÇA GERAL", "ENFERMEIROS · 2 EM CAMPO" e "TÉCNICOS · 3 POR SETOR EM CADA TURNO", com quantitativos atualizados pelos dados exibidos
- **AND** cada grupo mostra profissionais com avatar de iniciais, nome, função, setor e turno
- **AND** a liderança exibe "Plantão 24 horas · 07h—07h · Responsável pelos setores A, B e Emergência"
- **AND** os exemplos de turno incluem "Baixa · 07h—19h · restrição" e "Retorna · 19h—07h · cobertura"
- **AND** o cartão diário, a navegação e a ação "Editar" seguem a composição da captura "NurseFlow Web - Escala (Editar)"
