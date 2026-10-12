# NurseFlow

O **NurseFlow** é uma aplicação web desenvolvida para apoiar a **gestão de equipes de enfermagem em ambientes hospitalares**. O projeto busca centralizar informações que normalmente ficam distribuídas em planilhas e controles manuais, oferecendo à coordenação uma forma mais organizada de administrar profissionais e setores.

A proposta é facilitar o acompanhamento dos cadastros, reduzir a repetição de tarefas administrativas e estabelecer uma base para o futuro planejamento de escalas e plantões. O acesso ao sistema é feito por **perfis**, para que cada usuário utilize apenas as funcionalidades permitidas à sua função.

### Funcionalidades

- **Autenticação:** login por perfil, com validação de credenciais na API.
- **Profissionais:** cadastro, consulta e gerenciamento de enfermeiros e técnicos de enfermagem.
- **Setores:** cadastro e gerenciamento dos setores da instituição.
- **Controle de acesso:** separação entre as permissões da Coordenação e dos profissionais.


### Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 e Tailwind CSS 4 |
| Backend | NestJS 12, TypeScript e API REST |
| Banco de dados | MongoDB 8, Mongoose e migrations |
| Ambiente local | Node.js, npm e Docker Compose |

## Como executar o projeto

### 1. Pré-requisitos e versões

Tenha instalados **Node.js**, **npm** e **Docker Desktop** (com Docker Compose). Antes de iniciar, abra um terminal e confira:

```bash
node -v
npm -v
docker --version
docker compose version
```

**Recomendação:** utilize uma versão LTS atual do Node.js compatível com Vite 8 e NestJS 12 (por exemplo, **Node.js 22.12+**). Use o npm que acompanha essa instalação. O projeto utiliza **MongoDB 8**, cuja imagem é iniciada automaticamente pelo Docker Compose; não é necessário instalá-lo separadamente.

Confira também se o **Docker Desktop está aberto e em execução** antes de iniciar o banco.

### 2. Instalar dependências

Abra o terminal na **pasta raiz do NurseFlow** (onde fica o `package.json` principal) e execute:

```bash
npm run setup
```

Esse comando instala as dependências do projeto, do frontend e do backend. Se ainda não existir, também cria `back-end/.env` com base no `.env.example`.

### 3. Configurar o ambiente

Abra `back-end/.env` e confira, principalmente:

- A conexão com o MongoDB.
- `JWT_SECRET`: substitua o valor de exemplo por um segredo próprio.
- `SEED_COORDENACAO_EMAIL` e `SEED_COORDENACAO_SENHA`: credenciais da conta inicial de Coordenação.
- `NODE_ENV=development` para desenvolvimento local.

### 4. Iniciar o banco de dados

Ainda na pasta raiz:

```bash
npm run db:up
```

O comando inicia o **MongoDB 8** em um container Docker e aguarda sua disponibilidade.

### 5. Preparar o banco e criar a Coordenação

Na **primeira execução**:

```bash
cd back-end
npm run migrate:up
npm run seed:coordenacao
cd ..
```

As migrations preparam a estrutura do banco e o seed cria a conta inicial de Coordenação. **Se essa conta já existir, executar o seed novamente não redefine automaticamente sua senha.**

### 6. Iniciar a aplicação

Na pasta raiz:

```bash
npm run dev
```

Esse comando inicia o banco (caso necessário), o backend e o frontend.

| Serviço | Endereço |
| --- | --- |
| Aplicação web | http://localhost:5173 |
| API e documentação Swagger | http://localhost:3000/docs |

Para o primeiro acesso, selecione o perfil **Coordenação** e utilize as credenciais definidas no `back-end/.env` antes de executar o seed.

## Próximas execuções

Depois da configuração inicial, abra o Docker Desktop e execute, na raiz:

```bash
npm run dev
```

Não é necessário repetir o `setup`, as migrations ou o seed a cada inicialização.

## Parar o projeto

Para encerrar frontend e backend, pressione `Ctrl + C` no terminal. Para parar os containers do banco sem apagar os volumes:

```bash
npm run db:down
```

> **Cuidado:** evite `docker compose down -v` ou comandos de limpeza de volumes caso queira manter os profissionais, setores e usuários cadastrados.

## Testes e verificações

Para executar os testes do backend:

```bash
cd back-end
npm run test
npm run test:e2e
```

Para conferir a compilação do frontend:

```bash
cd front-end
npm run build
```

Esses comandos verificam partes diferentes do sistema; o build não substitui os testes de integração.

## Problemas frequentes

- **“Não foi possível conectar ao servidor”:** verifique se `http://localhost:3000/docs` abre e se o frontend está apontando para a porta correta. Confira também as origens permitidas no CORS caso o Vite esteja aberto em outra URL/porta.
- **`401 Unauthorized` no Swagger:** faça login em `POST /auth/login`, copie o `accessToken` e use o botão **Authorize** antes de chamar endpoints protegidos.
- **Login de Coordenação não funciona:** confirme que o seed foi executado e que a conta foi criada com a senha esperada. Alterar `SEED_COORDENACAO_SENHA` após criar a conta não altera a senha armazenada.
- **Banco não inicia:** confirme que o Docker Desktop está aberto e confira os containers com `docker ps`.
