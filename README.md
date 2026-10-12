# NurseFlow — execução integrada

Aplicação com **React 19 / Vite**, **NestJS**, **MongoDB 8** e **Nginx**. O Compose reside na raiz e sobe os três serviços. O frontend utiliza `/api` como URL de API; o Nginx faz proxy para `http://backend:3000` dentro da rede Docker.

## Pré-requisitos

- Docker Engine com Compose v2.
- Para executar sem Docker: Node e npm compatíveis com os `package.json`/`package-lock.json` dos projetos.

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