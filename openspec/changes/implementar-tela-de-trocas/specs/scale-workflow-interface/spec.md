## MODIFIED Requirements

### Requirement: A interface de Escala apresenta a navegação e o contexto do usuário
A interface SHALL apresentar a estrutura de navegação e o contexto de Escala conforme a referência visual, usando a identidade do usuário autenticado.

#### Scenario: Coordenação abre a tela Escala
- **WHEN** a Coordenação abre a tela Escala
- **THEN** a navegação apresenta a marca NurseFlow com o subtítulo "Gestão de escalas", a seção "GESTÃO", os itens "Visão geral", "Escala", "Profissionais", "Disponibilidade", "Extras", "Trocas", "Setores" e "Histórico", além de "Configurações"
- **AND** "Escala" aparece ativo, "Trocas" apresenta a contagem de solicitações aguardando decisão da Coordenação retornada pelo servidor (não um valor ilustrativo fixo), e o rodapé identifica o usuário e seu perfil, como "Paloma Ferreira" e "Coordenação" na referência
- **AND** a barra superior apresenta "Escala", busca, notificações com indicador de não lidas e o avatar do usuário
- **AND** o cabeçalho da página mostra "Escala", "Liderança, equipes e setores organizados por dia de plantão.", "Exportar PDF" e "Gerar Escala Automaticamente", sem ações adicionais
- **AND** "Exportar PDF" abre o painel de exportação e "Gerar Escala Automaticamente" abre o painel de configuração, sem iniciar ações diretamente

O badge representa a contagem real global de solicitações aguardando decisão da Coordenação, sem depender do período filtrado na tela Trocas. Zero é exibido como zero; falha ou indisponibilidade da consulta não deve ser apresentada como uma contagem válida ou fictícia.
