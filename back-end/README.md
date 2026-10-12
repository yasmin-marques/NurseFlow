# NurseFlow — Back-end

API REST em **NestJS 12 + MongoDB (Mongoose)** com os módulos de **Autenticação/controle de acesso**, **Profissionais** e **Setores hospitalares**. Escalas, trocas, férias, disponibilidade e notificações ainda não fazem parte desta etapa.

## Requisitos

- Node.js ≥ 24 (o Nest 12 é distribuído como ESM; o projeto compila para CommonJS e roda no Node 24 via `require(esm)`)
- npm ≥ 10
- MongoDB 8 — suba com o Docker do projeto: `docker compose -f ../db/docker-compose.yml up -d`

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
| `MONGODB_URI` | URI do Mongo, **incluindo o nome do banco** | — (obrigatória) |
| `JWT_SECRET` | Segredo do JWT (≥ 16 caracteres) | — (obrigatória) |
| `JWT_EXPIRES_IN_SECONDS` | Validade do token | `28800` (8 h) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | Bloqueio temporário após tentativas inválidas | `5` / `15` |
| `PASSWORD_RESET_TTL_MINUTES` | Validade do token de recuperação de senha | `30` |
| `SEED_COORDENACAO_*` | Dados da primeira conta de Coordenação | — |

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

### Primeira conta de Coordenação

Não existe cadastro público: a primeira conta é criada pelo seed (usa `SEED_COORDENACAO_*` do `.env`; não faz nada se o usuário já existir).

```bash
npm run migrate:up
npm run seed:coordenacao
```

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
npm test                 # unitários (CPF, guard de perfis)
npm run test:e2e         # e2e com MongoDB em memória: aplica as migrations e exercita a API inteira
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

## Autorização

JWT Bearer. `JwtAuthGuard` e `RolesGuard` são globais: toda rota exige token, exceto as marcadas com `@Public()`; `@Perfis(...)` restringe por perfil. O perfil é derivado da conta: administrador = **Coordenação**; profissional = **Enfermeiro** ou **Técnico** conforme a `formacao`. A cada requisição o token é revalidado contra o banco, então um profissional desativado perde a sessão imediatamente.

| Perfil | Profissionais | Setores (leitura) | Setores (escrita) |
|---|---|---|---|
| Coordenação | CRUD lógico | ✔ | ✔ |
| Enfermeiro / Técnico | ✘ (403) | ✔ | ✘ (403) |

## Estrutura

```
src/
  auth/           login, JWT, bloqueio por tentativas, recuperação de senha
  usuarios/       identidade: schemas usuarios, administradores e UsuariosService
  profissionais/  cadastro/consulta/edição/desativação (+ porta PlantoesFuturosChecker)
  setores/        cadastro/consulta/edição/inativação com quantitativo por turno
  common/         enums, decorators (@Public, @Perfis), guards, filtro global de erros, utilitários
  config/         leitura e validação do ambiente
migrations/       migrate-mongo
scripts/          seed da Coordenação
test/             e2e (API completa e migrations)
```

## Integração com o front-end

O front atual ainda usa dados em memória e não chama a API; **nenhum arquivo do front foi alterado**. O CORS já permite `http://localhost:5173`. Correspondência entre os campos do front e da API:

| Front (`Professional`) | API |
|---|---|
| `name` / `cpf` / `email` / `coren` | `nome` / `cpf` / `email` / `coren` |
| `formation`: `"Enfemeiro"`\|`"Técnico"` | `formacao`: `enfermeiro`\|`tecnico` |
| `bond`: `CLT`\|`RPA`\|`Concursado` | `tipoVinculo`: `clt`\|`rpa`\|`concursado` |
| `status: boolean` | `status`: `ativo` ⇒ `true`; os demais (`desativado`, `afastado`, `ferias`) ⇒ `false` |
| filtros `all`/`active`/`inactive`, `sort` `asc`/`desc` | `status` (omitir = todos), `ordem` |
| Setor: `shifts[{id:'day'\|'night', minimum:{nurses,technicians}}]` | `turnos.diurno\|noturno.{enfermeiros,tecnicos}` |
| Login `profile`: `coordenação`\|`enfermeiro`\|`técnico` | `perfil` (aceito com acento) |

## Limitações (dependem do módulo de Escalas)

- **DA04 — plantões futuros publicados:** a regra que impede desativar um profissional com plantões futuros em escalas publicadas está pronta como porta (`PlantoesFuturosChecker`, com resposta 409 listando os plantões). Sem o módulo de Escalas, a implementação registrada (`SemEscalasPlantoesFuturosChecker`) não encontra plantões e, portanto, **não bloqueia**. Ao criar as Escalas, basta registrar uma implementação real no `ProfissionaisModule`.
- **DA02/DA03 — propagação para escalas e histórico:** "disponibilizar para escalas ainda não publicadas", "aplicar a mudança às escalas" e "registrar no histórico" dependem de Escalas/Histórico e não foram implementados.
- **Inativação de setor:** não verifica plantões futuros do setor (mesma razão).
- **Recuperação de senha:** o envio de e-mail não existe nesta etapa. O token é entregue por `SenhaNotifier`; a implementação padrão só o escreve no log fora de produção. Basta fornecer outra implementação (SMTP etc.) no `AuthModule`.
- **MongoDB sem transações:** o cadastro de profissional grava `usuarios` e depois `profissionaisDaSaude`; se a segunda gravação falhar, a primeira é desfeita manualmente (o container padrão não é um replica set).
