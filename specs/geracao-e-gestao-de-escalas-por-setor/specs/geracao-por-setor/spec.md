# Spec: geração de escala por setor

## Objetivo

Gerar plantões de 24 horas que atendam os mínimos de profissionais na hierarquia atual de setores e subsetores, permitindo geração isolada por setor.

## Requisitos

### Requisito: atender quantitativos mínimos com plantões de 24 horas

O sistema MUST gerar plantões de 24 horas e buscar somente o quantitativo mínimo aplicável por setor/subsetor e período. O sistema MUST NOT penalizar ou excluir profissionais por não atingirem uma carga horária esperada. Regras obrigatórias de elegibilidade permanecem válidas; a cobertura que não puder ser preenchida deve ser informada.

#### Cenário: setor com subsetores

- **WHEN** a Coordenação gera uma escala para um setor que possui subsetores
- **THEN** a quantidade mínima de enfermeiros é calculada para o setor como um todo
- **AND** a quantidade mínima de técnicos é calculada separadamente para cada subsetor
- **AND** os plantões gerados têm 24 horas

#### Cenário: setor sem subsetores

- **WHEN** a Coordenação gera uma escala para um setor sem subsetores
- **THEN** os mínimos de enfermeiros e técnicos são calculados no próprio setor
- **AND** os plantões gerados têm 24 horas

#### Cenário: profissionais elegíveis insuficientes

- **WHEN** não há profissionais elegíveis suficientes para cumprir um mínimo
- **THEN** a escala informa quantidade requerida, alocada e faltante para o setor/subsetor
- **AND** a geração não viola disponibilidade, descanso, situação, vínculo ou formação
- **AND** profissionais não são penalizados por carga horária inferior à esperada

### Requisito: gerar um setor sem afetar os demais

O sistema MUST aceitar um setor como escopo da geração e alterar somente as alocações desse setor, preservando plantões dos demais setores no mesmo período.

#### Cenário: geração individual

- **WHEN** a Coordenação gera um setor em um período que já contém plantões de outros setores
- **THEN** o sistema cria ou substitui somente os plantões do setor solicitado
- **AND** mantém inalterados os plantões dos demais setores
- **AND** se geração ou persistência falhar, mantém as alocações anteriores intactas

### Requisito: definir chefe geral pelo Internamento

O sistema MUST considerar como chefe geral o enfermeiro escalado no setor Internamento para a data/período aplicável, independentemente do setor consultado ou exportado.

#### Cenário: chefe geral disponível

- **WHEN** há enfermeiro escalado no Internamento para o período
- **THEN** esse profissional é identificado como chefe geral de plantão
- **AND** essa identificação pode ser consultada para todos os setores, inclusive Emergência
