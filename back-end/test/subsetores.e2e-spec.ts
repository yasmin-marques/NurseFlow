import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { SenhaNotifier } from '../src/auth/senha-notifier';
import { Profissional } from '../src/profissionais/schemas/profissional.schema';
import { Setor } from '../src/setores/schemas/setor.schema';
import { TipoUsuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-da-coordenacao';

describe('Subsetores e vínculo de profissionais (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token: string;

  // Setor COM subsetores (UTI: Adulto 2 + Intermediária 1) e setor SEM subsetores (Emergência).
  let uti: { id: string; subsetores: { id: string; nome: string }[] };
  let emergenciaId: string;
  let outroSetorComSubsetores: { id: string; subsetorId: string };

  const auth = () => ({ Authorization: `Bearer ${token}` });
  let seq = 0;
  // CPF válido determinístico a partir de uma base de 9 dígitos.
  const cpfDe = (base9: number) => {
    const digitos = String(base9).padStart(9, '0').split('').map(Number);
    for (let tamanho = 9; tamanho < 11; tamanho++) {
      const soma = digitos.reduce((total, d, i) => (i < tamanho ? total + d * (tamanho + 1 - i) : total), 0);
      const resto = (soma * 10) % 11;
      digitos.push(resto === 10 ? 0 : resto);
    }
    return digitos.join('');
  };
  const novo = (sobrescrever: Record<string, unknown> = {}) => {
    seq += 1;
    return {
      nome: `Profissional Teste ${seq}`,
      cpf: cpfDe(500000000 + seq),
      email: `prof${seq}@nurseflow.com`,
      coren: `COREN-CE ${700000 + seq}`,
      formacao: 'tecnico',
      tipoVinculo: 'clt',
      ...sobrescrever,
    };
  };
  const criarSetor = (corpo: Record<string, unknown>) => http.post('/setores').set(auth()).send(corpo);

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_subsetores');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    process.env.PROFISSIONAL_SENHA_PADRAO = 'senha-do-profissional';
    const { AppModule } = await import('../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SenhaNotifier)
      .useValue({ enviarTokenRedefinicao: () => Promise.resolve() })
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());

    const usuarios = app.get(UsuariosService);
    const coordenacao = await usuarios.criar({
      nome: 'Coordenação',
      email: 'coordenacao@nurseflow.com',
      cpf: '11144477735',
      senha: await AuthService.gerarHashSenha(SENHA),
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
    });
    await usuarios.criarAdministrador(coordenacao._id);
    token = (await http.post('/auth/login').send({ email: 'coordenacao@nurseflow.com', senha: SENHA, perfil: 'coordenacao' })).body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await banco?.parar();
  });

  describe('Dimensionamento de setores e subsetores', () => {
    it('setor sem subsetores define os dois mínimos', async () => {
      const res = await criarSetor({ nome: 'Emergência', plantao24h: { enfermeiros: 2, tecnicos: 3 } }).expect(201);
      emergenciaId = res.body.id;
      expect(res.body).toMatchObject({ possuiSubsetores: false, plantao24h: { enfermeiros: 2, tecnicos: 3 }, subsetores: [], tecnicosSemSubsetor: 0 });
    });

    it('setor sem subsetores exige o mínimo de técnicos', async () => {
      await criarSetor({ nome: 'Sem técnicos', plantao24h: { enfermeiros: 2 } }).expect(400);
    });

    it('setor com subsetores define só os enfermeiros; cada subsetor define seus técnicos', async () => {
      const res = await criarSetor({
        nome: 'UTI',
        plantao24h: { enfermeiros: 2 },
        subsetores: [
          { nome: 'UTI Adulto', plantao24h: { tecnicos: 2 } },
          { nome: 'UTI Intermediária', plantao24h: { tecnicos: 1 } },
        ],
      }).expect(201);
      expect(res.body).toMatchObject({ possuiSubsetores: true, plantao24h: { enfermeiros: 2, tecnicos: null } });
      expect(res.body.subsetores.map((s: { nome: string; plantao24h: unknown }) => [s.nome, s.plantao24h])).toEqual([
        ['UTI Adulto', { tecnicos: 2 }],
        ['UTI Intermediária', { tecnicos: 1 }],
      ]);
      uti = { id: res.body.id, subsetores: res.body.subsetores };
    });

    it('mantém o mínimo de técnicos do setor derivado no banco (soma dos subsetores ativos) para o módulo de escalas', async () => {
      const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
      const doc = await setorModel.findById(uti.id).lean();
      expect(doc?.plantao24h).toEqual({ enfermeiros: 2, tecnicos: 3 });
    });

    it('rejeita mínimo próprio de técnicos em setor com subsetores (cadastro e edição)', async () => {
      await criarSetor({
        nome: 'Setor inválido',
        plantao24h: { enfermeiros: 1, tecnicos: 4 },
        subsetores: [{ nome: 'A', plantao24h: { tecnicos: 1 } }],
      }).expect(400);
      await http.patch(`/setores/${uti.id}`).set(auth()).send({ plantao24h: { tecnicos: 9 } }).expect(400);
      const ok = await http.patch(`/setores/${uti.id}`).set(auth()).send({ plantao24h: { enfermeiros: 3 } }).expect(200);
      expect(ok.body.plantao24h).toEqual({ enfermeiros: 3, tecnicos: null });
    });

    it('subsetor não tem mínimo de enfermeiros (campo é ignorado/rejeitado pela validação do DTO)', async () => {
      const res = await http.post(`/setores/${uti.id}/subsetores`).set(auth())
        .send({ nome: 'UTI Pediátrica', plantao24h: { tecnicos: 1, enfermeiros: 2 } });
      expect(res.status).toBe(400);
    });

    it('rejeita subsetores com nomes repetidos no cadastro e no mesmo setor', async () => {
      await criarSetor({
        nome: 'Duplicados',
        plantao24h: { enfermeiros: 1 },
        subsetores: [{ nome: 'Ala', plantao24h: { tecnicos: 1 } }, { nome: 'ala', plantao24h: { tecnicos: 1 } }],
      }).expect(409);
      await http.post(`/setores/${uti.id}/subsetores`).set(auth()).send({ nome: 'uti adulto', plantao24h: { tecnicos: 1 } }).expect(409);
    });

    it('edita o mínimo de um subsetor e recalcula o derivado do setor', async () => {
      const [adulto] = uti.subsetores;
      const res = await http.patch(`/setores/${uti.id}/subsetores/${adulto.id}`).set(auth()).send({ plantao24h: { tecnicos: 4 } }).expect(200);
      expect(res.body.plantao24h.tecnicos).toBeNull();
      const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
      expect((await setorModel.findById(uti.id).lean())?.plantao24h.tecnicos).toBe(5);
      await http.patch(`/setores/${uti.id}/subsetores/${adulto.id}`).set(auth()).send({ plantao24h: { tecnicos: 2 } }).expect(200);
    });

    it('edita enfermeiros e o mínimo de cada subsetor em uma única operação, sem alterar os demais campos', async () => {
      const [adulto, intermediaria] = uti.subsetores;
      const res = await http.patch(`/setores/${uti.id}`).set(auth()).send({
        plantao24h: { enfermeiros: 4 },
        subsetores: [{ id: adulto.id, plantao24h: { tecnicos: 5 } }, { id: intermediaria.id, plantao24h: { tecnicos: 3 } }],
      }).expect(200);
      expect(res.body.plantao24h).toEqual({ enfermeiros: 4, tecnicos: null });
      expect(res.body.subsetores.map((s: { nome: string; plantao24h: unknown }) => [s.nome, s.plantao24h])).toEqual([
        ['UTI Adulto', { tecnicos: 5 }],
        ['UTI Intermediária', { tecnicos: 3 }],
      ]);
      expect(res.body.nome).toBe('UTI');
      const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
      expect((await setorModel.findById(uti.id).lean())?.plantao24h).toEqual({ enfermeiros: 4, tecnicos: 8 });

      // restaura os valores usados pelos testes seguintes
      await http.patch(`/setores/${uti.id}`).set(auth()).send({
        plantao24h: { enfermeiros: 3 },
        subsetores: [{ id: adulto.id, plantao24h: { tecnicos: 2 } }, { id: intermediaria.id, plantao24h: { tecnicos: 1 } }],
      }).expect(200);
    });

    it('rejeita a edição conjunta (sem gravar nada) se algum subsetor for de outro setor', async () => {
      const outro = await criarSetor({ nome: 'Hemodinâmica', plantao24h: { enfermeiros: 1 }, subsetores: [{ nome: 'Sala H', plantao24h: { tecnicos: 1 } }] }).expect(201);
      const [adulto] = uti.subsetores;
      await http.patch(`/setores/${uti.id}`).set(auth()).send({
        plantao24h: { enfermeiros: 9 },
        subsetores: [{ id: adulto.id, plantao24h: { tecnicos: 9 } }, { id: outro.body.subsetores[0].id, plantao24h: { tecnicos: 9 } }],
      }).expect(404);
      const atual = await http.get(`/setores/${uti.id}`).set(auth()).expect(200);
      expect(atual.body.plantao24h.enfermeiros).toBe(3);
      expect(atual.body.subsetores[0].plantao24h.tecnicos).toBe(2);
      // setor sem subsetores não aceita mínimos por subsetor
      await http.patch(`/setores/${emergenciaId}`).set(auth()).send({ subsetores: [{ id: adulto.id, plantao24h: { tecnicos: 1 } }] }).expect(400);
    });

    it('não opera subsetor de outro setor pela rota', async () => {
      const outro = await criarSetor({ nome: 'Centro Cirúrgico', plantao24h: { enfermeiros: 1 }, subsetores: [{ nome: 'Sala 1', plantao24h: { tecnicos: 1 } }] }).expect(201);
      outroSetorComSubsetores = { id: outro.body.id, subsetorId: outro.body.subsetores[0].id };
      await http.patch(`/setores/${uti.id}/subsetores/${outroSetorComSubsetores.subsetorId}`).set(auth()).send({ nome: 'Nome Novo' }).expect(404);
    });

    it('listagem expõe possuiSubsetores e subsetores por setor', async () => {
      const lista = await http.get('/setores').set(auth()).expect(200);
      const porNome = Object.fromEntries(lista.body.map((s: { nome: string }) => [s.nome, s]));
      expect(porNome['UTI'].subsetores).toHaveLength(2);
      expect(porNome['Emergência'].possuiSubsetores).toBe(false);
    });
  });

  describe('Vínculo dos profissionais', () => {
    it('técnico de setor sem subsetores fica vinculado diretamente ao setor', async () => {
      const res = await http.post('/profissionais').set(auth()).send(novo({ setorId: emergenciaId })).expect(201);
      expect(res.body).toMatchObject({ setorId: emergenciaId, setorNome: 'Emergência', subsetorId: null, subsetorNome: null });
    });

    it('técnico de setor sem subsetores não aceita subsetor', async () => {
      await http.post('/profissionais').set(auth()).send(novo({ setorId: emergenciaId, subsetorId: uti.subsetores[0].id })).expect(422);
    });

    it('técnico de setor com subsetores pode escolher subsetor válido ou nenhum', async () => {
      const sem = await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id })).expect(201);
      expect(sem.body.subsetorId).toBeNull();
      const res = await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id, subsetorId: uti.subsetores[0].id })).expect(201);
      expect(res.body).toMatchObject({ setorId: uti.id, subsetorId: uti.subsetores[0].id, subsetorNome: 'UTI Adulto' });
    });

    it('rejeita múltiplos setores ou subsetores para ambas as formações', async () => {
      for (const formacao of ['enfermeiro', 'tecnico']) {
        const setores = await http.post('/profissionais').set(auth()).send(novo({ formacao, setorId: [uti.id, emergenciaId] })).expect(400);
        expect(JSON.stringify(setores.body)).toMatch(/Setor inválido/);
        const subsetores = await http.post('/profissionais').set(auth()).send(novo({ formacao, setorId: uti.id, subsetorId: [uti.subsetores[0].id, uti.subsetores[1].id] })).expect(400);
        expect(JSON.stringify(subsetores.body)).toMatch(/Subsetor inválido/);
      }
    });

    it('não vincula profissional a subsetor de outro setor', async () => {
      const res = await http.post('/profissionais').set(auth())
        .send(novo({ setorId: uti.id, subsetorId: outroSetorComSubsetores.subsetorId })).expect(422);
      expect(JSON.stringify(res.body)).toMatch(/outro setor/);
    });

    it('rejeita subsetor inexistente e identificador inválido', async () => {
      await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id, subsetorId: '64b7f0c2a1b2c3d4e5f60718' })).expect(422);
      await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id, subsetorId: 'abc' })).expect(400);
    });

    it('enfermeiro fica vinculado ao setor (com ou sem subsetores) e nunca a subsetor', async () => {
      const emSetorComSubsetores = await http.post('/profissionais').set(auth()).send(novo({ formacao: 'enfermeiro', setorId: uti.id })).expect(201);
      expect(emSetorComSubsetores.body).toMatchObject({ setorId: uti.id, subsetorId: null });
      const emSetorSemSubsetores = await http.post('/profissionais').set(auth()).send(novo({ formacao: 'enfermeiro', setorId: emergenciaId })).expect(201);
      expect(emSetorSemSubsetores.body).toMatchObject({ setorId: emergenciaId, subsetorId: null });
      await http.post('/profissionais').set(auth()).send(novo({ formacao: 'enfermeiro', setorId: uti.id, subsetorId: uti.subsetores[0].id })).expect(422);
      await http.patch(`/profissionais/${emSetorComSubsetores.body.id}`).set(auth()).send({ subsetorId: uti.subsetores[0].id }).expect(422);
    });

    it('rejeita subsetor na edição de profissional legado sem setor', async () => {
      const criado = await http.post('/profissionais').set(auth()).send(novo({ formacao: 'enfermeiro', setorId: uti.id })).expect(201);
      const model = app.get<Model<Profissional>>(getModelToken(Profissional.name));
      await model.updateOne({ _id: criado.body.id }, { $set: { setorId: null } });
      const res = await http.patch(`/profissionais/${criado.body.id}`).set(auth()).send({ subsetorId: uti.subsetores[0].id }).expect(422);
      expect(JSON.stringify(res.body)).toMatch(/Selecione um setor antes/);
    });

    it('persiste setorId e subsetorId no banco', async () => {
      const profissionalModel = app.get<Model<Profissional>>(getModelToken(Profissional.name));
      const tecnicos = await profissionalModel.find({ formacao: 'tecnico' }).lean();
      expect(tecnicos.every((t) => t.setorId)).toBe(true);
      expect(tecnicos.some((t) => String(t.setorId) === uti.id && String(t.subsetorId) === uti.subsetores[0].id)).toBe(true);
      expect(tecnicos.find((t) => String(t.setorId) === emergenciaId)?.subsetorId).toBeNull();
    });

    it('edição: troca de setor não herda subsetor e permite ausência de subsetor', async () => {
      const criado = await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id, subsetorId: uti.subsetores[0].id })).expect(201);
      const id = criado.body.id;
      // para o setor sem subsetores: subsetor antigo é descartado
      const semSub = await http.patch(`/profissionais/${id}`).set(auth()).send({ setorId: emergenciaId }).expect(200);
      expect(semSub.body).toMatchObject({ setorId: emergenciaId, subsetorId: null });
      const voltou = await http.patch(`/profissionais/${id}`).set(auth()).send({ setorId: uti.id }).expect(200);
      expect(voltou.body).toMatchObject({ setorId: uti.id, subsetorId: null });
      await http.patch(`/profissionais/${id}`).set(auth()).send({ setorId: [uti.id, emergenciaId] }).expect(400);
      await http.patch(`/profissionais/${id}`).set(auth()).send({ subsetorId: [uti.subsetores[0].id, uti.subsetores[1].id] }).expect(400);
      // com subsetor de outro setor: rejeitado
      await http.patch(`/profissionais/${id}`).set(auth()).send({ setorId: uti.id, subsetorId: outroSetorComSubsetores.subsetorId }).expect(422);
      const ok = await http.patch(`/profissionais/${id}`).set(auth()).send({ setorId: uti.id, subsetorId: uti.subsetores[1].id }).expect(200);
      expect(ok.body).toMatchObject({ setorId: uti.id, subsetorId: uti.subsetores[1].id, subsetorNome: 'UTI Intermediária' });
      // trocar apenas o subsetor dentro do setor
      const troca = await http.patch(`/profissionais/${id}`).set(auth()).send({ subsetorId: uti.subsetores[0].id }).expect(200);
      expect(troca.body.subsetorId).toBe(uti.subsetores[0].id);
      // virar enfermeiro descarta o subsetor herdado
      const enf = await http.patch(`/profissionais/${id}`).set(auth()).send({ formacao: 'enfermeiro' }).expect(200);
      expect(enf.body).toMatchObject({ formacao: 'enfermeiro', setorId: uti.id, subsetorId: null });
    });

    it('filtra a listagem por subsetor', async () => {
      const lista = await http.get(`/profissionais?subsetorId=${uti.subsetores[0].id}`).set(auth()).expect(200);
      expect(lista.body.data.length).toBeGreaterThan(0);
      expect(lista.body.data.every((p: { subsetorId: string }) => p.subsetorId === uti.subsetores[0].id)).toBe(true);
    });
  });

  describe('Pendências de adequação e ciclo de vida', () => {
    it('setor que ganha subsetores deixa técnicos pendentes, sem atribuição automática', async () => {
      const profissionalModel = app.get<Model<Profissional>>(getModelToken(Profissional.name));
      const antes = await profissionalModel.countDocuments({ setorId: new Types.ObjectId(emergenciaId), formacao: 'tecnico' });
      expect(antes).toBeGreaterThan(0);

      const res = await http.post(`/setores/${emergenciaId}/subsetores`).set(auth()).send({ nome: 'Observação', plantao24h: { tecnicos: 2 } }).expect(201);
      expect(res.body).toMatchObject({ possuiSubsetores: true, tecnicosSemSubsetor: antes });
      expect(res.body.plantao24h.tecnicos).toBeNull();

      const pendentes = await http.get('/profissionais?semSubsetor=true').set(auth()).expect(200);
      expect(pendentes.body.data.filter((p: { setorId: string }) => p.setorId === emergenciaId)).toHaveLength(antes);
      expect(pendentes.body.data.every((p: { subsetorId: unknown }) => p.subsetorId === null)).toBe(true);
      // Nenhum subsetor foi atribuído automaticamente.
      expect(await profissionalModel.countDocuments({ setorId: new Types.ObjectId(emergenciaId), subsetorId: { $ne: null } })).toBe(0);
    });

    it('não inativa subsetor com profissionais vinculados nem o único subsetor ativo', async () => {
      await http.patch(`/setores/${uti.id}/subsetores/${uti.subsetores[0].id}/inativar`).set(auth()).expect(409);
      await http.patch(`/setores/${outroSetorComSubsetores.id}/subsetores/${outroSetorComSubsetores.subsetorId}/inativar`).set(auth()).expect(409);
    });

    it('inativa subsetor sem profissionais, recalcula o derivado e impede novos vínculos a ele', async () => {
      const novoSub = await http.post(`/setores/${uti.id}/subsetores`).set(auth()).send({ nome: 'UTI Pediátrica', plantao24h: { tecnicos: 1 } }).expect(201);
      const pediatrica = novoSub.body.subsetores.find((s: { nome: string }) => s.nome === 'UTI Pediátrica');
      const setorModel = app.get<Model<Setor>>(getModelToken(Setor.name));
      expect((await setorModel.findById(uti.id).lean())?.plantao24h.tecnicos).toBe(4);

      await http.patch(`/setores/${uti.id}/subsetores/${pediatrica.id}/inativar`).set(auth()).expect(200);
      expect((await setorModel.findById(uti.id).lean())?.plantao24h.tecnicos).toBe(3);
      await http.post('/profissionais').set(auth()).send(novo({ setorId: uti.id, subsetorId: pediatrica.id })).expect(422);

      await http.patch(`/setores/${uti.id}/subsetores/${pediatrica.id}/ativar`).set(auth()).expect(200);
      expect((await setorModel.findById(uti.id).lean())?.plantao24h.tecnicos).toBe(4);
    });
  });

  it('somente a Coordenação acessa as rotas de subsetores', async () => {
    await http.post(`/setores/${uti.id}/subsetores`).send({ nome: 'X', plantao24h: { tecnicos: 1 } }).expect(401);
  });
});
