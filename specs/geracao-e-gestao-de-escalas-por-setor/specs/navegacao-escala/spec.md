# Spec: navegação da escala

## Objetivo

Manter ações de geração no local previsto e deixar a navegação mensal clara, com controles de período consistentes.

## Requisitos

### Requisito: posicionar ações de geração e período

O sistema MUST remover o botão de geração automática localizado no topo próximo à exportação e MUST manter o botão de geração abaixo dos ciclos da escala. Os controles de mês devem aparecer antes do seletor de ano, com padding direito adequado no dropdown.

#### Cenário: ações de geração

- **WHEN** a Coordenação visualiza a tela de escala
- **THEN** não há botão de geração automática junto aos controles superiores
- **AND** a ação de gerar escala permanece disponível abaixo dos ciclos

#### Cenário: navegar por mês e ano

- **WHEN** a Coordenação navega entre meses e seleciona um ano
- **THEN** os controles de mês aparecem antes do seletor de ano
- **AND** o dropdown mantém padding direito adequado
- **AND** a navegação visual entre meses é clara

### Nota de avaliação

A navegação entre meses e a ordem mês/ano foram reportadas como já implementadas. Conferir o componente e a interface antes de alterar; registrar como verificado somente após essa avaliação.
