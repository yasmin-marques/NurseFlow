# Design

## Contexto

O front-end usa React, TypeScript, Vite e Tailwind CSS. A navegação é controlada pelo estado local em `App.tsx`, e o shell autenticado é composto por `AppLayout`, `SideMenu` e `TopBar`. A sessão do front-end expõe `id`, `nome`, `email` e `perfil`; `currentUser()` consulta `/auth/me`.

O cabeçalho atual exibe as iniciais do usuário sem ação de navegação para perfil. A aplicação também não possui uma página dedicada ao perfil pessoal. A página de Profissionais é uma funcionalidade de gestão da Coordenação e não deve ser reutilizada como se fosse o perfil do usuário autenticado.

## Referência visual

A referência está preservada em `../../../design/nurseflow/NurseFlow Web - Perfil.jpeg` (1195 × 688). Ela define um cabeçalho branco com marca, pesquisa, notificações e identidade do usuário; uma superfície principal clara sem menu lateral; e um cartão de perfil central com iniciais, nome, formação/COREN, três indicadores, e-mail editável, preferências de notificação e saída.

## Decisões técnicas

- Criar a página de perfil em uma área própria do front-end, sem acoplar suas responsabilidades à tela de gestão de profissionais.
- Usar a sessão autenticada como fonte de identidade. A API atual `/auth/me` expõe `id`, `nome`, `email` e `perfil`; a tela mostra somente nome, e-mail e perfil de acesso, sem exibir o identificador interno.
- O cartão do usuário no rodapé do menu lateral e o avatar do cabeçalho abrem o modo de perfil. Nesse modo, ocultar o menu lateral para corresponder à referência. O botão de fechar retorna à página anterior.
- Manter a ação de sair da sessão em um controle separado do cartão de perfil, para que navegar ao perfil nunca encerre a sessão.
- Implementar a atualização do próprio e-mail e preferência de notificações em endpoints autenticados; derivar o usuário do JWT e validar conflitos de e-mail no back-end.
- Retornar dados profissionais apenas pela identidade autenticada. Apresentar campos ausentes (ex.: vínculo de Coordenação, próximo setor ou jornada não cadastrada) como não informados, sem copiar os valores demonstrativos da imagem.
- Usar a preferência persistida para decidir o envio de notificações futuras de publicação de escala; contas existentes sem preferência mantêm o comportamento atual de receber notificações.
- Tratar estados de carregamento, erro e sucesso explicitamente. Não preencher falhas com dados fictícios.
- Aplicar os padrões de responsividade e acessibilidade já adotados no front-end.

## Segurança e privacidade

- O perfil exibido deve pertencer à sessão autenticada; a interface não deve permitir escolher um identificador de outro usuário para obter dados privados.
- Se houver atualização, o back-end deve derivar a identidade do usuário do contexto autenticado e validar os campos permitidos, em vez de confiar em um identificador enviado pelo cliente.
- Não exibir dados pessoais de outros profissionais nesta tela.

## Riscos

- O modelo atual não fornece próximo setor nem jornada contratual. A tela mantém esses indicadores, mas não inventa seus valores.
- Confundir o perfil pessoal com a edição de profissionais poderia conceder ações de gestão indevidas ou expor dados de terceiros.

## Migração

Não há migração de dados prevista. O novo campo de preferência usa default `true`, preservando o comportamento das contas já existentes.
