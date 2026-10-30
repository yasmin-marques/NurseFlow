# NurseFlow — Back-end

API REST em **NestJS 12 + MongoDB (Mongoose)** com módulos de **Autenticação/controle de acesso**, **Profissionais**, **Setores hospitalares**, **Configurações**, **Restrições** e o ciclo de vida de **Escalas** (geração, edição, validação, publicação, notificações e exportação).

## Requisitos

- Node.js ≥ 24 (o Nest 12 é distribuído como ESM; o projeto compila para CommonJS e roda no Node 24 via `require(esm)`)
- npm ≥ 10
- MongoDB 8 como replica set — suba com o Docker do projeto: `docker compose -f ../db/docker-compose.yml up -d`

As operações de escala que atualizam múltiplas coleções usam transações MongoDB. O Compose local e o Compose da raiz inicializam o replica set de nó único `rs0`; não execute a API contra um MongoDB standalone. Em outros ambientes, configure `MONGODB_URI` para um replica set.

## Instalação e configuração

```bash
cd back-end
npm install
cp .env.example .env     # ajuste JWT_SECRET e as credenciais do seed
```

Variáveis (veja `.env.example`):

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `CORS_ORIGINS` | Origens permitidas (vírgula) | `http://localhost:5173` |
| `MONGODB_URI` | URI do Mongo, incluindo o banco e apontando para o replica set `rs0` (local: `mongodb://localhost:27017/nurseflow?replicaSet=rs0`) | — (obrigatória) |
| `JWT_SECRET` | Segredo do JWT (≥ 16 caracteres) | — (obrigatória) |
| `JWT_EXPIRES_IN_SECONDS` | Validade do token | `28800` (8 h) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | Bloqueio temporário após tentativas inválidas | `5` / `15` |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token de recuperação de senha | `30` |
| `SEED_COORDENACAO_*` | Dados da primeira conta de Coordenação | — |
| `DEMO_SEED_ENABLED` | Habilita a criação de dados fictícios de demonstração | `false` |
| `DEMO_ADMIN_PASSWORD` / `DEMO_PRO_PASSWORD` | Senhas das contas fictícias (8–72 caracteres; obrigatórias com seed habilitado) | — |

## Migrations

O esquema do Mongo (validators `$jsonSchema` e índices) é versionado com [migrate-mongo](https://github.com/seppevs/migrate-mongo) em `migrations/`. A API **não** cria índices automaticamente.

```bash
npm run migrate:up       # aplica as migrations pendentes
npm run migrate:status   # lista o que já foi aplicado
npm run migrate:down     # desfaz a última
```

As migrations são idempotentes e funcionam tanto em um banco criado por `db/mongo/script.js` quanto em um banco novo/vazio.

| Migration | Alteração |
|---|---|
| `20261011000001-usuarios-autenticacao` | `telefone` deixa de ser obrigatório; novos campos de login (`tentativasFalhasLogin`, `bloqueadoAte`, `ultimoLoginEm`, `redefinicaoSenha`, `senhaTemporaria`); timestamps |
| `20261011000002-profissionais-status` | status `desligado` → `desativado` (DA04 / diagrama de classes); `desativadoEm`; timestamps |
| `20261011000003-setores-quantitativo-por-turno` | `quantMinEnf`/`quantMinTec` → `turnos.{diurno,noturno}.{enfermeiros,tecnicos}` (dados existentes copiados para os dois turnos); `ativo`; índice único de `nome` sem diferenciar maiúsculas/acentos |
| `20261012000004-configuracoes-restricoes` | Validators e índices de configurações e restrições |
| `20261012000005-reconciliar-validacao-restricoes` | Reaplica o contrato atual de validação de restrições em bancos existentes |
| `20261013000006-escalas-plantoes` | Validators e índices das escalas, plantões e profissionais relacionados |
| `20261014000007-ciclo-vida-escalas` | Estados e revisões de escala, snapshots oficiais, auditoria, notificações e índices únicos para período, versões e eventos por destinatário |

### Primeira conta de Coordenação

Não existe cadastro público: a primeira conta é criada pelo seed (usa `SEED_COORDENACAO_*` do `.env`; não faz nada se o usuário já existir).

```bash
npm run migrate:up
npm run seed:coordenacao
```

### Dados de demonstração

Para criar dados fictícios em desenvolvimento, configure `DEMO_SEED_ENABLED=true`, `DEMO_ADMIN_PASSWORD` e `DEMO_PRO_PASSWORD` no `.env` e execute:

```bash
npm run seed:demo
```

O seed cria, quando ausentes, uma conta de Coordenação, nove profissionais, três setores, configurações para os meses de 2026 e restrições de exemplo. É idempotente e não sobrescreve registros existentes. Use somente em ambiente local isolado; o script recusa execução em produção sem autorização explícita. Os logins são `admin@nurseflow.test` e `<nome>@nurseflow.test`.

## Execução

```bash
npm run start:dev        # desenvolvimento (watch)
npm run build            # compila para dist/
npm run start:prod       # executa dist/main
```

Swagger/OpenAPI: **http://localhost:3000/docs** (use *Authorize* com o `accessToken` retornado por `POST /auth/login`).

## Testes e lint

```bash
npm run lint:check
npm test                 # unitários (CPF, guard de perfis e regras de escala)
npm run test:e2e         # e2e com MongoDB em memória: migrations, módulos da API e ciclo de vida de escalas
```

Os testes e2e baixam o binário do `mongod` na primeira execução (mongodb-memory-server) e não dependem do Docker. O Jest roda com `--experimental-vm-modules` (já configurado nos scripts) porque os pacotes `@nestjs/*` são ESM.

## Endpoints

Erros seguem um formato único: `{ statusCode, error, message, details?, path, timestamp }` (`details` lista os problemas de validação por campo).

### `/auth`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | `{ email, senha, perfil? }` → `{ accessToken, tokenType, expiresIn, usuario }`. `perfil` aceita `coordenacao`, `enfermeiro`, `tecnico` (também com acento, como o front envia). 401 genérico para credencial/perfil inválido; 403 se o profissional está desativado; 429 durante o bloqueio temporário |
| GET | `/auth/me` | autenticado | Dados da sessão |
| POST | `/auth/recuperar-senha` | público | `{ email }` → 202 sempre (não revela se o e-mail existe) |
| POST | `/auth/redefinir-senha` | público | `{ token, novaSenha }` (token de uso único) |

### `/profissionais` — somente **Coordenação**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/profissionais` | Cadastro (DA02). 409 se CPF/COREN já cadastrados ou e-mail em uso |
| GET | `/profissionais` | Lista/busca (DA03). Query: `busca` (nome, CPF ou COREN), `formacao`, `status`, `tipoVinculo`, `ordem` (`asc`\|`desc` por nome), `page`, `limit` → `{ data, meta }` |
| GET | `/profissionais/:id` | Consulta |
| PATCH | `/profissionais/:id` | Edição parcial (DA03) |
| PATCH | `/profissionais/:id/desativar` | Desativação lógica (DA04). Nunca há DELETE físico |

Campos: `nome`, `cpf` (com ou sem máscara; armazenado só com dígitos, devolvido como `000.000.000-00`), `email`, `coren` (normalizado em maiúsculas), `formacao` (`enfermeiro`\|`tecnico`), `tipoVinculo` (`concursado`\|`clt`\|`rpa`), `status` (`ativo`\|`desativado`\|`afastado`\|`ferias`), `senha` (opcional no cadastro).

Se `senha` for omitida, o sistema gera uma senha aleatória descartável (`senhaTemporaria: true`) e o profissional define a sua via `recuperar-senha` / `redefinir-senha`.

### `/setores`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/setores` | Coordenação | Cadastro com quantitativo por turno (DA07). 409 para nome duplicado |
| GET | `/setores`, `/setores/:id` | qualquer perfil autenticado | Query da lista: `busca`, `ativo` |
| PATCH | `/setores/:id` | Coordenação | Edita nome/descrição e/ou apenas um turno/função (DA08) |
| PATCH | `/setores/:id/inativar`, `/setores/:id/ativar` | Coordenação | Inativação lógica |

```json
{ "nome": "Emergência", "descricao": "…",
  "turnos": { "diurno": { "enfermeiros": 2, "tecnicos": 3 }, "noturno": { "enfermeiros": 2, "tecnicos": 3 } } }
```

O chefe do plantão é contabilizado entre os enfermeiros (DA08).

### `/escalas` — somente **Coordenação**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/escalas?ano=&mes=` | Consulta a escala do período; retorna lista vazia quando não existe |
| POST | `/escalas` | Cria rascunho para montagem manual |
| POST | `/escalas/gerar` | Gera a escala mensal automaticamente; aceita setores, turnos e identificador da operação |
| DELETE | `/escalas/gerar/:operacaoId` | Solicita cancelamento da geração ativa |
| GET | `/escalas/:id` | Consulta escala, plantões, cobertura, pendências, conflitos, avisos e cargas |
| POST | `/escalas/:id/plantoes` | Inclui plantão e equipe no rascunho; exige `revisaoEsperada` |
| PATCH | `/escalas/:id/plantoes/:plantaoId` | Edita plantão e equipe; exige `revisaoEsperada` |
| POST | `/escalas/:id/revisao` | Inicia revisão de um rascunho ou da última versão publicada |
| POST | `/escalas/:id/validar` | Valida cobertura e conflitos antes da publicação |
| POST | `/escalas/:id/publicar` | Publica a escala validada; corpo: `{ "revisaoEsperada": 3, "confirmarPendencias": true }` |
| GET | `/escalas/:id/versao-oficial` | Consulta o snapshot oficial mais recente (Coordenação) |
| GET | `/escalas/:id/auditoria` | Consulta o histórico de transições e alterações |
| GET | `/escalas/:id/pdf` | Exporta PDF geral; `?setorId=<id>` exporta um setor e `?separarPorSetor=true` retorna ZIP |
| DELETE | `/escalas/:id` | Remove somente rascunho; corpo exige `{ "confirmar": true, "revisaoEsperada": 3 }` |

Estados do fluxo: `rascunho` → `em_revisao` → `validada` → `publicada` → `finalizada`. Alterações incrementam a revisão e invalidam uma validação anterior. Revisões desatualizadas e estados incompatíveis retornam 409; conflitos obrigatórios retornam 422. Pendências e alertas exigem confirmação explícita para publicar e permanecem no snapshot oficial e no PDF.

### `/notificacoes/escalas` — usuário autenticado

| Método | Rota | Descrição |
|---|---|---|
| GET | `/notificacoes/escalas` | Lista até 100 notificações próprias recentes e a contagem não lida |
| PATCH | `/notificacoes/escalas/:id/lida` | Marca notificação própria como lida; operação idempotente |
| GET | `/notificacoes/escalas/:escalaId/versoes/:numero` | Consulta o snapshot oficial associado à notificação do usuário |

As notificações são geradas na publicação e em versões posteriores que alterem plantões do destinatário. A publicação grava versão, auditoria e notificações na mesma transação; chaves únicas impedem duplicação por destinatário. Consulte **http://localhost:3000/docs** para os schemas e respostas OpenAPI completos. PDF e ZIP estão disponíveis somente para Coordenação.

## Autorização

JWT Bearer. `JwtAuthGuard` e `RolesGuard` são globais: toda rota exige token, exceto as marcadas com `@Public()`; `@Perfis(...)` restringe por perfil. O perfil é derivado da conta: administrador = **Coordenação**; profissional = **Enfermeiro** ou **Técnico** conforme a `formacao`. A cada requisição o token é revalidado contra o banco, então um profissional desativado perde a sessão imediatamente.

| Perfil | Profissionais | Setores (leitura) | Setores (escrita) | Escalas | Notificações |
|---|---|---|---|---|---|
| Coordenação | CRUD lógico | ✔ | ✔ | Gestão, publicação e PDF | Próprias |
| Enfermeiro / Técnico | ✘ (403) | ✔ | ✘ (403) | Versões vinculadas a notificações | Próprias |

## Estrutura

```
src/
  auth/           login, JWT, bloqueio por tentativas, recuperação de senha
  usuarios/       identidade: schemas usuarios, administradores e UsuariosService
  profissionais/  cadastro/consulta/edição/desativação (+ porta PlantoesFuturosChecker)
  escalas/        geração, edição, revisão, validação, publicação, notificações e PDF
  setores/        cadastro/consulta/edição/inativação com quantitativo por turno
  common/         enums, decorators (@Public, @Perfis), guards, filtro global de erros, utilitários
  config/         leitura e validação do ambiente
migrations/       migrate-mongo
scripts/          seeds da Coordenação e de demonstração
test/             e2e (API completa e migrations)
```

## Integração com o front-end

O front-end consome a API autenticada para cadastro e ciclo de vida das escalas. A tela Escala oferece calendário mensal/semanal, revisão, edição, validação, publicação, exportação e notificações. O CORS já permite `http://localhost:5173`; confira os contratos no Swagger (`/docs`).

| Front (`Professional`) | API |
|---|---|
| `name` / `cpf` / `email` / `coren` | `nome` / `cpf` / `email` / `coren` |
| `formation`: `"Enfemeiro"`\|`"Técnico"` | `formacao`: `enfermeiro`\|`tecnico` |
| `bond`: `CLT`\|`RPA`\|`Concursado` | `tipoVinculo`: `clt`\|`rpa`\|`concursado` |
| `status: boolean` | `status`: `ativo` ⇒ `true`; os demais (`desativado`, `afastado`, `ferias`) ⇒ `false` |
| filtros `all`/`active`/`inactive`, `sort` `asc`/`desc` | `status` (omitir = todos), `ordem` |
| Setor: `shifts[{id:'day'\|'night', minimum:{nurses,technicians}}]` | `turnos.diurno\|noturno.{enfermeiros,tecnicos}` |
| Login `profile`: `coordenação`\|`enfermeiro`\|`técnico` | `perfil` (aceito com acento) |

## Limitações conhecidas

- **DA04 — desativação de profissional:** o módulo ainda registra `SemEscalasPlantoesFuturosChecker`; desativar um profissional não verifica plantões futuros publicados.
- **Snapshots publicados:** snapshots novos preservam a projeção visual da publicação; para snapshots legados sem essa projeção, nomes podem ser resolvidos com os cadastros atuais.
- **Inativação de setor:** não verifica plantões futuros do setor (mesma razão).
- **Recuperação de senha:** o envio de e-mail não existe nesta etapa. O token é entregue por `SenhaNotifier`; a implementação padrão só o escreve no log fora de produção. Basta fornecer outra implementação (SMTP etc.) no `AuthModule`.
- **Transações em outros módulos:** o cadastro de profissional ainda usa compensação manual entre coleções; o ciclo de vida das escalas exige MongoDB em replica set e usa transações.


## Configurações e restrições

Consulte [`../IMPLEMENTACAO_CONFIGURACOES_RESTRICOES.md`](../IMPLEMENTACAO_CONFIGURACOES_RESTRICOES.md) para endpoints, exemplos e fluxo de execução.
