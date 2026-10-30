# NurseFlow — execução integrada

Aplicação com **React 19 / Vite**, **NestJS**, **MongoDB 8**, **FastAPI/OR-Tools** e **Nginx**. O Compose da raiz sobe MongoDB, otimizador, API e frontend; `seed-demo` é uma tarefa de inicialização executada antes do frontend. O frontend utiliza `/api` como URL de API; o Nginx faz proxy para `http://backend:3000` dentro da rede Docker.

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
| Escalas | Geração automática e manual, calendário/revisão, edição, validação, publicação versionada, notificações e PDF/ZIP — veja [Gestão de escalas](#gestão-de-escalas) |

As rotas, DTOs e respostas completos estão disponíveis no Swagger em `http://localhost:3000/docs`.

## Tecnologias utilizadas

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Vitest |
| Backend | NestJS 12, TypeScript, Mongoose, JWT (`@nestjs/jwt`), bcryptjs, class-validator, Swagger/OpenAPI, Jest + Supertest |
| Banco de dados | MongoDB 8, com esquema e índices versionados por migrations (`migrate-mongo`) |
| Otimização | Python 3.12, FastAPI e Google OR-Tools (CP-SAT) — serviço `optimizer/`, consumido apenas pela API NestJS |
| Infraestrutura | Docker / Docker Compose, Nginx (serve o frontend e faz proxy de `/api` no modo Docker) |

## Estrutura do repositório

```text
NurseFlow/
├── back-end/            API NestJS (src/, migrations/, scripts/, test/)
├── front-end/           Aplicação React/Vite
├── optimizer/           Serviço Python (FastAPI + OR-Tools) que resolve a escala mensal
├── db/                  docker-compose.yml da infraestrutura local (MongoDB e otimizador) e script de inicialização
├── scripts/setup.mjs    Instala dependências e prepara o .env do back-end
├── docs/                Documentos de requisitos, arquitetura e diagramas
├── docker-compose.yml   Stack completa (mongo + backend + frontend + seed-demo)
├── .env.example         Variáveis do Docker Compose (stack completa)
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

**1. Instale as dependências** (raiz, `back-end` e `front-end`; também cria `back-end/.env` a partir do modelo, se ainda não existir):

```bash
npm run setup
```

**2. Configure o `.env` do backend** (se o passo anterior não o criou: `cp back-end/.env.example back-end/.env`). Edite `back-end/.env`:

- `MONGODB_URI`: o modelo aponta para `mongodb://localhost:27017/nurseflow?replicaSet=rs0` (MongoDB de `db/docker-compose.yml`, sem autenticação, publicado apenas em `127.0.0.1`). O host `mongo` só vale dentro do Docker Compose da raiz.
- `JWT_SECRET`: chave aleatória com 16 caracteres ou mais, por exemplo `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
- `SEED_COORDENACAO_NOME`, `_EMAIL`, `_CPF` (CPF válido) e `_SENHA` (de 8 a 72 caracteres): dados da primeira conta de Coordenação.
- (Opcional) dados de demonstração: `DEMO_SEED_ENABLED=true`, `DEMO_ADMIN_PASSWORD` e `DEMO_PRO_PASSWORD` (de 8 a 72 caracteres). Veja [Dados de demonstração](#dados-de-demonstração-docker).

As demais variáveis (`CORS_ORIGINS`, `JWT_EXPIRES_IN_SECONDS`, `LOGIN_MAX_ATTEMPTS`, ...) estão documentadas em [back-end/README.md](back-end/README.md). Os `.env` reais **não** são versionados (apenas os `.env.example`).

O frontend **não precisa** de `.env` no desenvolvimento local: o Vite faz proxy de `/api` para `http://localhost:3000`.

**3. Inicie o MongoDB, aplique as migrations e popule o banco:**

```bash
npm run db:up      # sobe o MongoDB 8 e o otimizador de escalas e aguarda os healthchecks (parar: npm run db:down)
npm run db:setup   # migrations + seed da Coordenação + seed de demonstração
```

`db:setup` equivale a `db:migrate` (validators e índices; a API **não** os cria sozinha) seguido de `db:seed` (`seed:coordenacao` e `seed:demo`). O MongoDB local sobe como replica set `rs0`, necessário às transações do ciclo de vida das escalas. Em ambientes externos, configure `MONGODB_URI` para um replica set. `npm run dev` também aplica migrations pendentes antes de iniciar front-end e API. Se a API já estiver rodando com erro de validação do Mongo, execute `npm run db:migrate` e reinicie-a. Também podem ser executados separadamente:

```bash
npm --prefix back-end run migrate:up
npm --prefix back-end run migrate:status   # opcional: lista o que foi aplicado
npm --prefix back-end run seed:coordenacao # cria a Coordenação (não faz nada se já existir)
npm --prefix back-end run seed:demo        # dados fictícios (somente com DEMO_SEED_ENABLED=true)
```

Os seeds são **idempotentes**: só criam o que não existe, nunca sobrescrevem nem apagam registros e não redefinem senhas. Pode executá-los de novo com segurança.


## Execução (desenvolvimento local)

Com o `.env` configurado, o MongoDB no ar, as migrations aplicadas e o seed executado, na raiz:

```bash
npm run dev
```

O comando sobe o MongoDB (`npm run db:up`) e inicia, em paralelo, o backend (`nest start --watch`) e o frontend (Vite, porta 5173 fixa).

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/docs |

No login, escolha o perfil correspondente à conta (Coordenação, Enfermeiro ou Técnico) e entre com o e-mail e a senha definidos em `SEED_COORDENACAO_*` (ou com as contas de demonstração). No Swagger, use *Authorize* com o `accessToken` retornado por `POST /auth/login`.

Para iniciar apenas uma das partes: `npm run dev:back` ou `npm run dev:front`.

# Execução com Docker (stack completa)

As seções abaixo descrevem a stack completa em containers (MongoDB + backend + frontend com Nginx), na porta 8080 do frontend.

## 1. Configurar o ambiente

Na **raiz do repositório**:

```bash
cp .env.example .env
```

Troque `MONGO_ROOT_PASSWORD`, `JWT_SECRET` e `SEED_COORDENACAO_SENHA` por valores aleatórios (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`). A `MONGODB_URI` deve repetir `MONGO_ROOT_USERNAME`/`MONGO_ROOT_PASSWORD` e usar o hostname `mongo` (não `localhost`). Para popular dados fictícios, defina também `DEMO_SEED_ENABLED=true`, `DEMO_ADMIN_PASSWORD` e `DEMO_PRO_PASSWORD`. Se a senha contiver caracteres especiais, codifique-os na URI. O `.env` real **não** deve ser versionado.

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

O comando de inicialização do backend roda as migrations antes da API, e o serviço `seed-demo` popula os dados fictícios quando `DEMO_SEED_ENABLED=true`. Para cadastrar a coordenação após iniciar os serviços, defina as variáveis `SEED_COORDENACAO_*` no `.env` e execute:

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
| Escalas | Fluxo integrado de geração/montagem, revisão, edição, validação, publicação, notificações e exportação PDF/ZIP via `/escalas/*` e `/notificacoes/escalas/*` |

**Limitações intencionais**:

- O backend ainda não implementa aprovação de trocas, geração automática de coberturas ou categorias de notificação fora do ciclo de vida de escalas. A tela de configurações exibe somente as opções persistidas de verdade.
- O schema de restrições persiste períodos e, opcionalmente, **um dia da semana por registro**, mas não turno/horário; o frontend rejeita criação de preferências de turno e vínculo externo com turno definido em vez de fingir persistência. Múltiplos dias selecionados criam múltiplos registros; falha em uma das requisições pode deixar um subconjunto cadastrado, pois não existe endpoint transacional em lote.
- O backend só expõe criação, consulta e exclusão de restrições, portanto a UI oferece **exclusão e novo cadastro** no lugar de edição.
- Restrições marcadas como recorrentes sem data utilizam, temporariamente, um período de cinco anos; não há recorrência infinita no modelo atual.
- O endpoint de restrições está protegido para perfil coordenação no backend. Usuários sem esse perfil podem receber 403 nesta tela até a autorização ser definida.

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

## Gestão de escalas

Implementa o ciclo de vida de escalas pela API NestJS e pela tela Escala. A geração automática atende RF005/US07 (regras RN003–RN009); a Coordenação também pode montar e editar rascunhos, revisar e validar cobertura, publicar versões oficiais e exportá-las.

### Arquitetura

```text
Coordenação ──POST /escalas/gerar──▶ NestJS (módulo escalas)
                                       │ 1. valida e lê do MongoDB: configuração vigente do mês,
                                       │    setores ativos, profissionais, restrições, escala do mês anterior
                                       │ 2. monta o problema (montar-problema.ts)
                                       ▼
                               optimizer/ (FastAPI + OR-Tools CP-SAT)   ← só matemática, sem acesso ao banco
                                       │ 3. devolve alocações, vagas descobertas e estatísticas
                                       ▼
                    NestJS grava escala (rascunho) + plantões + profissionaisRelacionados
```

- **NestJS** (`back-end/src/escalas`): controller, service, schemas, `montar-problema.ts` (função pura, testada) e a porta `OtimizadorEscala` (implementação HTTP; substituível em testes).
- **Python** (`optimizer/`): `POST /otimizar` e `GET /saude`. Sobe junto de `npm run db:up` (porta 8000 em `127.0.0.1`) e na stack Docker (rede interna, serviço `optimizer`).
- **Persistência:** `escalas`, `plantoes` e `profissionaisRelacionados` guardam a versão de trabalho; `versoesEscala` guarda snapshots oficiais imutáveis; `auditoriaEscalas` e `notificacoesEscala` registram eventos. A migration `20261014000007` adiciona o estado/revisão e os índices únicos de período, versão e notificação.

### Regras aplicadas

| Regra | Como é tratada |
| --- | --- |
| Regime 24x72 | Plantão de 24h (07:00→07:00) exige 72h de descanso; plantão de 12h exige 36h. O descanso é herdado da escala do mês anterior, se existir. Exceção prevista na US25: 12h diurno + 12h noturno no mesmo dia |
| RN003/RN005 | Nenhum plantão **inicia** em dia de indisponibilidade, férias, ausência ou vínculo externo (inclui recorrência por dia da semana). "Disponível" com dia da semana define dias fixos de trabalho no período; "disponível" sem dia da semana é só informativo. Datas em UTC |
| RN006/DA08 | Quantitativo mínimo de enfermeiros e técnicos por setor, dia e turno. Plantão de 24h cobre diurno e noturno; cada função é coberta só por profissionais da respectiva formação |
| RN007/US29 | Carga regular por vínculo vem de `cargas` da configuração do mês (`<vínculo>_<diasDoMês>`), nunca fixa no algoritmo |
| RN009 | O que excede a carga regular é **extra**, limitado por `maxExtrasConcursado`/`maxExtrasClt` (se > 0) ou por `maxExtras`. RPA sem carga configurada atua somente como extra |
| `limitePlantoes` | Se > 0, teto de plantões totais por profissional no mês |
| Vagas sem cobertura | Nunca violam restrição obrigatória: voltam em `pendencias` |
| Quem participa | Apenas profissionais `ativo`; `ferias`/`afastado` aparecem em `conflitos`; `desativado` é ignorado |

Prioridade do objetivo: menos vagas descobertas > menos extras > carga regular completa > menos sobra de cobertura > extras distribuídos de forma equilibrada. O solver tem limite de tempo (`OPTIMIZER_TIME_LIMIT_SECONDS`, padrão 30 s); se o limite estourar, devolve a melhor solução viável e `resumo.solver.otimo = false`.

**Configurações vigentes:** são lidas do banco a cada geração. Um retrato delas fica em `geracao.configuracao` da escala (`configuracaoUtilizada` na resposta); alterar as configurações depois **não** muda escalas existentes, só as próximas gerações.

### Endpoint

`POST /escalas/gerar` (somente Coordenação) — corpo `{ "mes": 11, "ano": 2026, "substituirRascunho": false }`

| Código | Situação |
| --- | --- |
| 201 | Escala gerada como `rascunho` |
| 400 | Mês/ano inválidos |
| 409 | Já existe escala do período (publicada/finalizada: nunca substituída; rascunho: envie `substituirRascunho: true` para regerar, o conteúdo antigo é trocado sem duplicar) |
| 422 | Dados insuficientes (sem setores ativos, sem profissionais ativos, sem quantitativo, ou carga de concursado/CLT não configurada para o mês) — lista em `erros` |
| 502/503 | Otimizador indisponível ou com falha (nada é gravado) |

Resposta: `escala`, `resumo`, `configuracaoUtilizada`, `plantoes` (com profissionais), `pendencias` (vagas descobertas), `conflitos`, `avisos` e `cargas` (esperada × atribuída por profissional). `GET /escalas/:id` devolve a mesma estrutura.

### Como testar

```bash
npm run db:up                              # MongoDB + otimizador (http://localhost:8000/docs)
npm --prefix back-end run migrate:up       # inclui a migration das coleções de escala
npm run db:seed                            # coordenação + dados de demonstração (opcional)
npm run dev:back                           # API em http://localhost:3000

TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@nurseflow.test","senha":"<DEMO_ADMIN_PASSWORD>","perfil":"coordenacao"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).accessToken')

curl -s -X POST localhost:3000/escalas/gerar -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"mes":11,"ano":2026}'
```

Também é possível usar o Swagger (http://localhost:3000/docs → **Escalas**). Para gerar um mês é preciso ter a carga configurada (o seed de demonstração cria `2026-10` e `2026-11`; ou `PUT /configuracoes/cargas`).

Testes: unitários (`montar-problema.spec.ts`) e e2e (`back-end/test/escalas.e2e-spec.ts`) rodam em `npm test`; os testes das restrições do modelo ficam em `optimizer/tests` — veja [optimizer/README.md](optimizer/README.md).

### Revisão, validação, publicação e exportação

Todas as rotas abaixo são autenticadas; operações de gestão e exportação são exclusivas da Coordenação. O campo `revisaoEsperada` protege contra atualização concorrente; revisão desatualizada ou transição inválida retorna 409. A API documenta os DTOs e respostas detalhados no Swagger, tag **Escalas**.

| Método e rota | Finalidade |
|---|---|
| `GET /escalas?ano=<ano>&mes=<mês>` | Lista escala do período |
| `POST /escalas` | Cria rascunho manual |
| `POST /escalas/:id/plantoes` / `PATCH /escalas/:id/plantoes/:plantaoId` | Inclui/edita plantão e equipe, com revisão esperada |
| `POST /escalas/:id/revisao` | Inicia revisão; em escala publicada copia a última versão oficial |
| `POST /escalas/:id/validar` | Revalida regras e cobertura antes de publicar |
| `POST /escalas/:id/publicar` | Publica versão imutável; corpo inclui `revisaoEsperada` e `confirmarPendencias` |
| `GET /escalas/:id/versao-oficial` / `GET /escalas/:id/auditoria` | Consulta versão oficial e histórico (Coordenação) |
| `DELETE /escalas/:id` | Remove somente rascunho com `confirmar: true` e `revisaoEsperada` |
| `GET /escalas/:id/pdf` | Baixa PDF geral; use `?setorId=<id>` para um setor ou `?separarPorSetor=true` para ZIP |
| `GET /notificacoes/escalas` | Lista as notificações do usuário e a contagem não lida |
| `PATCH /notificacoes/escalas/:id/lida` | Marca notificação própria como lida |
| `GET /notificacoes/escalas/:escalaId/versoes/:numero` | Abre a versão oficial associada à notificação do usuário |

O Compose local (`db/docker-compose.yml`) e o Compose integrado (`docker-compose.yml`) inicializam `rs0`; transações exigem replica set também em ambientes de produção. A exportação PDF/ZIP só aceita versões oficiais publicadas; `setorId` e `separarPorSetor=true` não podem ser usados juntos. Pendências aceitas permanecem visíveis no snapshot e no documento.

## Testes automatizados

Os testes do backend e do frontend rodam com um único comando, na raiz do projeto:

```bash
npm test
```

Pré-requisito: dependências instaladas em `back-end/` e `front-end/` (`npm install` em cada uma; veja `npm run setup`). **Não** é necessário Docker nem MongoDB: os testes de integração usam `mongodb-memory-server` (o binário do MongoDB é baixado na primeira execução, o que exige internet).

`npm test` executa, em sequência (para no primeiro que falhar):

| Script | O que roda | Cobertura |
|---|---|---|
| `npm run test:back` | Jest, testes unitários do backend | Guard de perfis, validação de CPF e regras de montagem/validação de plantões |
| `npm run test:e2e` | Jest + Supertest + MongoDB em memória (`back-end/test`) | Login/autenticação, Profissionais, Setores, autorização por perfil, Configurações, Restrições/Disponibilidade, ciclo de vida de escalas e migrations |
| `npm run test:front` | Vitest (testes em `front-end/src/`) | Serviços e telas do frontend: auth, profissionais, setores, configurações, restrições, calendário, revisão/publicação de escalas, equipe semanal e notificações |
| `pytest` em `optimizer/` | Restrições do modelo CP-SAT (24x72, bloqueios, quantitativo, vagas descobertas, carga/extras) | Não faz parte do `npm test`; veja [optimizer/README.md](optimizer/README.md) |

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

> Em desenvolvimento local (sem Docker para a aplicação), os mesmos dados são criados por `npm run db:seed` com `DEMO_SEED_ENABLED=true` no `back-end/.env`.

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

**Ordem:** `mongo` saudável → `optimizer` saudável → `backend` (migrations e API, saudável) → `seed-demo` (execução única) → `frontend`. O serviço de seed deve terminar com `Exited (0)`; **não** fica em execução permanentemente. Para executá-lo novamente em um banco já iniciado: `docker compose run --rm seed-demo`. O seed é idempotente: insere registros ausentes e não sobrescreve dados existentes, redefine senhas ou apaga escalas. Cria uma coordenação, nove profissionais, três setores, configurações mensais para 2026 e nove restrições de demonstração. Para renovar credenciais de uma conta já existente, utilize a recuperação de senha ou um banco de testes descartável. Para **apagar todos os dados** (destrutivo): `docker compose down -v`.

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
| `joao@nurseflow.test` | enfermeiro | enfermeiro / concursado / ativo |
| `karina@nurseflow.test` | enfermeiro | enfermeiro / CLT / ativo |
| `leonardo@nurseflow.test` | enfermeiro | enfermeiro / RPA / ativo |
| `mariana@nurseflow.test` | enfermeiro | enfermeiro / CLT / férias |
| `nicolas@nurseflow.test` | enfermeiro | enfermeiro / concursado / afastado |
| `olivia@nurseflow.test` | enfermeiro | enfermeiro / RPA / afastado |
| `paulo@nurseflow.test` | enfermeiro | enfermeiro / CLT / ativo |
| `quiteria@nurseflow.test` | enfermeiro | enfermeiro / concursado / desativado |
| `rafael@nurseflow.test` | enfermeiro | enfermeiro / concursado / ativo |
| `sandra@nurseflow.test` | técnico | técnico / concursado / ativo |
| `tiago@nurseflow.test` | técnico | técnico / CLT / ativo |
| `ursula@nurseflow.test` | técnico | técnico / RPA / ativo |
| `valter@nurseflow.test` | técnico | técnico / CLT / férias |
| `wanessa@nurseflow.test` | técnico | técnico / RPA / ativo |
| `xavier@nurseflow.test` | técnico | técnico / concursado / ativo |
| `yara@nurseflow.test` | técnico | técnico / CLT / ativo |
| `zenilda@nurseflow.test` | técnico | técnico / RPA / desativado |
| `otavio@nurseflow.test` | técnico | técnico / CLT / ativo |

A senha de `admin@nurseflow.test` é o valor de `DEMO_ADMIN_PASSWORD`; todos os profissionais usam `DEMO_PRO_PASSWORD`. O campo de perfil no login da UI deve corresponder ao tipo do usuário (coordenação, enfermeiro ou técnico). CPFs de teste são gerados com dígitos verificadores válidos, exclusivamente fictícios; os COREN demonstrativos têm formato `CE-10001` ... `CE-10027` (não correspondem a registros reais).
### Setores (quantitativos mínimos)

| Setor | Diurno (enfermeiros/técnicos) | Noturno (enfermeiros/técnicos) |
|---|---|---|
| UTI | 2/3 | 2/2 |
| Emergência | 2/3 | 1/2 |
| Clínica Médica | 1/2 | 1/1 |

### Configurações que a coordenação pode gerenciar

O seed cria configurações para todos os meses de **2026**. Cada mês tem `limiteTrocas=3`, `maxExtras=2`, `limitePlantoes=12`, `maxExtrasConcursado=1` e `maxExtrasClt=1`. As cargas são registradas conforme a quantidade de dias do mês:

| Vínculo | Plantões 24h | Plantões 12h |
|---|---:|---:|
| Concursado | 6 | 1 |
| CLT | 5 | 2 |
| RPA | 3 | 2 |

Os parâmetros são armazenados com chave `<vínculo>_<diasDoMês>` (por exemplo, `concursado_31` ou `clt_30`). O seed não cria escalas automaticamente. Como inclui nove profissionais, dos quais dois estão em férias/afastamento, a geração pode apresentar vagas descobertas; não há garantia de cobertura completa ou de uma escala sem conflitos.

### Gerar uma escala demonstrativa

1. Entre na interface como `admin@nurseflow.test` e selecione perfil Coordenação.
2. Gere um mês de **2026**, selecionando os setores e turnos desejados.
3. Revise as vagas descobertas e os conflitos retornados. A escala do mês anterior influencia o descanso herdado; o seed não cria nem remove escalas. Se o período já tiver escala, escolha outro mês ou use um banco local de demonstração.

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
| Mariana | Férias | 05/10 a 19/10 | profissional também está no status `ferias` |
| Valter | Férias | 19/10 a 02/11 | profissional também está no status `ferias` |
| Nicolas | Ausência | 01/10 a 31/10 | profissional também está no status `afastado` |
| Olívia | Ausência | 15/10 a 15/11 | profissional também está no status `afastado` |
| João | Indisponível | 09/10 | compromisso pessoal |
| Tiago | Vínculo externo | 01/10 a 31/10 | quartas-feiras (`diaSemana=3`) |
| Yara | Indisponível | 28/10 | dia inteiro |

As datas são persistidas em UTC, como indicado no script. A restrição recorrente contém dia da semana mas **não** um horário específico. Não há escala gerada automaticamente, nem aprovação de trocas no projeto atual.
### Exportação de profissionais (Excel)

Em **Profissionais**, o botão **Exportar Excel** (ao lado de *Filtros*) baixa `nurseflow-profissionais-AAAA-MM-DD.xlsx` com a aba `Profissionais`. A planilha contém exatamente o que está na tela: aplica a busca, os filtros (formação, vínculo e situação: ativo, desativado, afastado ou férias) e a ordenação selecionados. Sem filtros, exporta todos. A planilha é gerada no navegador a partir dos dados já carregados pela API (acesso restrito à Coordenação) e não inclui dados de autenticação.

### Verificação rápida de autorização

1. Entre com `admin@nurseflow.test` e `DEMO_ADMIN_PASSWORD`, selecione perfil Coordenação.
2. Consulte `/configuracoes?ano=2026&mes=10` (token Bearer) e verifique `limiteTrocas=3`. Consulte `/setores` para ver os três setores.
3. Entre como `ana@nurseflow.test`, selecione Enfermeiro, e tente `PATCH /configuracoes/limites?ano=2026&mes=10`: o esperado é **403 Forbidden**, pois a operação exige `coordenacao`.
4. Verifique a autorização tentando consultar `GET /escalas?ano=2026&mes=10` com token de enfermeiro ou técnico; a resposta esperada é **403 Forbidden**.

**Nota:** os registros são demonstrativos; não foram utilizados dados pessoais reais. Não habilite o seed em instâncias públicas.
