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
  duplicarVinculo = false;
  bloquear = false;
  cancelamentos: string[] = [];
  private sinalInicio?: () => void;

  aguardarInicio() {
    return new Promise<void>((resolve) => {
      this.sinalInicio = resolve;
    });
  }

  async resolver(problema: ProblemaOtimizacao, signal?: AbortSignal): Promise<SolucaoOtimizacao> {
    this.problemas.push(structuredClone(problema));
    this.sinalInicio?.();
    this.sinalInicio = undefined;
    if (this.bloquear) {
      await new Promise<never>((_resolve, reject) => {
        const cancelar = () => reject(new Error('Geração interrompida pelo teste.'));
        if (signal?.aborted) cancelar();
        else signal?.addEventListener('abort', cancelar, { once: true });
      });
    }
    const enf = problema.profissionais.find((p) => p.formacao === 'enfermeiro')!;
    const alocacoes = problema.setores.map((s) => ({
      profissional_id: enf.id,
      setor_id: s.id,
      dia: 1 + problema.setores.indexOf(s) * 4,
      opcao: '24h' as const,
      extra: false,
    }));
    if (this.duplicarVinculo) alocacoes.push({ ...alocacoes[0] });
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

  async cancelar(operacaoId: string) {
    this.cancelamentos.push(operacaoId);
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

  describe('consulta, criação e remoção manual', () => {
    it('restringe listagem, criação e remoção à Coordenação', async () => {
      await http.get('/escalas?ano=2027&mes=1').expect(401);
      await http.get('/escalas?ano=2027&mes=1').set(auth(tokenEnf)).expect(403);
      await http.post('/escalas').send({ ano: 2027, mes: 1 }).expect(401);
      await http.post('/escalas').set(auth(tokenEnf)).send({ ano: 2027, mes: 1 }).expect(403);
      await http.delete('/escalas/64b7f0f0f0f0f0f0f0f0f0f0').set(auth(tokenEnf)).send({ confirmar: true }).expect(403);
    });

    it('lista períodos vazios, cria rascunho sem duplicidade e remove todo o conteúdo relacionado após confirmação', async () => {
      await http.get('/escalas?ano=2027&mes=13').set(auth(tokenCoord)).expect(400);
      const vazio = await http.get('/escalas?ano=2027&mes=1').set(auth(tokenCoord)).expect(200);
      expect(vazio.body).toEqual([]);

      const setor = await http
        .post('/setores')
        .set(auth(tokenCoord))
        .send({ nome: 'Setor de teste de remoção', turnos: { diurno: { enfermeiros: 1, tecnicos: 1 }, noturno: { enfermeiros: 1, tecnicos: 1 } } })
        .expect(201);
      const criada = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2027, mes: 1 }).expect(201);
      const escalaId = criada.body.escala.id as string;
      expect(criada.body.escala).toMatchObject({ ano: 2027, mes: 1, status: 'rascunho' });
      expect(criada.body.plantoes).toEqual([]);
      expect(criada.body.cobertura).toMatchObject({ posicoesExigidas: expect.any(Number), posicoesPreenchidas: 0, percentual: 0 });

      const listada = await http.get('/escalas?ano=2027&mes=1').set(auth(tokenCoord)).expect(200);
      expect(listada.body.map((item: { escala: { id: string } }) => item.escala.id)).toEqual([escalaId]);
      await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2027, mes: 1 }).expect(409);

      const plantaoId = new mongoose.Types.ObjectId();
      await colecao('plantoes').insertOne({
        _id: plantaoId,
        escalaId: new mongoose.Types.ObjectId(escalaId),
        setorId: new mongoose.Types.ObjectId(setor.body.id),
        data: new Date(Date.UTC(2027, 0, 1)),
        horarioInicio: '07:00',
        horarioFim: '19:00',
        duracaoHoras: 12,
        tipo: 'regular',
      });
      await colecao('profissionaisRelacionados').insertOne({
        plantaoId,
        profissionalId: new mongoose.Types.ObjectId(idEnf),
        funcao: 'enfermeiro',
      });

      const revisaoEsperada = criada.body.escala.revisao as number;
      await http
        .delete(`/escalas/${escalaId}`)
        .set(auth(tokenCoord))
        .send({ confirmar: false, revisaoEsperada })
        .expect(400);
      expect(await colecao('escalas').countDocuments({ _id: new mongoose.Types.ObjectId(escalaId) })).toBe(1);
      await http
        .delete(`/escalas/${escalaId}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada })
        .expect(204);
      expect(await colecao('escalas').countDocuments({ _id: new mongoose.Types.ObjectId(escalaId) })).toBe(0);
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaId) })).toBe(0);
      expect(await colecao('profissionaisRelacionados').countDocuments({ plantaoId })).toBe(0);
      await http
        .delete(`/escalas/${escalaId}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada })
        .expect(404);
      await http.patch(`/setores/${setor.body.id}/inativar`).set(auth(tokenCoord)).expect(200);
    });
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
    let plantaoManualId: string;

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
      expect(problema.turnos_selecionados).toEqual(['diurno', 'noturno']);
      const ana = problema.profissionais.find((p) => p.id === idEnf)!;
      expect(ana).toMatchObject({ carga_24h: 8, carga_12h: 0, max_extras: 2, max_plantoes: 10, dias_bloqueados: [10, 11, 12] });
      expect(problema.setores.map((s) => s.nome)).toEqual(['Emergência', 'UTI']);

      expect(res.body.escala).toMatchObject({ mes: 10, ano: 2026, status: 'rascunho' });
      expect(res.body.configuracaoUtilizada).toMatchObject({ maxExtras: 2, limitePlantoes: 10, cargas: { clt_31: { plantoes24h: 8 } } });
      expect(res.body.plantoes).toHaveLength(3);
      expect(res.body.plantoes.filter((p: { tipo: string }) => p.tipo === 'extra')).toHaveLength(1);
      expect(res.body.plantoes[0]).toMatchObject({ horarioInicio: '07:00', horarioFim: '07:00', duracaoHoras: 24 });
      expect(res.body.plantoes[0].profissionais[0]).toMatchObject({
        id: idEnf,
        nome: 'Ana Souza',
        formacao: 'enfermeiro',
        lideranca: false,
        origemCobertura: 'regular',
      });
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

    it('restringe geração aos setores e turnos solicitados e rejeita setores indisponíveis', async () => {
      await configurarCargas(2026, 9, 7, 30).expect(200);
      const gerada = await gerar({ ano: 2026, mes: 9, setorIds: [setorA], turnos: ['diurno'] }).expect(201);
      const problema = otimizador.problemas.at(-1)!;
      expect(problema.setores.map((setor) => setor.id)).toEqual([setorA]);
      expect(problema.setores[0].turnos.noturno.enfermeiros).toBe(1);
      expect(problema.turnos_selecionados).toEqual(['diurno']);
      expect(gerada.body.escopo).toEqual({ setorIds: [setorA], turnos: ['diurno'] });

      await gerar({ ano: 2026, mes: 8, setorIds: ['64b7f0f0f0f0f0f0f0f0f0f0'], turnos: ['diurno'] }).expect(422);
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 8 })).toBe(0);
    });

    it('inclui e edita plantões manuais, revalidando cobertura e registrando revisão', async () => {
      const antes = await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200);
      const criado = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: antes.body.escala.revisao,
          setorId: setorA,
          data: '2026-10-14',
          opcao: '12d',
          tipo: 'extra',
          equipe: [
            { profissionalId: idEnf, funcao: 'enfermeiro', lideranca: true, origemCobertura: 'restricao' },
            { profissionalId: idTec, funcao: 'tecnico' },
          ],
        })
        .expect(201);
      plantaoManualId = criado.body.plantoes.find((p: { data: string; setor: { id: string } }) => p.data === '2026-10-14' && p.setor.id === setorA).id;
      expect(criado.body.plantoes.find((p: { id: string }) => p.id === plantaoManualId).profissionais).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: idEnf, lideranca: true, origemCobertura: 'restricao' }),
          expect.objectContaining({ id: idTec, lideranca: false, origemCobertura: 'regular' }),
        ]),
      );
      expect(criado.body.escala.revisao).toBe(antes.body.escala.revisao + 1);
      expect(criado.body.pendencias).not.toContainEqual(
        expect.objectContaining({ setorId: setorA, data: '2026-10-14', turno: 'diurno', funcao: 'tecnicos' }),
      );

      const editado = await http
        .patch(`/escalas/${escalaId}/plantoes/${plantaoManualId}`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: criado.body.escala.revisao,
          setorId: setorA,
          data: '2026-10-15',
          opcao: '12d',
          tipo: 'extra',
          equipe: [
            { profissionalId: idEnf, funcao: 'enfermeiro', lideranca: true, origemCobertura: 'restricao' },
            { profissionalId: idTec, funcao: 'tecnico' },
          ],
        })
        .expect(200);
      expect(editado.body.escala.revisao).toBe(criado.body.escala.revisao + 1);
      expect(editado.body.plantoes.find((p: { id: string }) => p.id === plantaoManualId).data).toBe('2026-10-15');
      expect(await colecao('auditoriaEscalas').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaId) })).toBe(2);
    });

    it('rejeita função, indisponibilidade e descanso inválidos sem alterações parciais', async () => {
      const totalAntes = await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaId) });
      const corpo = {
        revisaoEsperada: 3,
        setorId: setorA,
        data: '2026-10-11',
        opcao: '12d',
        tipo: 'extra',
        equipe: [{ profissionalId: idTec, funcao: 'enfermeiro' }],
      };
      await http.post(`/escalas/${escalaId}/plantoes`).set(auth(tokenEnf)).send(corpo).expect(403);
      await http.patch(`/escalas/${escalaId}/plantoes/${plantaoManualId}`).set(auth(tokenEnf)).send(corpo).expect(403);
      const funcao = await http.post(`/escalas/${escalaId}/plantoes`).set(auth(tokenCoord)).send(corpo).expect(422);
      expect(funcao.body.erros.join(' ')).toMatch(/formação exigida/);

      const liderTecnico = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({ ...corpo, equipe: [{ profissionalId: idTec, funcao: 'tecnico', lideranca: true }] })
        .expect(422);
      expect(liderTecnico.body.message).toMatch(/enfermeiro chefe/i);

      const indisponibilidade = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({ ...corpo, equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }] })
        .expect(422);
      expect(indisponibilidade.body.erros.join(' ')).toMatch(/indisponível/);

      const descanso = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          ...corpo,
          data: '2026-10-01',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(422);
      expect(descanso.body.erros.join(' ')).toMatch(/descanso obrigatório/);

      await http
        .patch(`/escalas/${escalaId}/plantoes/${plantaoManualId}`)
        .set(auth(tokenCoord))
        .send({ ...corpo, equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }] })
        .expect(422);
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaId) })).toBe(totalAntes);
      const plantao = await colecao('plantoes').findOne({ _id: new mongoose.Types.ObjectId(plantaoManualId) });
      expect(plantao?.data).toEqual(new Date('2026-10-15T00:00:00.000Z'));
      expect(await colecao('profissionaisRelacionados').countDocuments({ plantaoId: new mongoose.Types.ObjectId(plantaoManualId) })).toBe(2);
    });

    it('pré-valida alterações sem escrita e salva o lote válido em uma única revisão', async () => {
      await http
        .patch('/configuracoes/limites?ano=2030&mes=1')
        .set(auth(tokenCoord))
        .send({ limitePlantoes: 10, maxExtras: 2 })
        .expect(200);
      await configurarCargas(2030, 1, 0).expect(200);
      const criada = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2030, mes: 1 }).expect(201);
      const escalaIdLote = criada.body.escala.id as string;
      const equipe: { profissionalId: string; funcao: string; lideranca?: boolean }[] = [
        { profissionalId: idEnf, funcao: 'enfermeiro', lideranca: true },
        { profissionalId: idTec, funcao: 'tecnico' },
      ];
      const plantaoExistente = await http
        .post(`/escalas/${escalaIdLote}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: criada.body.escala.revisao,
          setorId: setorA,
          data: '2030-01-02',
          opcao: '12d',
          tipo: 'extra',
          equipe,
        })
        .expect(201);
      const plantaoExistenteId = plantaoExistente.body.plantoes[0].id as string;
      const vinculosAntes = await colecao('profissionaisRelacionados').countDocuments();
      const lote = {
        revisaoEsperada: plantaoExistente.body.escala.revisao,
        alteracoes: [
          { plantaoId: plantaoExistenteId, setorId: setorA, data: '2030-01-04', opcao: '12d', tipo: 'extra', equipe },
          { setorId: setorA, data: '2030-01-08', opcao: '12n', tipo: 'extra', equipe },
        ],
      };
      const validarUrl = `/escalas/${escalaIdLote}/plantoes/validar-lote`;
      const salvarUrl = `/escalas/${escalaIdLote}/plantoes/lote`;

      const validacao = await http.post(validarUrl).set(auth(tokenCoord)).send(lote).expect(200);
      expect(validacao.body).toEqual({ revisao: plantaoExistente.body.escala.revisao, valida: true, erros: [] });
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaIdLote) })).toBe(1);

      const loteInvalido = {
        ...lote,
        alteracoes: [lote.alteracoes[0], { ...lote.alteracoes[1], equipe: [{ profissionalId: idEnf, funcao: 'tecnico' }] }],
      };
      const validacaoInvalida = await http.post(validarUrl).set(auth(tokenCoord)).send(loteInvalido).expect(200);
      expect(validacaoInvalida.body.valida).toBe(false);
      expect(validacaoInvalida.body.erros.join(' ')).toMatch(/formação exigida/);
      await http.post(salvarUrl).set(auth(tokenCoord)).send(loteInvalido).expect(422);
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaIdLote) })).toBe(1);
      expect(await colecao('profissionaisRelacionados').countDocuments()).toBe(vinculosAntes);
      const plantaoDepoisDaFalha = await colecao('plantoes').findOne({ _id: new mongoose.Types.ObjectId(plantaoExistenteId) });
      expect(plantaoDepoisDaFalha?.data).toEqual(new Date('2030-01-02T00:00:00.000Z'));
      expect((await http.get(`/escalas/${escalaIdLote}`).set(auth(tokenCoord)).expect(200)).body.escala.revisao).toBe(
        plantaoExistente.body.escala.revisao,
      );

      const salva = await http.post(salvarUrl).set(auth(tokenCoord)).send(lote).expect(200);
      expect(salva.body.escala.revisao).toBe(plantaoExistente.body.escala.revisao + 1);
      expect(salva.body.plantoes).toHaveLength(2);
      expect(salva.body.plantoes.find((plantao: { id: string }) => plantao.id === plantaoExistenteId).data).toBe('2030-01-04');
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaIdLote) })).toBe(2);
      expect(await colecao('profissionaisRelacionados').countDocuments({
        plantaoId: { $in: salva.body.plantoes.map((plantao: { id: string }) => new mongoose.Types.ObjectId(plantao.id)) },
      })).toBe(4);
      expect(await colecao('auditoriaEscalas').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaIdLote) })).toBe(2);

      await http.post(salvarUrl).set(auth(tokenCoord)).send(lote).expect(409);
      expect(await colecao('plantoes').countDocuments({ escalaId: new mongoose.Types.ObjectId(escalaIdLote) })).toBe(2);
      expect((await http.get(`/escalas/${escalaIdLote}`).set(auth(tokenCoord)).expect(200)).body.escala.revisao).toBe(
        plantaoExistente.body.escala.revisao + 1,
      );
    });

    it('controla transições por revisão, persiste cobertura e invalida validação após edição', async () => {
      await http.patch('/configuracoes/limites?ano=2028&mes=1').set(auth(tokenCoord)).send({ limitePlantoes: 10, maxExtras: 0 }).expect(200);
      await configurarCargas(2028, 1, 1).expect(200);
      const criada = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2028, mes: 1 }).expect(201);
      const id = criada.body.escala.id as string;
      const revisaoInicial = criada.body.escala.revisao as number;

      await http.post(`/escalas/${id}/validar`).set(auth(tokenCoord)).send({ revisaoEsperada: revisaoInicial }).expect(409);
      const plantao = await http
        .post(`/escalas/${id}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: revisaoInicial,
          setorId: setorA,
          data: '2028-01-01',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(201);
      const plantaoId = plantao.body.plantoes[0].id as string;
      const revisaoAtual = plantao.body.escala.revisao as number;

      await http
        .patch(`/escalas/${id}/plantoes/${plantaoId}`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: revisaoInicial,
          setorId: setorA,
          data: '2028-01-05',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(409);

      const emRevisao = await http
        .post(`/escalas/${id}/revisao`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: revisaoAtual })
        .expect(200);
      expect(emRevisao.body.escala).toMatchObject({ status: 'em_revisao', revisao: revisaoAtual + 1 });

      const validada = await http
        .post(`/escalas/${id}/validar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: emRevisao.body.escala.revisao })
        .expect(200);
      expect(validada.body.escala.status).toBe('validada');
      expect(validada.body.cobertura).toMatchObject({ posicoesExigidas: expect.any(Number), percentual: expect.any(Number) });
      expect(validada.body.cobertura.percentual).toBeLessThan(100);
      expect(validada.body.cobertura.percentual).toBe(
        Math.floor((100 * validada.body.cobertura.posicoesPreenchidas) / validada.body.cobertura.posicoesExigidas),
      );
      expect(validada.body.escala.validacao.cobertura).toEqual(validada.body.cobertura);

      const editada = await http
        .patch(`/escalas/${id}/plantoes/${plantaoId}`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: validada.body.escala.revisao,
          setorId: setorA,
          data: '2028-01-05',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(200);
      expect(editada.body.escala).toMatchObject({ status: 'em_revisao', revisao: validada.body.escala.revisao + 1, validacao: null });

      await colecao('escalas').updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { status: 'rascunho' } });
      await http
        .delete(`/escalas/${id}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada: editada.body.escala.revisao })
        .expect(204);
    });

    it('inicia revisão a partir do snapshot oficial e mantém a versão publicada imutável', async () => {
      await http.patch('/configuracoes/limites?ano=2029&mes=1').set(auth(tokenCoord)).send({ limitePlantoes: 10, maxExtras: 0 }).expect(200);
      await configurarCargas(2029, 1, 1).expect(200);
      const criada = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2029, mes: 1 }).expect(201);
      const id = criada.body.escala.id as string;
      const plantaoCriado = await http
        .post(`/escalas/${id}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: criada.body.escala.revisao,
          setorId: setorA,
          data: '2029-01-01',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(201);
      const escalaId = new mongoose.Types.ObjectId(id);
      const escalaPersistida = await colecao('escalas').findOne({ _id: escalaId });
      const plantoes = await colecao('plantoes').find({ escalaId }).toArray();
      const profissionaisRelacionados = await colecao('profissionaisRelacionados')
        .find({ plantaoId: { $in: plantoes.map((item) => item._id) } })
        .toArray();
      await colecao('escalas').updateOne({ _id: escalaId }, { $set: { status: 'publicada', versaoPublicada: 1 } });
      const snapshot = {
        escala: { ...escalaPersistida, status: 'publicada', versaoPublicada: 1 },
        plantoes,
        profissionaisRelacionados,
        pendencias: [],
        conflitos: [],
        avisos: [],
        cargas: [],
      };
      await colecao('versoesEscala').insertOne({
        escalaId,
        numero: 1,
        mes: 1,
        ano: 2029,
        publicadoPor: escalaPersistida!.administradorId,
        publicadoEm: new Date('2029-01-01T00:00:00.000Z'),
        pendenciasConfirmadas: false,
        snapshot,
        createdAt: new Date('2029-01-01T00:00:00.000Z'),
        updatedAt: new Date('2029-01-01T00:00:00.000Z'),
      });

      const oficial = await http.get(`/escalas/${id}/versao-oficial`).set(auth(tokenCoord)).expect(200);
      const revisao = await http
        .post(`/escalas/${id}/revisao`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: plantaoCriado.body.escala.revisao })
        .expect(200);
      expect(revisao.body.escala.status).toBe('em_revisao');
      expect(revisao.body.plantoes).toHaveLength(1);

      await http
        .patch(`/escalas/${id}/plantoes/${plantaoCriado.body.plantoes[0].id}`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: revisao.body.escala.revisao,
          setorId: setorA,
          data: '2029-01-05',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(200);
      const oficialDepois = await http.get(`/escalas/${id}/versao-oficial`).set(auth(tokenCoord)).expect(200);
      expect(oficialDepois.body.snapshot).toEqual(oficial.body.snapshot);
      const auditoria = await http.get(`/escalas/${id}/auditoria`).set(auth(tokenCoord)).expect(200);
      expect(auditoria.body.auditoria.map((item: { acao: string }) => item.acao)).toEqual(
        expect.arrayContaining(['revisao_iniciada', 'plantao_editado']),
      );

      const atual = await http.get(`/escalas/${id}`).set(auth(tokenCoord)).expect(200);
      expect(atual.body.plantoes[0].data).toBe('2029-01-05');
      await colecao('escalas').updateOne({ _id: escalaId }, { $set: { status: 'rascunho' } });
      await http
        .delete(`/escalas/${id}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada: atual.body.escala.revisao })
        .expect(204);
    });

    it('permite consultar a escala gerada', async () => {
      const res = await http.get(`/escalas/${escalaId}`).set(auth(tokenCoord)).expect(200);
      expect(res.body.escala.id).toBe(escalaId);
      expect(res.body.plantoes).toHaveLength(4);
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
      expect(nova.body.escala.revisao).toBe(intacta.body.escala.revisao + 1);
      expect(nova.body.configuracaoUtilizada.cargas.clt_31.plantoes24h).toBe(5);
      expect(nova.body.plantoes).toHaveLength(3); // sem plantões duplicados
      const plantoesDoMes = await colecao('plantoes').find({ escalaId: new mongoose.Types.ObjectId(escalaId) }, { projection: { _id: 1 } }).toArray();
      expect(plantoesDoMes).toHaveLength(3);
      expect(await colecao('profissionaisRelacionados').countDocuments({ plantaoId: { $in: plantoesDoMes.map((item) => item._id) } })).toBe(3);
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 10 })).toBe(1);
    });

    it('mantém o rascunho anterior intacto se uma substituição falhar ao gravar vínculos', async () => {
      const escalaAntes = await colecao('escalas').findOne({ ano: 2026, mes: 10 });
      const plantoesAntes = await colecao('plantoes').find({ escalaId: escalaAntes?._id }).toArray();
      const vinculosAntes = await colecao('profissionaisRelacionados')
        .find({ plantaoId: { $in: plantoesAntes.map((p) => p._id) } })
        .toArray();

      otimizador.duplicarVinculo = true;
      try {
        await gerar({ mes: 10, ano: 2026, substituirRascunho: true }).expect(409);
      } finally {
        otimizador.duplicarVinculo = false;
      }

      const escalaDepois = await colecao('escalas').findOne({ ano: 2026, mes: 10 });
      const plantoesDepois = await colecao('plantoes').find({ escalaId: escalaDepois?._id }).toArray();
      const vinculosDepois = await colecao('profissionaisRelacionados')
        .find({ plantaoId: { $in: plantoesDepois.map((p) => p._id) } })
        .toArray();
      expect(escalaDepois?.geracao).toEqual(escalaAntes?.geracao);
      expect(plantoesDepois).toEqual(plantoesAntes);
      expect(vinculosDepois).toEqual(vinculosAntes);
    });

    it('nunca substitui escala publicada', async () => {
      await colecao('escalas').updateOne({ ano: 2026, mes: 10 }, { $set: { status: 'publicada' } });
      const res = await gerar({ mes: 10, ano: 2026, substituirRascunho: true }).expect(409);
      expect(res.body.message).toMatch(/publicada/);
      const escala = await colecao('escalas').findOne({ ano: 2026, mes: 10 });
      await http
        .delete(`/escalas/${escalaId}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada: escala?.revisao })
        .expect(409);
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

  describe('publicação de escala', () => {
    let setorPublicacao: string;
    let setorPublicacaoB: string;

    beforeAll(async () => {
      const setor = await http
        .post('/setores')
        .set(auth(tokenCoord))
        .send({
          nome: 'Setor de teste de publicação',
          turnos: {
            diurno: { enfermeiros: 1, tecnicos: 1 },
            noturno: { enfermeiros: 1, tecnicos: 1 },
          },
        })
        .expect(201);
      setorPublicacao = setor.body.id;
      const segundoSetor = await http
        .post('/setores')
        .set(auth(tokenCoord))
        .send({
          nome: 'Setor de teste de PDF',
          turnos: {
            diurno: { enfermeiros: 1, tecnicos: 1 },
            noturno: { enfermeiros: 1, tecnicos: 1 },
          },
        })
        .expect(201);
      setorPublicacaoB = segundoSetor.body.id;
    });

    const prepararPeriodo = async (ano: number, mes: number, setorIds = [setorPublicacao]) => {
      await http
        .patch(`/configuracoes/limites?ano=${ano}&mes=${mes}`)
        .set(auth(tokenCoord))
        .send({ maxExtras: 2, limitePlantoes: 10 })
        .expect(200);
      await configurarCargas(ano, mes, 8, new Date(Date.UTC(ano, mes, 0)).getUTCDate()).expect(200);
      return gerar({ ano, mes, setorIds, turnos: ['diurno'] }).expect(201);
    };

    const revisarEValidar = async (escala: { escala: { id: string; revisao: number } }) => {
      const id = escala.escala.id;
      const revisao = await http
        .post(`/escalas/${id}/revisao`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: escala.escala.revisao })
        .expect(200);
      return http
        .post(`/escalas/${id}/validar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: revisao.body.escala.revisao })
        .expect(200);
    };

    it('confirma pendências, publica uma única versão e preserva o snapshot durante a revisão', async () => {
      const gerada = await prepararPeriodo(2032, 1);
      const validada = await revisarEValidar(gerada.body);
      const id = gerada.body.escala.id as string;
      const corpoPublicacao = { revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true };

      const semConfirmacao = await http
        .post(`/escalas/${id}/publicar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: validada.body.escala.revisao })
        .expect(409);
      expect(semConfirmacao.body.pendencias.length).toBeGreaterThan(0);

      const publicada = await http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpoPublicacao).expect(200);
      expect(publicada.body.escala).toMatchObject({ status: 'publicada', versaoPublicada: 1 });
      const oficial = await http.get(`/escalas/${id}/versao-oficial`).set(auth(tokenCoord)).expect(200);
      expect(oficial.body.versao).toMatchObject({ numero: 1, pendenciasConfirmadas: true });
      expect(oficial.body.versao.publicadoPor).toBe(oficial.body.snapshot.escala.administradorId.toString());
      expect(oficial.body.snapshot.pendencias.length).toBeGreaterThan(0);

      const tokenTecnico = await login('rafael@nurseflow.com');
      const notificacoesEnfermeiro = await http.get('/notificacoes/escalas').set(auth(tokenEnf)).expect(200);
      expect(notificacoesEnfermeiro.body).toMatchObject({ naoLidas: 1, notificacoes: [expect.objectContaining({ versao: 1 })] });
      expect((await http.get('/notificacoes/escalas').set(auth(tokenTecnico)).expect(200)).body.notificacoes).toEqual([]);
      expect((await http.get('/notificacoes/escalas').set(auth(tokenCoord)).expect(200)).body.notificacoes).toEqual([]);
      expect(
        (await http.get(`/notificacoes/escalas/${id}/versoes/1`).set(auth(tokenEnf)).expect(200)).body.snapshot.visualizacao.escala.id,
      ).toBe(id);
      await http.get(`/notificacoes/escalas/${id}/versoes/1`).set(auth(tokenTecnico)).expect(404);

      await http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpoPublicacao).expect(200);
      expect(await colecao('versoesEscala').countDocuments({ escalaId: new mongoose.Types.ObjectId(id) })).toBe(1);
      expect(await colecao('auditoriaEscalas').countDocuments({ escalaId: new mongoose.Types.ObjectId(id), acao: 'escala_publicada' })).toBe(1);
      expect((await http.get('/notificacoes/escalas').set(auth(tokenEnf)).expect(200)).body.notificacoes).toHaveLength(1);

      const notificacaoId = notificacoesEnfermeiro.body.notificacoes[0].id as string;
      const marcadaComoLida = await http
        .patch(`/notificacoes/escalas/${notificacaoId}/lida`)
        .set(auth(tokenEnf))
        .expect(200);
      const marcadaNovamente = await http
        .patch(`/notificacoes/escalas/${notificacaoId}/lida`)
        .set(auth(tokenEnf))
        .expect(200);
      expect(marcadaNovamente.body.lidaEm).toBe(marcadaComoLida.body.lidaEm);
      expect((await http.get('/notificacoes/escalas').set(auth(tokenEnf)).expect(200)).body.naoLidas).toBe(0);
      await http.patch(`/notificacoes/escalas/${notificacaoId}/lida`).set(auth(tokenTecnico)).expect(404);

      const revisao = await http
        .post(`/escalas/${id}/revisao`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: publicada.body.escala.revisao })
        .expect(200);
      const plantaoOriginal = oficial.body.snapshot.plantoes[0];
      const editada = await http
        .patch(`/escalas/${id}/plantoes/${plantaoOriginal._id}`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: revisao.body.escala.revisao,
          setorId: setorPublicacao,
          data: '2032-01-05',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(200);
      const oficialDepois = await http.get(`/escalas/${id}/versao-oficial`).set(auth(tokenCoord)).expect(200);
      expect(oficialDepois.body.snapshot).toEqual(oficial.body.snapshot);

      const validadaNovaVersao = await http
        .post(`/escalas/${id}/validar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: editada.body.escala.revisao })
        .expect(200);
      const corpoSegundaPublicacao = { revisaoEsperada: validadaNovaVersao.body.escala.revisao, confirmarPendencias: true };
      await http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpoSegundaPublicacao).expect(200);
      await http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpoSegundaPublicacao).expect(200);
      expect(await colecao('versoesEscala').countDocuments({ escalaId: new mongoose.Types.ObjectId(id) })).toBe(2);
      const primeiraVersao = await colecao('versoesEscala').findOne({ escalaId: new mongoose.Types.ObjectId(id), numero: 1 });
      expect(JSON.parse(JSON.stringify(primeiraVersao?.snapshot))).toEqual(oficial.body.snapshot);
      const notificacoesAtualizadas = await http.get('/notificacoes/escalas').set(auth(tokenEnf)).expect(200);
      expect(notificacoesAtualizadas.body).toMatchObject({ naoLidas: 1, notificacoes: [expect.objectContaining({ versao: 2 }), expect.objectContaining({ versao: 1 })] });
      expect((await http.get('/notificacoes/escalas').set(auth(tokenTecnico)).expect(200)).body.notificacoes).toEqual([]);
    });

    it('mantém publicação e notificações idempotentes em requisições concorrentes', async () => {
      const gerada = await prepararPeriodo(2032, 3);
      const validada = await revisarEValidar(gerada.body);
      const id = gerada.body.escala.id as string;
      const escalaId = new mongoose.Types.ObjectId(id);
      const corpo = { revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true };

      const respostas = await Promise.all([
        http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpo),
        http.post(`/escalas/${id}/publicar`).set(auth(tokenCoord)).send(corpo),
      ]);

      expect(respostas.map((resposta) => resposta.status)).toEqual([200, 200]);
      expect(await colecao('versoesEscala').countDocuments({ escalaId })).toBe(1);
      expect(await colecao('auditoriaEscalas').countDocuments({ escalaId, acao: 'escala_publicada' })).toBe(1);
      const notificacoes = await colecao('notificacoesEscala').find({ escalaId, versao: 1 }).toArray();
      expect(notificacoes.length).toBeGreaterThan(0);
      expect(new Set(notificacoes.map((notificacao) => String(notificacao.destinatarioId))).size).toBe(notificacoes.length);
    });

    it('bloqueia a publicação quando uma alocação viola o descanso obrigatório', async () => {
      const gerada = await prepararPeriodo(2032, 2);
      const validada = await revisarEValidar(gerada.body);
      const id = gerada.body.escala.id as string;
      const escalaId = new mongoose.Types.ObjectId(id);
      const plantaoOriginal = await colecao('plantoes').findOne({ escalaId, tipo: 'regular' });
      expect(plantaoOriginal).not.toBeNull();

      const plantaoConflitanteId = new mongoose.Types.ObjectId();
      await colecao('plantoes').insertOne({
        ...plantaoOriginal,
        _id: plantaoConflitanteId,
        data: new Date(Date.UTC(2032, 1, 2)),
      });
      await colecao('profissionaisRelacionados').insertOne({
        plantaoId: plantaoConflitanteId,
        profissionalId: new mongoose.Types.ObjectId(idEnf),
        funcao: 'enfermeiro',
      });

      const resposta = await http
        .post(`/escalas/${id}/publicar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true })
        .expect(422);
      expect(resposta.body.message).toMatch(/conflitos bloqueantes/);
      expect(await colecao('versoesEscala').countDocuments({ escalaId })).toBe(0);
    });

    it('exporta PDF geral e documentos separados por setor, e recusa escalas não publicadas', async () => {
      const gerada = await prepararPeriodo(2032, 4, [setorPublicacao, setorPublicacaoB]);
      const validada = await revisarEValidar(gerada.body);
      const id = gerada.body.escala.id as string;
      const publicada = await http
        .post(`/escalas/${id}/publicar`)
        .set(auth(tokenCoord))
        .send({ revisaoEsperada: validada.body.escala.revisao, confirmarPendencias: true })
        .expect(200);
      expect(publicada.body.escala.status).toBe('publicada');

      const geral = await http
        .get(`/escalas/${id}/pdf`)
        .set(auth(tokenCoord))
        .buffer(true)
        .parse((res, callback) => {
          const partes: Buffer[] = [];
          res.on('data', (parte) => partes.push(Buffer.from(parte)));
          res.on('end', () => callback(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(geral.headers['content-type']).toContain('application/pdf');
      expect(geral.headers['content-disposition']).toContain('escala-2032-04-geral.pdf');
      expect(geral.body.subarray(0, 5).toString()).toBe('%PDF-');
      const textoPdf = (pdf: Buffer) =>
        [...pdf.toString('latin1').matchAll(/<([0-9a-f]+)>/gi)]
          .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
          .join('');
      expect(textoPdf(geral.body)).toContain('ESCALA MENSAL');
      expect(textoPdf(geral.body)).toContain('PEND');
      expect(textoPdf(geral.body)).toContain('Coordena');
      expect(textoPdf(geral.body)).toContain('Diretoria');

      const setorA = await http
        .get(`/escalas/${id}/pdf?setorId=${setorPublicacao}`)
        .set(auth(tokenCoord))
        .buffer(true)
        .parse((res, callback) => {
          const partes: Buffer[] = [];
          res.on('data', (parte) => partes.push(Buffer.from(parte)));
          res.on('end', () => callback(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(setorA.headers['content-type']).toContain('application/pdf');
      expect(setorA.headers['content-disposition']).toContain('setor-de-teste-de-publicacao.pdf');
      expect(textoPdf(setorA.body)).toContain('Setor de teste de publica');
      expect(textoPdf(setorA.body)).not.toContain('Setor de teste de PDF');

      const setoresZip = await http
        .get(`/escalas/${id}/pdf?separarPorSetor=true`)
        .set(auth(tokenCoord))
        .buffer(true)
        .parse((res, callback) => {
          const partes: Buffer[] = [];
          res.on('data', (parte) => partes.push(Buffer.from(parte)));
          res.on('end', () => callback(null, Buffer.concat(partes)));
        })
        .expect(200);
      expect(setoresZip.headers['content-type']).toContain('application/zip');
      expect(setoresZip.body.subarray(0, 2).toString()).toBe('PK');
      expect(setoresZip.body.toString('latin1')).toContain('setor-de-teste-de-publicacao.pdf');
      expect(setoresZip.body.toString('latin1')).toContain('setor-de-teste-de-pdf.pdf');
      await http.get(`/escalas/${id}/pdf?setorId=${setorPublicacao}&separarPorSetor=true`).set(auth(tokenCoord)).expect(400);

      const rascunho = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2032, mes: 5 }).expect(201);
      await http.get(`/escalas/${rascunho.body.escala.id}/pdf`).set(auth(tokenCoord)).expect(404);
      await http.get('/escalas/64b7f0f0f0f0f0f0f0f0f0f0/pdf').set(auth(tokenCoord)).expect(404);
    });
  });

  describe('limite de carga em plantões manuais', () => {
    it('rejeita o excesso de carga sem gravar vínculo ou plantão parcial', async () => {
      await http.patch('/configuracoes/limites?ano=2027&mes=1').set(auth(tokenCoord)).send({ limitePlantoes: 1, maxExtras: 0 }).expect(200);
      await configurarCargas(2027, 1, 1).expect(200);
      const escala = await http.post('/escalas').set(auth(tokenCoord)).send({ ano: 2027, mes: 1 }).expect(201);
      const escalaId = escala.body.escala.id as string;
      const primeiro = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: escala.body.escala.revisao,
          setorId: (await colecao('setores').findOne({ nome: 'UTI' }))?._id.toString(),
          data: '2027-01-01',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(201);
      const escalaObjId = new mongoose.Types.ObjectId(escalaId);
      const plantaoId = new mongoose.Types.ObjectId(primeiro.body.plantoes[0].id);

      const excesso = await http
        .post(`/escalas/${escalaId}/plantoes`)
        .set(auth(tokenCoord))
        .send({
          revisaoEsperada: primeiro.body.escala.revisao,
          setorId: primeiro.body.plantoes[0].setor.id,
          data: '2027-01-05',
          opcao: '24h',
          tipo: 'regular',
          equipe: [{ profissionalId: idEnf, funcao: 'enfermeiro' }],
        })
        .expect(422);
      expect(excesso.body.erros.join(' ')).toMatch(/carga regular|limite total/);
      expect(await colecao('plantoes').countDocuments({ escalaId: escalaObjId })).toBe(1);
      expect(await colecao('profissionaisRelacionados').countDocuments({ plantaoId })).toBe(1);
      await http
        .delete(`/escalas/${escalaId}`)
        .set(auth(tokenCoord))
        .send({ confirmar: true, revisaoEsperada: primeiro.body.escala.revisao })
        .expect(204);
    });
  });

  describe('falhas do otimizador', () => {
    it('interrompe a geração solicitada e não persiste escala parcial', async () => {
      await configurarCargas(2026, 12, 7).expect(200);
      const setor = await http
        .post('/setores')
        .set(auth(tokenCoord))
        .send({
          nome: 'Setor de teste de cancelamento',
          turnos: { diurno: { enfermeiros: 1, tecnicos: 0 }, noturno: { enfermeiros: 1, tecnicos: 0 } },
        })
        .expect(201);
      const plantoesAntes = await colecao('plantoes').countDocuments();
      const operacaoId = 'c2c75b7e-f622-4a14-8d55-2e5e2c36cb02';
      otimizador.bloquear = true;
      const iniciou = otimizador.aguardarInicio();
      const geracao = gerar({ mes: 12, ano: 2026, operacaoId });
      const geracaoPendente = geracao.then((resposta) => resposta);
      try {
        await iniciou;
        await http.delete(`/escalas/gerar/${operacaoId}`).set(auth(tokenCoord)).expect(202);
        const resposta = await geracaoPendente;
        expect(resposta.status).toBe(409);
        expect(resposta.body.message).toMatch(/cancelada/i);
        expect(otimizador.cancelamentos).toContain(operacaoId);
      } finally {
        otimizador.bloquear = false;
        await http.patch(`/setores/${setor.body.id}/inativar`).set(auth(tokenCoord)).expect(200);
      }
      expect(await colecao('escalas').countDocuments({ ano: 2026, mes: 12 })).toBe(0);
      expect(await colecao('plantoes').countDocuments()).toBe(plantoesAntes);
    });

    it('faz rollback da escala e dos plantões quando falha a gravação dos vínculos', async () => {
      await configurarCargas(2026, 12, 7).expect(200);
      const escalasAntes = await colecao('escalas').countDocuments();
      const plantoesAntes = await colecao('plantoes').countDocuments();
      const vinculosAntes = await colecao('profissionaisRelacionados').countDocuments();
      otimizador.duplicarVinculo = true;
      try {
        await gerar({ mes: 12, ano: 2026 }).expect(409);
      } finally {
        otimizador.duplicarVinculo = false;
      }
      expect(await colecao('escalas').countDocuments()).toBe(escalasAntes);
      expect(await colecao('plantoes').countDocuments()).toBe(plantoesAntes);
      expect(await colecao('profissionaisRelacionados').countDocuments()).toBe(vinculosAntes);
    });

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
