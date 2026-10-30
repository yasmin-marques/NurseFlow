import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import mongoose from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-de-teste-123';

describe('Restrições e Configurações (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let tokenCoord: string;
  let tokenEnf: string;
  let tokenTec: string;
  let idEnf: string;
  let idTec: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;
  const colecao = (nome: string) => mongo.db().collection(nome);

  const restricao = (sobrescrever: Record<string, unknown> = {}) => ({
    tipo: 'indisponivel',
    inicio: '2026-10-01T00:00:00.000Z',
    fim: '2026-10-31T23:59:59.999Z',
    ...sobrescrever,
  });
  const rota = (id: string, sufixo = '') => `/profissionais/${id}/restricoes${sufixo}`;

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_restricoes');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';

    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());
    mongo = new mongoose.mongo.MongoClient(banco.uri);

    const usuarios = app.get(UsuariosService);
    const coord = await usuarios.criar({
      nome: 'Coordenação',
      email: 'coordenacao@nurseflow.com',
      cpf: '11144477735',
      senha: await AuthService.gerarHashSenha(SENHA),
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
    });
    await usuarios.criarAdministrador(coord._id);
    tokenCoord = await login('coordenacao@nurseflow.com', 'coordenacao');

    const criar = async (nome: string, cpf: string, coren: string, formacao: string, email: string) =>
      (
        await http
          .post('/profissionais')
          .set(auth(tokenCoord))
          .send({ nome, cpf, coren, formacao, tipoVinculo: 'clt', email, senha: SENHA })
          .expect(201)
      ).body.id as string;
    idEnf = await criar('Ana Souza', '529.982.247-25', 'COREN-CE 111111', 'enfermeiro', 'ana@nurseflow.com');
    idTec = await criar('Rafael Lima', '390.533.447-05', 'COREN-CE 222222', 'tecnico', 'rafael@nurseflow.com');
    tokenEnf = await login('ana@nurseflow.com');
    tokenTec = await login('rafael@nurseflow.com');
  });

  afterAll(async () => {
    await mongo?.close();
    await app?.close();
    await banco?.parar();
  });

  describe('Configurações', () => {
    const periodo = '?ano=2026&mes=10';

    it('devolve os valores padrão quando o período ainda não foi configurado', async () => {
      const res = await http.get(`/configuracoes${periodo}`).set(auth(tokenCoord)).expect(200);
      expect(res.body).toMatchObject({
        periodo: '2026-10',
        limiteTrocas: 3,
        maxExtras: 2,
        limitePlantoes: 12,
        maxExtrasConcursado: 1,
        maxExtrasClt: 1,
        cargas: {
          concursado_31: { plantoes24h: 6, plantoes12h: 1 },
          clt_31: { plantoes24h: 5, plantoes12h: 2 },
        },
      });
      expect(Object.keys(res.body.cargas)).toHaveLength(8);
      expect(await colecao('configuracoes').countDocuments({ chave: '2026-10' })).toBe(1);
    });

    it('salva o limite de trocas e os máximos de extras no MongoDB e os devolve na leitura', async () => {
      const dto = { limiteTrocas: 5, maxExtras: 2, maxExtrasConcursado: 4, maxExtrasClt: 1 };
      const res = await http.patch(`/configuracoes/limites${periodo}`).set(auth(tokenCoord)).send(dto).expect(200);
      expect(res.body).toMatchObject(dto);

      const doc = await colecao('configuracoes').findOne({ chave: '2026-10' });
      expect(doc).toMatchObject(dto);

      const relido = await http.get(`/configuracoes${periodo}`).set(auth(tokenCoord)).expect(200);
      expect(relido.body).toMatchObject(dto);
    });

    it('atualização parcial preserva os demais campos e não duplica o documento', async () => {
      await http.patch(`/configuracoes/limites${periodo}`).set(auth(tokenCoord)).send({ limiteTrocas: 0 }).expect(200);
      const res = await http.get(`/configuracoes${periodo}`).set(auth(tokenCoord)).expect(200);
      expect(res.body).toMatchObject({ limiteTrocas: 0, maxExtrasConcursado: 4, maxExtrasClt: 1 });
      expect(await colecao('configuracoes').countDocuments({ chave: '2026-10' })).toBe(1);
    });

    it('mantém cada período isolado', async () => {
      const res = await http.get('/configuracoes?ano=2026&mes=11').set(auth(tokenCoord)).expect(200);
      expect(res.body).toMatchObject({ periodo: '2026-11', limiteTrocas: 3, maxExtras: 2 });
    });

    it('consulta e salva configurações em qualquer mês dos anos permitidos', async () => {
      const limite = { limiteTrocas: 8 };
      const salvo = await http
        .patch('/configuracoes/limites?ano=9999&mes=12')
        .set(auth(tokenCoord))
        .send({
          ...limite,
          cargas: [{ vinculo: 'clt', diasMes: 31, plantoes24h: 7, plantoes12h: 1 }],
        })
        .expect(200);
      expect(salvo.body).toMatchObject({
        periodo: '9999-12',
        ...limite,
        cargas: {
          clt_31: { plantoes24h: 7, plantoes12h: 1 },
          concursado_31: { plantoes24h: 6, plantoes12h: 1 },
        },
      });

      const outroPeriodo = await http.get('/configuracoes?ano=1&mes=1').set(auth(tokenCoord)).expect(200);
      expect(outroPeriodo.body).toMatchObject({ periodo: '0001-01', limiteTrocas: 3 });
      expect(await colecao('configuracoes').countDocuments({ chave: '9999-12' })).toBe(1);
    });

    it('calcula cargas para ano de um dígito sem converter a data para 1900+', async () => {
      await http.put('/configuracoes/cargas?ano=4&mes=2')
        .set(auth(tokenCoord))
        .send({ vinculo: 'clt', diasMes: 29, plantoes24h: 2, plantoes12h: 0 })
        .expect(200);
      const carga = await http.get('/configuracoes/cargas/clt?ano=4&mes=2').set(auth(tokenCoord)).expect(200);
      expect(carga.body).toEqual({ plantoes24h: 2, plantoes12h: 0 });
    });

    it('rejeita valores inválidos e campos desconhecidos', async () => {
      const enviar = (body: object) => http.patch(`/configuracoes/limites${periodo}`).set(auth(tokenCoord)).send(body);
      await enviar({ limiteTrocas: -1 }).expect(400);
      await enviar({ limiteTrocas: 1.5 }).expect(400);
      await enviar({ limiteTrocas: 'abc' }).expect(400);
      await enviar({ maxExtrasClt: -3 }).expect(400);
      await enviar({ naoExiste: 1 }).expect(400);
      expect((await http.get(`/configuracoes${periodo}`).set(auth(tokenCoord))).body.limiteTrocas).toBe(0);
    });

    it('valida o período informado', async () => {
      await http.get('/configuracoes').set(auth(tokenCoord)).expect(400);
      await http.get('/configuracoes?ano=2026&mes=13').set(auth(tokenCoord)).expect(400);
      await http.get('/configuracoes?ano=abc&mes=1').set(auth(tokenCoord)).expect(400);
    });

    it('define e consulta a carga de plantões por vínculo e quantidade de dias do mês', async () => {
      const dto = { vinculo: 'clt', diasMes: 31, plantoes24h: 8, plantoes12h: 0 };
      const res = await http.put(`/configuracoes/cargas${periodo}`).set(auth(tokenCoord)).send(dto).expect(200);
      expect(res.body.cargas.clt_31).toEqual({ plantoes24h: 8, plantoes12h: 0 });

      // Outubro tem 31 dias.
      const esperada = await http.get(`/configuracoes/cargas/clt${periodo}`).set(auth(tokenCoord)).expect(200);
      expect(esperada.body).toEqual({ plantoes24h: 8, plantoes12h: 0 });
    });

    it('rejeita carga inválida e vínculo inexistente', async () => {
      const put = (body: object) => http.put(`/configuracoes/cargas${periodo}`).set(auth(tokenCoord)).send(body);
      await put({ vinculo: 'xxx', diasMes: 30, plantoes24h: 1, plantoes12h: 1 }).expect(400);
      await put({ vinculo: 'clt', diasMes: 27, plantoes24h: 1, plantoes12h: 1 }).expect(400);
      await put({ vinculo: 'clt', diasMes: 30, plantoes24h: -1, plantoes12h: 1 }).expect(400);
      await http.get(`/configuracoes/cargas/xxx${periodo}`).set(auth(tokenCoord)).expect(400);
    });

    it('exige autenticação e restringe a Coordenação (Enfermeiro e Técnico recebem 403)', async () => {
      await http.get(`/configuracoes${periodo}`).expect(401);
      for (const token of [tokenEnf, tokenTec]) {
        await http.get(`/configuracoes${periodo}`).set(auth(token)).expect(403);
        await http.patch(`/configuracoes/limites${periodo}`).set(auth(token)).send({ limiteTrocas: 99 }).expect(403);
        await http.put(`/configuracoes/cargas${periodo}`).set(auth(token)).send({}).expect(403);
        await http.get(`/configuracoes/cargas/clt${periodo}`).set(auth(token)).expect(403);
      }
      expect((await http.get(`/configuracoes${periodo}`).set(auth(tokenCoord))).body.limiteTrocas).toBe(0);
    });
  });

  describe('Restrições / Disponibilidade', () => {
    it('cadastra, persiste com os tipos BSON corretos e lista (inclusive com observação vazia, como o front envia)', async () => {
      const res = await http
        .post(rota(idEnf))
        .set(auth(tokenCoord))
        .send(restricao({ diaSemana: 1, observacao: '' }))
        .expect(201);
      expect(res.body).toMatchObject({ tipo: 'indisponivel', diaSemana: 1 });

      const doc = await colecao('restricoes').findOne({ _id: new mongoose.Types.ObjectId(res.body._id) });
      expect(doc?.profissionalId.toString()).toBe(idEnf);
      expect(doc?.inicio).toBeInstanceOf(Date);
      expect(doc?.diaSemana).toBe(1);

      const lista = await http.get(rota(idEnf)).set(auth(tokenCoord)).expect(200);
      expect(lista.body).toHaveLength(1);
    });

    it('aceita todos os tipos e salva sem recorrência (diaSemana nulo)', async () => {
      for (const [i, tipo] of ['disponivel', 'ferias', 'ausencia', 'vinculo_externo'].entries()) {
        const mes = String(i + 1).padStart(2, '0');
        const res = await http
          .post(rota(idTec))
          .set(auth(tokenCoord))
          .send(restricao({ tipo, inicio: `2027-${mes}-01T00:00:00.000Z`, fim: `2027-${mes}-10T23:59:59.999Z` }))
          .expect(201);
        expect(res.body.diaSemana).toBeNull();
      }
      const lista = await http.get(rota(idTec)).set(auth(tokenCoord)).expect(200);
      expect(lista.body.map((r: { tipo: string }) => r.tipo)).toEqual(['disponivel', 'ferias', 'ausencia', 'vinculo_externo']);
    });

    it('impede restrição duplicada/sobreposta do mesmo tipo (409), mas permite dia ou tipo diferente', async () => {
      await http.post(rota(idEnf)).set(auth(tokenCoord)).send(restricao({ diaSemana: 1 })).expect(409);
      await http.post(rota(idEnf)).set(auth(tokenCoord)).send(restricao({ diaSemana: 2 })).expect(201);
      await http.post(rota(idEnf)).set(auth(tokenCoord)).send(restricao({ tipo: 'disponivel', diaSemana: 1 })).expect(201);
    });

    it('valida os dados de entrada', async () => {
      const enviar = (body: object) => http.post(rota(idEnf)).set(auth(tokenCoord)).send(body);
      await enviar(restricao({ tipo: 'invalido' })).expect(400);
      await enviar(restricao({ inicio: 'ontem' })).expect(400);
      await enviar(restricao({ inicio: '2026-12-31T00:00:00.000Z', fim: '2026-12-01T00:00:00.000Z' })).expect(400);
      await enviar(restricao({ diaSemana: 7 })).expect(400);
      await enviar(restricao({ diaSemana: -1 })).expect(400);
      await enviar(restricao({ observacao: 'x'.repeat(301) })).expect(400);
      await enviar(restricao({ tipo: 'ferias', diaSemana: 2, inicio: '2028-01-01T00:00:00.000Z', fim: '2028-01-05T00:00:00.000Z' })).expect(400);
      await enviar({ ...restricao(), extra: true }).expect(400);
      await enviar({}).expect(400);
    });

    it('responde 400 para ID inválido e 404 para profissional inexistente', async () => {
      await http.get(rota('nao-e-um-id')).set(auth(tokenCoord)).expect(400);
      await http.post(rota('64b7f0c2a1b2c3d4e5f60718')).set(auth(tokenCoord)).send(restricao()).expect(404);
      await http.get(rota('64b7f0c2a1b2c3d4e5f60718')).set(auth(tokenCoord)).expect(404);
    });

    it('exclui somente a restrição do profissional informado', async () => {
      const criada = await http
        .post(rota(idEnf))
        .set(auth(tokenCoord))
        .send(restricao({ tipo: 'ausencia', inicio: '2029-01-01T00:00:00.000Z', fim: '2029-01-02T00:00:00.000Z' }))
        .expect(201);
      const id = criada.body._id as string;

      await http.delete(rota(idTec, `/${id}`)).set(auth(tokenCoord)).expect(404);
      expect(await colecao('restricoes').countDocuments({ _id: new mongoose.Types.ObjectId(id) })).toBe(1);

      await http.delete(rota(idEnf, `/${id}`)).set(auth(tokenCoord)).expect(200);
      expect(await colecao('restricoes').countDocuments({ _id: new mongoose.Types.ObjectId(id) })).toBe(0);
      await http.delete(rota(idEnf, `/${id}`)).set(auth(tokenCoord)).expect(404);
      await http.delete(rota(idEnf, '/xyz')).set(auth(tokenCoord)).expect(400);
    });

    it('consulta conflitos respeitando o dia da semana da recorrência', async () => {
      // Existem: indisponível segunda (1) e terça (2) em outubro/2026 e "disponivel" segunda.
      const consultar = (inicio: string, fim: string) =>
        http.get(rota(idEnf, '/conflitos')).query({ inicio, fim }).set(auth(tokenCoord));
      // 05/10/2026 é segunda-feira.
      const segunda = await consultar('2026-10-05T00:00:00.000Z', '2026-10-05T23:59:59.000Z').expect(200);
      expect(segunda.body.map((r: { diaSemana: number }) => r.diaSemana)).toEqual([1, 1]);
      // 07/10/2026 é quarta-feira: sem conflito.
      const quarta = await consultar('2026-10-07T00:00:00.000Z', '2026-10-07T23:59:59.000Z').expect(200);
      expect(quarta.body).toEqual([]);
      await consultar('invalido', '2026-10-07T00:00:00.000Z').expect(400);
    });

    it('exige autenticação e restringe a Coordenação (Enfermeiro e Técnico recebem 403)', async () => {
      await http.get(rota(idEnf)).expect(401);
      for (const token of [tokenEnf, tokenTec]) {
        await http.get(rota(idEnf)).set(auth(token)).expect(403);
        await http.post(rota(idEnf)).set(auth(token)).send(restricao()).expect(403);
        await http.delete(rota(idEnf, '/64b7f0c2a1b2c3d4e5f60718')).set(auth(token)).expect(403);
        await http.get(rota(idEnf, '/conflitos')).set(auth(token)).expect(403);
      }
    });
  });
});
