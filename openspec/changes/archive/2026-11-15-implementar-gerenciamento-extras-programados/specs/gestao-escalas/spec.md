# Spec Delta

## ADDED Requirements

### Requirement: Considerar extras programados na geração mensal
O sistema MUST considerar extras programados ativos e aplicáveis ao período durante a criação ou regeneração da escala, sem ignorar, duplicar ou contabilizar duas vezes a mesma cobertura.

#### Scenario: Gerar escala com extra programado ativo
- **WHEN** a Coordenação gera uma escala para período que possui extra programado ativo com profissional e turno definidos
- **THEN** o sistema leva essa programação em conta e identifica sua relação com a alocação correspondente sem duplicá-la

#### Scenario: Programação anterior à geração
- **WHEN** a Coordenação registra um extra para um período sem escala e posteriormente gera a escala desse período
- **THEN** a programação permanece disponível e sua conciliação com a escala é explicitada, sem pressupor que já existia plantão persistido

#### Scenario: Regenerar escala editável
- **WHEN** uma escala em revisão é regenerada com extras programados ativos
- **THEN** o sistema reconcilia as programações válidas com os novos plantões, preservando identidade e evitando duplicidades
- **AND** se a geração falhar, a escala anterior e as programações persistidas permanecem íntegras

### Requirement: Refletir alterações de extras na revisão da escala
O sistema SHALL manter a revisão e os indicadores da escala coerentes com extras adicionados, editados ou cancelados, sem alterar silenciosamente versões oficiais.

#### Scenario: Cancelar extra vinculado a rascunho
- **WHEN** a Coordenação cancela um extra vinculado a uma escala editável
- **THEN** o sistema deixa de contá-lo como cobertura ativa e apresenta eventual posição descoberta para revisão

#### Scenario: Alteração afeta escala já validada
- **WHEN** uma mudança de extra altera a cobertura de uma escala previamente validada mas ainda editável
- **THEN** o sistema invalida a validação anterior e exige nova validação antes da publicação

#### Scenario: Alteração afetaria escala publicada
- **WHEN** a edição ou cancelamento de extra afetaria uma escala publicada ou finalizada
- **THEN** o sistema preserva a versão oficial e exige um fluxo autorizado de revisão

