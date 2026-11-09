# Proposal

## Por que

O NurseFlow ainda não possui uma tela dedicada ao perfil do usuário autenticado. A identidade disponível na sessão aparece apenas de forma resumida no cabeçalho, sem uma área própria para consultar os dados e realizar as ações previstas para o perfil.

## O que muda

- Criar uma tela de perfil independente, com ponto de entrada no cartão do usuário do menu lateral e no avatar do cabeçalho.
- Apresentar os dados e as ações de perfil de acordo com a referência visual oficial, respeitando a identidade e as permissões do usuário autenticado.
- Tratar carregamento, salvamento (se previsto no design), cancelamento e erros de forma explícita.
- Validar a adaptação responsiva e a acessibilidade da tela.

## Escopo

Esta mudança cobre a tela do perfil pessoal dos usuários autenticados (Coordenação, Enfermeiro e Técnico). Não cobre o gerenciamento de outros profissionais pela Coordenação, nem alteração de regras das escalas.

Os campos, ações e a composição visual seguem a imagem `design/nurseflow/NurseFlow Web - Perfil.jpeg`. Valores ilustrativos da imagem não devem ser copiados como dados de usuários reais.

## Capacidades afetadas

- `perfil-usuario`: consulta e interação com o perfil do próprio usuário.
- Shell da aplicação: navegação para a tela de perfil.
