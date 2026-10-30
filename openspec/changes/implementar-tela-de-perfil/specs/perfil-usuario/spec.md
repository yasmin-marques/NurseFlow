# Perfil do usuário

## Requisitos

### Requisito: Acessar o perfil pessoal

O sistema DEVE disponibilizar a tela de perfil para os perfis autenticados de Coordenação, Enfermeiro e Técnico. O cartão do usuário no rodapé do menu lateral e o avatar no cabeçalho DEVEM oferecer acesso à tela.

#### Cenário: Abrir o perfil pela aplicação

- **Dado** que um usuário esteja autenticado
- **Quando** ele acionar o cartão do usuário no rodapé do menu lateral ou o avatar do cabeçalho
- **Então** o sistema apresenta a tela de perfil pessoal na composição independente da referência
- **E** navegar para o perfil não encerra a sessão
- **E** o botão “Sair” encerra a sessão

### Requisito: Exibir os dados do usuário autenticado

A tela DEVE reproduzir a composição da referência visual em `design/nurseflow/NurseFlow Web - Perfil.jpeg`, apresentando os dados da sessão autenticada e os dados profissionais disponíveis para esse usuário. Ela NÃO DEVE usar dados de demonstração nem permitir que um usuário consulte o perfil de outra pessoa por meio de identificadores fornecidos pelo cliente.

#### Cenário: Carregar os próprios dados

- **Dado** que a sessão autenticada corresponda ao usuário A
- **Quando** a tela de perfil for carregada
- **Então** os dados apresentados pertencem ao usuário A
- **E** nenhum dado de outro usuário é exibido

#### Cenário: Sessão indisponível ao acessar o perfil

- **Dado** que o sistema não consiga validar/carregar a sessão atual
- **Quando** a aplicação verificar a autenticação
- **Então** o perfil não é apresentado e a aplicação solicita autenticação
- **E** o sistema não apresenta dados fictícios como se fossem dados do usuário

#### Cenário: Dados opcionais indisponíveis

- **Dado** que um campo profissional do design não exista para o usuário ou ainda não esteja cadastrado
- **Quando** o perfil for apresentado
- **Então** o campo permanece na posição prevista pelo design
- **E** seu valor é apresentado como não informado, sem usar dados demonstrativos

### Requisito: Reproduzir a referência visual e suas interações

A tela DEVE reproduzir a hierarquia, os conteúdos, os estados e as ações visíveis na imagem `design/nurseflow/NurseFlow Web - Perfil.jpeg`, mantendo a identidade visual do NurseFlow e adaptando-se a telas estreitas.

#### Cenário: Conferir a tela contra o design

- **Dado** que a imagem de referência esteja disponível no repositório
- **Quando** a tela for implementada e revisada
- **Então** cada campo, ação e estado visível na imagem possui comportamento correspondente
- **E** não são adicionados campos ou ações que exponham informações pessoais além das permitidas ao usuário autenticado

### Requisito: Editar e-mail e preferências de notificação

O sistema DEVE permitir ao usuário atualizar seu próprio e-mail e a preferência de receber notificações sobre publicação de escalas. A identidade do usuário DEVE ser derivada da sessão autenticada. O sistema DEVE validar o e-mail, rejeitar endereços já usados por outra conta e informar o resultado sem atualizar usuários diferentes.

#### Cenário: Atualizar e-mail próprio

- **Dado** que o usuário informe um e-mail válido e disponível
- **Quando** confirmar a edição
- **Então** o sistema salva o e-mail na conta autenticada
- **E** atualiza o e-mail mostrado na sessão sem encerrar o acesso

#### Cenário: Rejeitar e-mail inválido ou em uso

- **Dado** que o e-mail informado seja inválido ou esteja associado a outra conta
- **Quando** o sistema validar a alteração
- **Então** o e-mail existente é preservado
- **E** o motivo da rejeição é informado

#### Cenário: Configurar notificações de publicação

- **Dado** que o usuário abra as preferências de notificação
- **Quando** habilitar ou desabilitar avisos de publicação de escala e salvar
- **Então** a preferência é persistida na conta autenticada
- **E** publicações futuras respeitam essa escolha

## Pendência de especificação

O design não define o conteúdo da tela de preferências após acionar o botão correspondente; a mudança implementa a preferência de notificação de publicação de escalas, única categoria de notificação já existente no produto.
