# NurseFlow — execução integrada

Aplicação com **React 19 / Vite**, **NestJS**, **MongoDB 8** e **Nginx**. O Compose reside na raiz e sobe os três serviços. O frontend utiliza `/api` como URL de API; o Nginx faz proxy para `http://backend:3000` dentro da rede Docker.

## Sumário

1. [Sobre o NurseFlow](#sobre-o-nurseflow)
2. [Tecnologias utilizadas](#tecnologias-utilizadas)
3. [Estrutura do repositório](#estrutura-do-repositório)
4. [Pré-requisitos](#pré-requisitos)
5. [Instalação (desenvolvimento local)](#instalação-desenvolvimento-local)
6. [Execução (desenvolvimento local)](#execução-desenvolvimento-local)
7. [Execução com Docker (stack completa)](#execução-com-docker-stack-completa)
8. [Testes automatizados](#testes-automatizados)
9. [Solução de problemas](#solução-de-problemas)
10. [Dados de demonstração (Docker)](#dados-de-demonstração-docker)

## Sobre o NurseFlow

O NurseFlow é um sistema web de apoio à gestão da equipe de enfermagem de um hospital. Ele centraliza o cadastro dos profissionais, a definição do efetivo mínimo de cada setor e as regras e restrições que servirão de base para a organização das escalas. O acesso é controlado por perfil: **Coordenação**, **Enfermeiro** e **Técnico**.

**Objetivos**

- Substituir controles manuais por um cadastro único e consistente de profissionais e setores.
- Garantir que as regras da coordenação (limites de trocas, cargas por vínculo, quantitativos por turno) fiquem registradas e sejam aplicadas pela API.
- Registrar a disponibilidade e as restrições de cada profissional.

**Principais funcionalidades (o que existe hoje)**

| Módulo | O que faz |
| --- | --- |
| Autenticação | Login por perfil com JWT, bloqueio temporário após tentativas inválidas e recuperação de senha com token de uso único |
| Profissionais | Cadastro, busca, filtro, edição e desativação lógica (sem exclusão); validação de CPF e detecção de duplicidade por CPF/COREN |
| Setores | Cadastro com quantitativo mínimo de enfermeiros/técnicos por turno (diurno e noturno), edição por turno, inativação e reativação |
| Configurações | Limites de trocas, extras e cargas de plantão por vínculo e por mês (restrito à Coordenação) |
| Restrições / disponibilidade | Registro, consulta e exclusão de indisponibilidades, ausências, vínculos externos e disponibilidades por profissional |

As limitações atuais (por exemplo, ausência de geração automática de escalas) estão descritas na seção [Integração das funcionalidades](#5-integração-das-funcionalidades).

## Tecnologias utilizadas

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Vitest |
| Backend | NestJS 12, TypeScript, Mongoose, JWT (`@nestjs/jwt`), bcryptjs, class-validator, Swagger/OpenAPI, Jest + Supertest |
| Banco de dados | MongoDB 8, com esquema e índices versionados por migrations (`migrate-mongo`) |
| Infraestrutura | Docker / Docker Compose, Nginx (serve o frontend e faz proxy de `/api` no modo Docker) |

## Estrutura do repositório

```text
NurseFlow/
├── back-end/            API NestJS (src/, migrations/, scripts/, test/)
├── front-end/           Aplicação React/Vite
├── db/                  docker-compose.yml apenas do MongoDB (uso local) e script de inicialização
├── scripts/setup.mjs    Instala dependências e prepara o .env do back-end
├── docs/                Documentos de requisitos, arquitetura e diagramas
├── docker-compose.yml   Stack completa (mongo + backend + frontend + seed-demo)
├── .env.example         Variáveis do Docker Compose
└── package.json         Scripts da raiz (dev, test, db:up, ...)
```

## Pré-requisitos

- **Node.js ≥ 24** e **npm ≥ 10** (exigência do backend; o Nest 12 é distribuído como ESM).
- **Docker Engine com Compose v2** (necessário para subir o MongoDB e para a stack completa).
- Para executar sem Docker: Node e npm compatíveis com os `package.json`/`package-lock.json` dos projetos.

Verifique as versões instaladas:

```bash
node -v
npm -v
docker --version
docker compose version
```

## Instalação (desenvolvimento local)

Fluxo para rodar o frontend e o backend na sua máquina, usando o Docker apenas para o MongoDB. Execute a partir da **raiz do repositório**.

**1. Instale as dependências** (raiz, `back-end` e `front-end`):

```bash
npm install
npm --prefix back-end install
npm --prefix front-end install
```

> O script `npm run setup` faz o mesmo e tenta criar o `back-end/.env`, mas ele procura o arquivo `back-end/.env.example`, e o modelo do repositório se chama `back-end/.env.exemple`. Em um clone novo, use os comandos acima e crie o `.env` manualmente no próximo passo.

**2. Configure o `.env` do backend:**

```bash
cp back-end/.env.exemple back-end/.env
```

Edite `back-end/.env`:

- `MONGODB_URI`: o MongoDB de `db/docker-compose.yml` roda sem autenticação e publica a porta 27017, então use `mongodb://localhost:27017/nurseflow` (o valor do modelo, com host `mongo`, serve apenas para o Docker Compose da raiz).
- `JWT_SECRET`: chave aleatória com 16 caracteres ou mais.
- `SEED_COORDENACAO_NOME`, `_EMAIL`, `_CPF` (CPF válido) e `_SENHA` (de 8 a 72 caracteres): dados da primeira conta de Coordenação.

As demais variáveis (`CORS_ORIGINS`, `JWT_EXPIRES_IN_SECONDS`, `LOGIN_MAX_ATTEMPTS`, ...) estão documentadas em [back-end/README.md](back-end/README.md). O `.env` real **não** deve ser versionado.

**3. Configure o frontend.** Sem Docker não existe o proxy `/api`, então aponte o frontend para a API criando `front-end/.env.local`:

```dotenv
VITE_API_URL=http://localhost:3000
```

**4. Inicie o MongoDB:**

```bash
npm run db:up
```

O comando sobe o MongoDB 8 em segundo plano e aguarda o healthcheck (`docker compose -f db/docker-compose.yml up -d --wait`). Para parar: `npm run db:down`.

**5. Execute as migrations** (criam validators e índices; a API **não** os cria sozinha):

```bash
npm --prefix back-end run migrate:up
npm --prefix back-end run migrate:status   # opcional: lista o que foi aplicado
```

**6. Crie a conta inicial da Coordenação** (não existe cadastro público; o seed não faz nada se o usuário já existir):

```bash
npm --prefix back-end run seed:coordenacao
```

## Execução (desenvolvimento local)

Com o `.env` configurado, as migrations aplicadas e o seed executado, na raiz:

```bash
npm run dev
```

O comando sobe o MongoDB (`npm run db:up`) e inicia, em paralelo, o backend (`nest start --watch`) e o frontend (Vite, porta 5173 fixa).

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |

No login, escolha o perfil correspondente à conta (Coordenação, Enfermeiro ou Técnico) e entre com o e-mail e a senha definidos em `SEED_COORDENACAO_*`. No Swagger, use *Authorize* com o `accessToken` retornado por `POST /auth/login`.

Para iniciar apenas uma das partes: `npm run dev:back` ou `npm run dev:front`.

# Execução com Docker (stack completa)

As seções abaixo descrevem a stack completa em containers (MongoDB + backend + frontend com Nginx), na porta 8080 do frontend.

## 1. Configurar o ambiente

Na **raiz do repositório**:

```bash
cp .env.example .env
```

Troque `MONGO_ROOT_PASSWORD` e `JWT_SECRET`. A URL `MONGODB_URI` deve usar as mesmas credenciais definidas no Compose e o hostname `mongo` (não `localhost`). Se a senha contiver caracteres especiais, codifique-os na URI. O `.env` real **não** deve ser versionado.

## 2. Preparar os lockfiles

O Docker usa `npm ci`; se os lockfiles estiverem fora de sincronia com `package.json`, rode antes:

```bash
cd back-end && npm install --package-lock-only && cd ..
cd front-end && npm install --package-lock-only && cd ..
```

Versione o `package-lock.json` atualizado. Não substitua `npm ci` por `npm install` no Dockerfile para contornar erros de lockfile.

## 3. Iniciar MongoDB + backend + frontend

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs -f backend frontend
```

- **Frontend**: http://localhost:8080 (variável `FRONTEND_PORT`).
- **API**: http://localhost:3000 (variável `BACKEND_PORT`).
- **Swagger**: http://localhost:3000/docs.
- **MongoDB**: acessível somente pela rede do Compose como `mongo:27017`.

### Dependências de saúde

- O healthcheck do MongoDB faz `ping` autenticado.
- O backend usa `depends_on: mongo: condition: service_healthy`.
- O frontend usa `depends_on: backend: condition: service_healthy`.
- Os healthchecks não garantem reinício de dependentes quando outro container ficar unhealthy posteriormente.

O comando de inicialização do backend roda as migrations antes da API. Para cadastrar a coordenação após iniciar os serviços, defina as variáveis `SEED_COORDENACAO_*` no `.env` e execute:

```bash
docker compose exec backend npm run seed:coordenacao
```

## 4. Desenvolvimento do frontend fora do Docker

Com o banco e o backend disponíveis em `localhost:3000`:

```bash
cd front-end
npm ci
```

Crie um arquivo `front-end/.env.local` com:

```dotenv
VITE_API_URL=http://localhost:3000
```

Inicie:

```bash
npm run dev
```

Abra http://localhost:5173. Ao desenvolver localmente, a API aceita essa origem conforme `CORS_ORIGINS`. Para o frontend dentro do Docker, **não** configure `VITE_API_URL` com `backend:3000` (o navegador não conhece o DNS do Compose): o valor padrão `/api` funciona via Nginx.

## 5. Integração das funcionalidades

| Funcionalidade | Situação |
| --- | --- |
| Autenticação e sessão | API existente (`/auth/*`) usada pelo frontend |
| Profissionais | Listagem/cadastro/atualização por API existente |
| Setores | Listagem/cadastro/edição de quantitativos por API existente |
| Configurações | Consulta e gravação por `GET /configuracoes`, `PATCH /configuracoes/limites`, `PUT /configuracoes/cargas` |
| Disponibilidade | Listagem/criação/exclusão via `/profissionais/:id/restricoes` |
| Conflitos | Endpoint no backend disponível, **não** conectado a um gerador de escalas (inexistente) |

**Limitações intencionais**:

- O backend ainda não implementa aprovação de trocas, geração automática de coberturas, notificações ou configuração de limites específicos de extras por vínculo. A tela de configurações exibe somente as opções persistidas de verdade.
- O schema de restrições persiste períodos e, opcionalmente, **um dia da semana por registro**, mas não turno/horário; o frontend rejeita criação de preferências de turno e vínculo externo com turno definido em vez de fingir persistência. Múltiplos dias selecionados criam múltiplos registros; falha em uma das requisições pode deixar um subconjunto cadastrado, pois não existe endpoint transacional em lote.
- O backend só expõe criação, consulta e exclusão de restrições, portanto a UI oferece **exclusão e novo cadastro** no lugar de edição.
- Restrições marcadas como recorrentes sem data utilizam, temporariamente, um período de cinco anos; não há recorrência infinita no modelo atual.
- O endpoint de restrições está protegido para perfil coordenação no backend. Usuários sem esse perfil podem receber 403 nesta tela até a autorização ser definida.
- A geração automática de escalas **não existe** no backend fornecido e não é declarada funcional neste pacote.

## 6. Diagnóstico e encerramento

```bash
docker compose ps
docker compose logs -f mongo
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

O volume nomeado `mongo_data` é preservado por `docker compose down`; **não** use `down -v` sem desejar apagar o banco de dados.

## 7. Validar o build fora do Docker

```bash
cd front-end && npm ci && npm run build && cd ..
cd back-end && npm ci && npm run build && cd ..
```

Esses comandos exigem acesso ao registro npm. O pacote foi montado sem validar execução end-to-end com MongoDB real; execute-os em seu ambiente antes de integrar à branch principal.

## Testes automatizados

Todos os testes (backend + frontend) rodam com um único comando, na raiz do projeto:

```bash
npm test
```

Pré-requisito: dependências instaladas em `back-end/` e `front-end/` (`npm install` em cada uma; veja `npm run setup`). **Não** é necessário Docker nem MongoDB: os testes de integração usam `mongodb-memory-server` (o binário do MongoDB é baixado na primeira execução, o que exige internet).

`npm test` executa, em sequência (para no primeiro que falhar):

| Script | O que roda | Cobertura |
|---|---|---|
| `npm run test:back` | Jest, testes unitários do backend | Guard de perfis, validação de CPF |
| `npm run test:e2e` | Jest + Supertest + MongoDB em memória (`back-end/test`) | Login/autenticação, Profissionais, Setores, autorização por perfil, Configurações, Restrições/Disponibilidade, migrations |
| `npm run test:front` | Vitest (`front-end/src/**/*.test.ts`) | Serviços do frontend: auth, setores, profissionais, configurações, restrições |

Cada grupo também pode ser executado isoladamente com os scripts acima.

## Solução de problemas

### Conexão com o banco e com a API

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Backend não conecta ao MongoDB (`ECONNREFUSED`, timeout de seleção de servidor) | MongoDB parado | `docker compose -f db/docker-compose.yml ps`; se não estiver saudável, `npm run db:up` |
| O mesmo erro, com o MongoDB rodando | `MONGODB_URI` com host `mongo` fora do Docker | Em execução local use `mongodb://localhost:27017/nurseflow` no `back-end/.env` |
| `Authentication failed` | Credenciais da URI diferentes das do Compose da raiz, ou senha com caracteres especiais sem codificação | No Docker, use as mesmas credenciais de `MONGO_ROOT_*` na `MONGODB_URI` e codifique caracteres especiais |
| O backend não inicia por variável ausente | `MONGODB_URI` e `JWT_SECRET` são obrigatórias | Confira o `.env` (veja [back-end/README.md](back-end/README.md)) |
| Frontend exibe "Não foi possível conectar ao servidor." | API fora do ar, ou frontend sem `VITE_API_URL` em modo local | Confirme http://localhost:3000/docs e crie `front-end/.env.local` com `VITE_API_URL=http://localhost:3000`; reinicie o Vite |
| Erro de CORS no navegador | Origem do frontend fora de `CORS_ORIGINS` | Inclua a origem (ex.: `http://localhost:5173`) em `CORS_ORIGINS`, separadas por vírgula, e reinicie o backend |
| Consultas falham ou faltam índices em banco novo | Migrations não aplicadas | `npm --prefix back-end run migrate:up` (no Docker elas rodam na inicialização do backend) |

### Autenticação

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Login recusado com e-mail e senha corretos | Perfil selecionado diferente do da conta | Selecione o perfil correto (Coordenação, Enfermeiro ou Técnico) |
| Não há nenhum usuário para entrar | Seed da Coordenação não executado | `npm --prefix back-end run seed:coordenacao` (Docker: `docker compose exec backend npm run seed:coordenacao`) |
| `Defina SEED_COORDENACAO_...` ou senha inválida no seed | Variáveis do seed ausentes, ou senha fora de 8 a 72 caracteres | Preencha todas as `SEED_COORDENACAO_*` no `.env` |
| Seed informa que o usuário já existe | Comportamento esperado: nada é alterado | Para trocar a senha, use a recuperação de senha |
| Login bloqueado após várias tentativas | Bloqueio temporário (`LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES`, padrão 5 / 15 min) | Aguarde o tempo de bloqueio; vale mesmo com a senha correta |
| Sessão encerrada de repente | Token expirado (padrão 8 h) ou `JWT_SECRET` alterado | Entre novamente |
| `403 Forbidden` | Perfil sem permissão (configurações, setores e restrições exigem Coordenação) | Use uma conta de Coordenação |

### Docker

| Sintoma | O que fazer |
| --- | --- |
| `docker: command not found` ou "cannot connect to the Docker daemon" | Instale/inicie o Docker Desktop ou o serviço do Docker e confira com `docker --version` |
| `docker compose` não existe | É necessário o Compose v2 (`docker compose version`) |
| Porta já em uso (3000, 5173, 8080, 27017) | Encerre o processo que usa a porta ou altere `BACKEND_PORT` / `FRONTEND_PORT` no `.env`. O `npm run dev` exige a 5173 livre (`--strictPort`) |
| `npm run db:up` falha ao aguardar o healthcheck | `docker compose -f db/docker-compose.yml logs mongo`; aguarde alguns segundos e tente de novo |
| Build do Docker falha em `npm ci` | Lockfile fora de sincronia: veja [Preparar os lockfiles](#2-preparar-os-lockfiles) |
| Container `unhealthy` ou reiniciando | `docker compose ps` e `docker compose logs -f backend` (ou `mongo`, `frontend`) |
| Quero reiniciar com o banco limpo (**apaga todos os dados**) | `docker compose down -v` |
| Testes e2e falham ao baixar o MongoDB | O `mongodb-memory-server` baixa o binário na primeira execução e precisa de internet; não depende do Docker |

## Dados de demonstração (Docker)

> **Somente desenvolvimento local.** Nunca habilite o seed de demonstração em produção nem exponha suas contas de teste publicamente.

Na raiz, inclua no `.env` (use senhas novas; nunca commite o `.env`):

```dotenv
DEMO_SEED_ENABLED=true
DEMO_ADMIN_PASSWORD=EscolhaUmaSenhaForteAdmin!
DEMO_PRO_PASSWORD=EscolhaUmaSenhaForteProf!
```

Então execute:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs seed-demo
```

**Ordem:** `mongo` saudável → `backend` (migrations e API, saudável) → `seed-demo` (execução única) → `frontend`. O serviço de seed deve terminar com `Exited (0)`; **não** fica em execução permanentemente. Para executá-lo novamente em um banco já iniciado: `docker compose run --rm seed-demo`. É idempotente: cria apenas registros inexistentes; **não restaura registros alterados, nem redefine senhas existentes**. Para renovar credenciais de uma conta já existente, utilize a recuperação de senha ou um banco de testes descartável. Para **apagar todos os dados** (destrutivo): `docker compose down -v`.

### Contas de teste

| Login | Perfil | Formação / Vínculo / Status |
|---|---|---|
| `admin@nurseflow.test` | coordenação | administração |
| `ana@nurseflow.test` | enfermeiro | enfermeiro / concursado / ativo |
| `bruno@nurseflow.test` | enfermeiro | enfermeiro / CLT / ativo |
| `carla@nurseflow.test` | enfermeiro | enfermeiro / RPA / ativo |
| `daniela@nurseflow.test` | técnico | técnico / concursado / ativo |
| `eduardo@nurseflow.test` | técnico | técnico / CLT / ativo |
| `fernanda@nurseflow.test` | técnico | técnico / RPA / ativo |
| `gabriela@nurseflow.test` | enfermeiro | enfermeiro / concursado / férias |
| `henrique@nurseflow.test` | técnico | técnico / CLT / afastado |
| `isabela@nurseflow.test` | técnico | técnico / concursado / ativo |

A senha de `admin@nurseflow.test` é o valor de `DEMO_ADMIN_PASSWORD`; todos os profissionais usam `DEMO_PRO_PASSWORD`. O campo de perfil no login da UI deve corresponder ao tipo do usuário (coordenação, enfermeiro ou técnico). CPFs de teste são gerados com dígitos verificadores válidos, exclusivamente fictícios; os COREN demonstrativos têm formato `CE-10001` ... `CE-10009` (não correspondem a registros reais).

### Setores (quantitativos mínimos)

| Setor | Diurno (enfermeiros/técnicos) | Noturno (enfermeiros/técnicos) |
|---|---|---|
| UTI | 2/3 | 2/2 |
| Emergência | 2/3 | 1/2 |
| Clínica Médica | 1/2 | 1/1 |

### Configurações que a coordenação pode gerenciar

O seed cria documentos para **outubro e novembro de 2026** (`2026-10` e `2026-11`). Em cada mês: `limiteTrocas=3`, `maxExtras=2`, `limitePlantoes=12`. As cargas para o mês são:

| Vínculo | Plantões 24h | Plantões 12h |
|---|---:|---:|
| Concursado | 6 | 1 |
| CLT | 5 | 2 |
| RPA | 3 | 2 |

Os parâmetros de carga são armazenados com chave `<vínculo>_<diasDoMês>` (`concursado_31` em outubro e `concursado_30` em novembro). Os endpoints `/configuracoes` e `/setores` são restritos a `coordenacao` no backend. Este seed não cria escalas nem calcula automaticamente plantões.

### Restrições de demonstração (outubro de 2026)

| Profissional | Tipo | Período | Observação |
|---|---|---|---|
| Ana | Indisponível | 14/10 | dia inteiro |
| Bruno | Vínculo externo | 01/10 a 31/10 | terças-feiras (`diaSemana=2`) |
| Carla | Disponível | 16/10 | dia inteiro |
| Daniela | Ausência | 19/10 a 21/10 | ausência declarada |
| Eduardo | Indisponível | 23/10 | compromisso pessoal |
| Fernanda | Vínculo externo | 01/10 a 31/10 | sextas-feiras (`diaSemana=5`) |
| Gabriela | Férias | 12/10 a 26/10 | profissional também está no status `ferias` |
| Henrique | Ausência | 12/10 a 31/10 | profissional também está no status `afastado` |
| Isabela | Disponível | 18/10 | dia inteiro |

As datas são persistidas em UTC, como indicado no script. A restrição recorrente contém dia da semana mas **não** um horário específico. Não há escala gerada automaticamente, nem aprovação de trocas no projeto atual.

### Verificação rápida de autorização

1. Entre com `admin@nurseflow.test` e `DEMO_ADMIN_PASSWORD`, selecione perfil Coordenação.
2. Consulte `/configuracoes?ano=2026&mes=10` (token Bearer) e verifique `limiteTrocas=3`. Consulte `/setores` para ver os três setores.
3. Entre como `ana@nurseflow.test`, selecione Enfermeiro, e tente `PATCH /configuracoes/limites?ano=2026&mes=10`: o esperado é **403 Forbidden**, pois a operação exige `coordenacao`.
4. Consulte restrições na interface com a conta de coordenação. Os profissionais de férias e afastamento servem para conferir status e filtros.

**Nota:** os registros são demonstrativos; não foram utilizados dados pessoais reais. Não habilite o seed em instâncias públicas.