import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import mongoose from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { OtimizadorEscala, type ProblemaOtimizacao, type SolucaoOtimizacao } from '../src/escalas/otimizador/otimizador';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-de-teste-123';

/** Dublê do otimizador: registra o problema recebido e aloca o 1º profissional compatível no dia 1 de cada setor. */
class OtimizadorFalso extends OtimizadorEscala {
  problemas: ProblemaOtimizacao[] = [];
  falhar = false;

  resolver(problema: ProblemaOtimizacao): Promise<SolucaoOtimizacao> {
    this.problemas.push(structuredClone(problema));
    const enf = problema.profissionais.find((p) => p.formacao === 'enfermeiro')!;
    const alocacoes = problema.setores.map((s) => ({
      profissional_id: enf.id,
      setor_id: s.id,
      dia: 1 + problema.setores.indexOf(s) * 4,
      opcao: '24h' as const,
      extra: false,
    }));
    alocacoes.push({ ...alocacoes[0], dia: 21, extra: true });
    return Promise.resolve({
      alocacoes,
      descobertos: [{ setor_id: problema.setores[0].id, dia: 2, turno: 'noturno', funcao: 'tecnicos', necessario: 1, alocado: 0, faltam: 1 }],
      estatisticas: {
        status: 'OPTIMAL',
        otimo: true,
        objetivo: 1,
        melhor_limite: 1,
        tempo_segundos: 0.1,
        total_alocacoes: alocacoes.length,
        total_descobertos: 1,
        cargas: problema.profissionais.map((p) => ({
          profissional_id: p.id,
          plantoes_24h: p.id === enf.id ? alocacoes.length : 0,
          plantoes_12h: 0,
          extras: p.id === enf.id ? 1 : 0,
          faltam_24h: p.id === enf.id ? 0 : p.carga_24h,
          faltam_12h: 0,
        })),
      },
    });
  }
}

describe('Geração automática de escalas (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let mongo: mongoose.mongo.MongoClient;
  let tokenCoord: string;
  let tokenEnf: string;
  let idEnf: string;
  let idTec: string;
  const otimizador = new OtimizadorFalso();

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (email: string, perfil?: string) =>
    (await http.post('/auth/login').send({ email, senha: SENHA, perfil }).expect(200)).body.accessToken as string;
  const colecao = (nome: string) => mongo.db().collection(nome);
  const gerar = (corpo: object, token = tokenCoord) => http.post('/escalas/gerar').set(auth(token)).send(corpo);
  const configurarCargas = (ano: number, mes: number, plantoes24h: number, diasMes = 31) =>
    http.put(`/configuracoes/cargas?ano=${ano}&mes=${mes}`).set(auth(tokenCoord)).send({ vinculo: 'clt', diasMes, plantoes24h, plantoes12h: 0 });

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_escalas');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';

    const { AppModule } = await import('../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OtimizadorEscala)
      .useValue(otimizador)
      .compile();
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
  });

  afterAll(async () => {
    await mongo?.close();
    await app?.close();
    await banco?.parar();
  });

  describe('autorização e validação', () => {
    it('exige autenticação e perfil de Coordenação', async () => {
      await http.post('/escalas/gerar').send({ mes: 10, ano: 2026 }).expect(401);
      await gerar({ mes: 10, ano: 2026 }, tokenEnf).expect(403);
    });

    it('rejeita mês/ano inválidos', async () => {
      await gerar({ mes: 13, ano: 2026 }).expect(400);
      await gerar({ mes: 10, ano: 1999 }).expect(400);
      await gerar({ mes: 10 }).expect(400);
    });

    it('responde 422 com a lista de erros quando faltam setores e cargas configuradas', async () => {
      const res = await gerar({ mes: 10, ano: 2026 }).expect(422);
      expect(res.body.erros.join(' ')).toMatch(/setores ativos/);
      expect(res.body.erros.join(' ')).toMatch(/clt/);
      expect(otimizador.problemas).toHaveLength(0);
      expect(await colecao('escalas').countDocuments()).toBe(0);
    });
  });

  describe('geração como rascunho', () => {
    let setorA: string;
    let escalaId: string;

    beforeAll(async () => {
      const turnos = { diurno: { enfermeiros: 1, tecnicos: 1 }, noturno: { enfermeiros: 1, tecnicos: 1 } };
      setorA = (await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'UTI', turnos }).expect(201)).body.id;
      await http.post('/setores').set(auth(tokenCoord)).send({ nome: 'Emergência', turnos }).expect(201);
      await http.patch('/configuracoes/limites?ano=2026&mes=10').set(auth(tokenCoord)).send({ maxExtras: 2, limitePlantoes: 10 }).expect(200);
      await configurarCargas(2026, 10, 8).expect(200);
    });

    it('usa as configurações do banco, grava como rascunho e devolve plantões, pendências e conflitos', async () => {
      await http
        .post(`/profissionais/${idEnf}/restricoes`)
        .set(auth(tokenCoord))
        .send({ tipo: 'ferias', inicio: '2026-10-10T00:00:00.000Z', fim: '2026-10-12T23:59:59.999Z' })
        .expect(201);

      const res = await gerar({ mes: 10, ano: 2026 }).expect(201);
      escalaId = res.body.escala.id;

      const problema = otimizador.problemas.at(-1)!;
      expect(problema.dias_mes).toBe(31);
      const ana = problema.profissionais.find((p) => p.id === idEnf)!;
      expect(ana).toMatchObject({ carga_24h: 8, carga_12h: 0, max_extras: 2, max_plantoes: 10, dias_bloqueados: [10, 11, 12] });
      expect(problema.setores.map((s) => s.nome)).toEqual(['Emergência', 'UTI']);

      expect(res.body.escala).toMatchObject({ mes: 10, ano: 2026, status: 'rascunho' });
      expect(res.body.configuracaoUtilizada).toMatchObject({ maxExtras: 2, limitePlantoes: 10, cargas: { clt_31: { plantoes24h: 8 } } });
      expect(res.body.plantoes).toHaveLength(3);
      expect(res.body.plantoes.filter((p: { tipo: string }) => p.tipo === 'extra')).toHaveLength(1);
      expect(res.body.plantoes[0]).toMatchObject({ horarioInicio: '07:00', horarioFim: '07:00', duracaoHoras: 24 });
      expect(res.body.plantoes[0].profissionais[0]).toMatchObject({ id: idEnf, nome: 'Ana Souza', formacao: 'enfermeiro' });
      expect(res.body.pendencias).toEqual([
        expect.objectContaining({ setor: 'Emergência', data: '2026-10-02', turno: 'noturno', funcao: 'tecnicos', faltam: 1 }),
      ]);
      expect(res.body.conflitos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: 'INDISPONIBILIDADE', profissionalId: idEnf, motivo: 'ferias', dias: [10, 11, 12] }),
          expect.objectContaining({ tipo: 'CARGA_ABAIXO_DO_ESPERADO', profissionalId: idTec }),
        ]),
      );

      const salva = await colecao('escalas').findOne({ ano: 2026, mes: 10 });
      expect(salva?.status).toBe('rascunho');
      expect(await colecao('plantoes').countDocuments({ escalaId: salva?._id })).toBe(3);
      expect(await colecao('profissionaisRelacionados').countDocuments()).toBe(3);
    });

    it('permite consultar a escala gerada', async () => {
      const res = await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200);
      expect(res.body.escala.id).toBe(escalaId);
      expect(res.body.plantoes).toHaveLength(3);
      await http.get('/escalas/64b7f0f0f0f0f0f0f0f0f0f0').set(auth(tokenCoord)).expect(404);
    });

    it('não duplica a escala do mesmo período', async () => {
      const antes = otimizador.problemas.length;
      const res = await gerar({ mes: 10, ano: 2026 }).expect(409);
      expect(res.body.message).toMatch(/rascunho/);
      expect(otimizador.problemas).toHaveLength(antes); // não chegou a otimizar
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 10 })).toBe(1);
    });

    it('mudança de configuração afeta só a próxima geração, sem alterar a escala existente', async () => {
      await configurarCargas(2026, 10, 5).expect(200);
      const intacta = await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200);
      expect(intacta.body.configuracaoUtilizada.cargas.clt_31.plantoes24h).toBe(8);

      const nova = await gerar({ mes: 10, ano: 2026, substituirRascunho: true }).expect(201);
      expect(otimizador.problemas.at(-1)!.profissionais[0].carga_24h).toBe(5);
      expect(nova.body.escala.id).toBe(escalaId); // mesmo documento, conteúdo regenerado
      expect(nova.body.configuracaoUtilizada.cargas.clt_31.plantoes24h).toBe(5);
      expect(nova.body.plantoes).toHaveLength(3); // sem plantões duplicados
      expect(await colecao('plantoes').countDocuments()).toBe(3);
      expect(await colecao('profissionaisRelacionados').countDocuments()).toBe(3);
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 10 })).toBe(1);
    });

    it('nunca substitui escala publicada', async () => {
      await colecao('escalas').updateOne({ ano: 2026, mes: 10 }, { $set: { status: 'publicada' } });
      const res = await gerar({ mes: 10, ano: 2026, substituirRascunho: true }).expect(409);
      expect(res.body.message).toMatch(/publicada/);
      await colecao('escalas').updateOne({ ano: 2026, mes: 10 }, { $set: { status: 'rascunho' } });
    });

    it('propaga o descanso do mês anterior (24x72) a partir da escala existente', async () => {
      await configurarCargas(2026, 11, 7, 30).expect(200);
      // O dublê aloca plantões de 24h nos dias 1, 5 e 21 de outubro; nenhum nos últimos dias, então não há descanso a herdar.
      await gerar({ mes: 11, ano: 2026 }).expect(201);
      expect(otimizador.problemas.at(-1)!.profissionais.every((p) => p.livre_a_partir_horas === 0)).toBe(true);

      // Plantão de 24h iniciado em 30/10 às 07:00 termina 31/10 07:00 e libera o profissional em 03/11 07:00.
      const outubro = await colecao('escalas').findOne({ ano: 2026, mes: 10 });
      const plantaoId = new mongoose.Types.ObjectId();
      await colecao('plantoes').insertOne({
        _id: plantaoId,
        escalaId: outubro!._id,
        setorId: new mongoose.Types.ObjectId(setorA),
        data: new Date(Date.UTC(2026, 9, 30)),
        horarioInicio: '07:00',
        horarioFim: '07:00',
        duracaoHoras: 24,
        tipo: 'regular',
      });
      await colecao('profissionaisRelacionados').insertOne({ plantaoId, profissionalId: new mongoose.Types.ObjectId(idEnf), funcao: 'enfermeiro' });
      await gerar({ mes: 11, ano: 2026, substituirRascunho: true }).expect(201);
      const ana = otimizador.problemas.at(-1)!.profissionais.find((p) => p.id === idEnf)!;
      // fim 31/10 07:00 = hora -17 em relação a 01/11 00:00; + 72h = hora 55 (03/11 07:00)
      expect(ana.livre_a_partir_horas).toBe(55);
    });
  });

  describe('falhas do otimizador', () => {
    it('não deixa escala parcial quando a otimização falha', async () => {
      await configurarCargas(2026, 12, 7).expect(200);
      const original = otimizador.resolver.bind(otimizador);
      otimizador.resolver = () => Promise.reject(new Error('indisponível'));
      await gerar({ mes: 12, ano: 2026 }).expect(500);
      otimizador.resolver = original;
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 12 })).toBe(0);
    });
  });
});
