# Perfil do usuário

## ADDED Requirements

### Requirement: Acessar o perfil pessoal

O sistema DEVE disponibilizar a tela de perfil para os perfis autenticados de Coordenação, Enfermeiro e Técnico. O cartão do usuário no rodapé do menu lateral e o avatar no cabeçalho DEVEM oferecer acesso à tela.

#### Scenario: Abrir o perfil pela aplicação

- **Given** que um usuário esteja autenticado
- **When** ele acionar o cartão do usuário no rodapé do menu lateral ou o avatar do cabeçalho
- **Then** o sistema apresenta a tela de perfil pessoal na composição independente da referência
- **And** navegar para o perfil não encerra a sessão
- **And** o botão “Sair” encerra a sessão

### Requirement: Exibir os dados do usuário autenticado

A tela DEVE reproduzir a composição da referência visual em `design/nurseflow/NurseFlow Web - Perfil.jpeg`, apresentando os dados da sessão autenticada e os dados profissionais disponíveis para esse usuário. Ela NÃO DEVE usar dados de demonstração nem permitir que um usuário consulte o perfil de outra pessoa por meio de identificadores fornecidos pelo cliente.

#### Scenario: Carregar os próprios dados

- **Given** que a sessão autenticada corresponda ao usuário A
- **When** a tela de perfil for carregada
- **Then** os dados apresentados pertencem ao usuário A
- **And** nenhum dado de outro usuário é exibido

#### Scenario: Sessão indisponível ao acessar o perfil

- **Given** que o sistema não consiga validar/carregar a sessão atual
- **When** a aplicação verificar a autenticação
- **Then** o perfil não é apresentado e a aplicação solicita autenticação
- **And** o sistema não apresenta dados fictícios como se fossem dados do usuário

#### Scenario: Dados opcionais indisponíveis

- **Given** que um campo profissional do design não exista para o usuário ou ainda não esteja cadastrado
- **When** o perfil for apresentado
- **Then** o campo permanece na posição prevista pelo design
- **And** seu valor é apresentado como não informado, sem usar dados demonstrativos

### Requirement: Reproduzir a referência visual e suas interações

A tela DEVE reproduzir a hierarquia, os conteúdos, os estados e as ações visíveis na imagem `design/nurseflow/NurseFlow Web - Perfil.jpeg`, mantendo a identidade visual do NurseFlow e adaptando-se a telas estreitas.

#### Scenario: Conferir a tela contra o design

- **Given** que a imagem de referência esteja disponível no repositório
- **When** a tela for implementada e revisada
- **Then** cada campo, ação e estado visível na imagem possui comportamento correspondente
- **And** não são adicionados campos ou ações que exponham informações pessoais além das permitidas ao usuário autenticado

### Requirement: Editar e-mail e preferências de notificação

O sistema DEVE permitir ao usuário atualizar seu próprio e-mail e a preferência de receber notificações sobre publicação de escalas. A identidade do usuário DEVE ser derivada da sessão autenticada. O sistema DEVE validar o e-mail, rejeitar endereços já usados por outra conta e informar o resultado sem atualizar usuários diferentes.

#### Scenario: Atualizar e-mail próprio

- **Given** que o usuário informe um e-mail válido e disponível
- **When** confirmar a edição
- **Then** o sistema salva o e-mail na conta autenticada
- **And** atualiza o e-mail mostrado na sessão sem encerrar o acesso

#### Scenario: Rejeitar e-mail inválido ou em uso

- **Given** que o e-mail informado seja inválido ou esteja associado a outra conta
- **When** o sistema validar a alteração
- **Then** o e-mail existente é preservado
- **And** o motivo da rejeição é informado

#### Scenario: Configurar notificações de publicação

- **Given** que o usuário abra as preferências de notificação
- **When** habilitar ou desabilitar avisos de publicação de escala e salvar
- **Then** a preferência é persistida na conta autenticada
- **And** publicações futuras respeitam essa escolha

## Pendência de especificação

O design não define o conteúdo da tela de preferências após acionar o botão correspondente; a mudança implementa a preferência de notificação de publicação de escalas, única categoria de notificação já existente no produto.

