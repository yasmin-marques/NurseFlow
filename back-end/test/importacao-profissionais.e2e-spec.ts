import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { type Model } from 'mongoose';
import request from 'supertest';
import { configurarApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { SenhaNotifier } from '../src/auth/senha-notifier';
import { ProfissionaisService } from '../src/profissionais/profissionais.service';
import { Profissional } from '../src/profissionais/schemas/profissional.schema';
import { TipoUsuario, Usuario } from '../src/usuarios/schemas/usuario.schema';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { aplicarMigrations, type BancoDeTeste, iniciarBanco } from './helpers';

const SENHA = 'senha-da-coordenacao';
const CABECALHO = ['Nome completo *', 'CPF *', 'COREN *', 'E-mail *', 'Formação *', 'Tipo de vínculo *', 'Setor *', 'Subsetor', 'Situação'];

type Linha = (string | number | null)[];

async function planilha(linhas: Linha[], cabecalho: string[] = CABECALHO): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const aba = workbook.addWorksheet('Profissionais');
  aba.addRow(cabecalho);
  linhas.forEach((linha) => aba.addRow(linha));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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
const mascara = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

describe('Importação de profissionais por planilha (e2e)', () => {
  let banco: BancoDeTeste;
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let token: string;
  let profissionalModel: Model<Profissional>;
  let usuarioModel: Model<Usuario>;
  let emergenciaId: string;
  let uti: { id: string; subsetores: { id: string; nome: string }[] };

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const previa = (arquivo: Buffer, nome = 'profissionais.xlsx') => http.post('/profissionais/importacao/previa').set(auth()).attach('arquivo', arquivo, nome);
  const importar = (arquivo: Buffer, nome = 'profissionais.xlsx') => http.post('/profissionais/importacao').set(auth()).attach('arquivo', arquivo, nome);
  const contar = () => profissionalModel.countDocuments();
  const porCpf = async (cpf: string) => {
    const usuario = await usuarioModel.findOne({ cpf });
    const profissional = usuario ? await profissionalModel.findOne({ usuarioId: usuario._id }) : null;
    return { usuario, profissional };
  };

  let seq = 0;
  /** Linha completa de um novo técnico no setor/subsetor informados. */
  const novo = (sobrescrever: Partial<Record<string, string | number>> = {}): Linha & { cpf: string } => {
    seq += 1;
    const cpf = cpfDe(600000000 + seq);
    const base = {
      nome: `Importado Teste ${seq}`,
      cpf: mascara(cpf),
      coren: `COREN-CE ${800000 + seq}`,
      email: `importado${seq}@nurseflow.com`,
      formacao: 'Técnico de enfermagem',
      vinculo: 'CLT',
      setor: 'Emergência',
      subsetor: '',
      status: '',
      ...sobrescrever,
    };
    return Object.assign([base.nome, base.cpf, base.coren, base.email, base.formacao, base.vinculo, base.setor, base.subsetor, base.status], { cpf });
  };

  beforeAll(async () => {
    banco = await iniciarBanco('nurseflow_importacao');
    await aplicarMigrations(banco.uri);
    process.env.MONGODB_URI = banco.uri;
    process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres';
    process.env.PROFISSIONAL_SENHA_PADRAO = 'senha-padrao-teste';
    const { AppModule } = await import('../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SenhaNotifier)
      .useValue({ enviarTokenRedefinicao: () => Promise.resolve() })
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
    http = request(app.getHttpServer());
    profissionalModel = app.get<Model<Profissional>>(getModelToken(Profissional.name));
    usuarioModel = app.get<Model<Usuario>>(getModelToken(Usuario.name));

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

    emergenciaId = (await http.post('/setores').set(auth()).send({ nome: 'Emergência', plantao24h: { enfermeiros: 2, tecnicos: 3 } }).expect(201)).body.id;
    const resposta = await http.post('/setores').set(auth()).send({
      nome: 'UTI',
      plantao24h: { enfermeiros: 2 },
      subsetores: [
        { nome: 'UTI Adulto', plantao24h: { tecnicos: 2 } },
        { nome: 'UTI Intermediária', plantao24h: { tecnicos: 1 } },
      ],
    }).expect(201);
    uti = { id: resposta.body.id, subsetores: resposta.body.subsetores };
    const inativo = await http.post('/setores').set(auth()).send({ nome: 'Setor Inativo', plantao24h: { enfermeiros: 1, tecnicos: 1 } }).expect(201);
    await http.patch(`/setores/${inativo.body.id}/inativar`).set(auth()).expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await banco?.parar();
  });

  describe('modelo de planilha', () => {
    it('baixa um .xlsx com cabeçalho, instruções e listas reais de setores/subsetores', async () => {
      const res = await http.get('/profissionais/importacao/modelo').set(auth()).buffer(true).parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (parte: Buffer) => partes.push(parte));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      }).expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('.xlsx');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      expect(workbook.worksheets.map((aba) => aba.name)).toEqual(['Profissionais', 'Listas', 'Instruções']);
      const cabecalho = workbook.getWorksheet('Profissionais')!.getRow(1).values as string[];
      expect(cabecalho.slice(1)).toEqual(CABECALHO);
      const listas = workbook.getWorksheet('Listas')!;
      const setores = listas.getColumn(1).values.slice(2);
      expect(setores).toEqual(expect.arrayContaining(['Emergência', 'UTI']));
      expect(setores).not.toContain('Setor Inativo');
      expect(listas.getColumn(2).values).toEqual(expect.arrayContaining(['UTI Adulto', 'UTI Intermediária']));
      // Matriz da lista dependente: coluna do setor (cabeçalho) com apenas os seus subsetores.
      expect(listas.getCell('E1').value).toBe('UTI');
      expect([listas.getCell('E2').value, listas.getCell('E3').value]).toEqual(['UTI Adulto', 'UTI Intermediária']);
      const validacao = workbook.getWorksheet('Profissionais')!.getCell('H2').dataValidation;
      expect(validacao.type).toBe('list');
      expect(validacao.formulae![0]).toBe('IFERROR(INDIRECT(VLOOKUP($G2,Listas!$AD$2:$AE$200,2,FALSE)),INDIRECT("SUBSETORES_VAZIO"))');
      expect(listas.getCell('AD2').value).toBe('UTI');
      expect(listas.getCell('AE2').value).toBe('SUBSETORES_1');
      expect(workbook.definedNames.getRanges('SUBSETORES_1').ranges).toEqual(['Listas!$E$2:$E$3']);
    });

    it('o modelo preenchido é aceito pela importação', async () => {
      const res = await http.get('/profissionais/importacao/modelo').set(auth()).buffer(true).parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (parte: Buffer) => partes.push(parte));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      const linha = novo();
      workbook.getWorksheet('Profissionais')!.addRow(linha);
      const arquivo = Buffer.from(await workbook.xlsx.writeBuffer());
      const resposta = await previa(arquivo).expect(200);
      expect(resposta.body.resumo).toMatchObject({ total: 1, novos: 1, invalidos: 0 });
    });
  });

  describe('autorização e arquivo', () => {
    it('exige autenticação', async () => {
      await http.get('/profissionais/importacao/modelo').expect(401);
      await http.post('/profissionais/importacao/previa').attach('arquivo', await planilha([novo()]), 'a.xlsx').expect(401);
      await http.post('/profissionais/importacao').attach('arquivo', await planilha([novo()]), 'a.xlsx').expect(401);
    });

    it('nega acesso a profissionais da saúde (somente Coordenação importa)', async () => {
      await http.post('/profissionais').set(auth()).send({
        nome: 'Enfermeira Comum', cpf: cpfDe(777000001), email: 'comum@nurseflow.com', coren: 'COREN-CE 999001',
        formacao: 'enfermeiro', tipoVinculo: 'clt', setorId: emergenciaId,
      }).expect(201);
      const login = await http.post('/auth/login').send({ email: 'comum@nurseflow.com', senha: 'senha-padrao-teste', perfil: 'enfermeiro' }).expect(200);
      const cabecalho = { Authorization: `Bearer ${login.body.accessToken}` };
      const antes = await contar();
      await http.get('/profissionais/importacao/modelo').set(cabecalho).expect(403);
      await http.post('/profissionais/importacao/previa').set(cabecalho).attach('arquivo', await planilha([novo()]), 'a.xlsx').expect(403);
      await http.post('/profissionais/importacao').set(cabecalho).attach('arquivo', await planilha([novo()]), 'a.xlsx').expect(403);
      expect(await contar()).toBe(antes);
    });

    it('rejeita arquivos incompatíveis: sem arquivo, extensão errada, conteúdo falso, corrompido, vazio, grande e sem CPF', async () => {
      await http.post('/profissionais/importacao/previa').set(auth()).expect(400);
      await previa(Buffer.from('nome,cpf\nA,1'), 'profissionais.csv').expect(415);
      await previa(Buffer.from('isto não é uma planilha'), 'profissionais.xlsx').expect(415);
      await previa(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('lixo')]), 'profissionais.xlsx').expect(400);
      await previa(Buffer.alloc(0), 'profissionais.xlsx').expect(400);
      await previa(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(3 * 1024 * 1024)]), 'grande.xlsx').expect(413);
      await previa(await planilha([['A', 'B']], ['Coluna 1', 'Coluna 2']), 'sem-cpf.xlsx').expect(400);
      const vazia = await previa(await planilha([]), 'vazia.xlsx').expect(400);
      expect(vazia.body.message).toMatch(/nenhum profissional/i);
    });

    it('limita a quantidade de linhas', async () => {
      const linhas = Array.from({ length: 201 }, () => novo());
      const res = await previa(await planilha(linhas)).expect(400);
      expect(res.body.message).toMatch(/limite/i);
    });
  });

  describe('cadastro, atualização e idempotência', () => {
    it('a prévia não grava nada e a importação é bloqueada pelo servidor quando há erros', async () => {
      const antes = await contar();
      const valido = novo();
      const arquivo = await planilha([valido, novo({ cpf: '123.456.789-00' })]);

      const res = await previa(arquivo).expect(200);
      expect(res.body.resumo).toEqual({ total: 2, novos: 1, atualizar: 0, semAlteracao: 0, invalidos: 1 });
      expect(res.body.podeConfirmar).toBe(false);
      expect(await contar()).toBe(antes);

      const bloqueada = await importar(arquivo).expect(422);
      expect(bloqueada.body.previa.resumo.invalidos).toBe(1);
      // Transação única: a linha válida também não foi gravada.
      expect(await contar()).toBe(antes);
      expect((await porCpf(valido.cpf)).usuario).toBeNull();
    });

    it('cadastra novos profissionais (com máscara de CPF, subsetor e situação) e reimportar não duplica', async () => {
      const tecnico = novo({ setor: 'UTI', subsetor: 'uti adulto', vinculo: 'rpa' });
      const enfermeiro = novo({ formacao: 'Enfermeiro', setor: 'UTI', status: 'Férias' });
      const arquivo = await planilha([tecnico, enfermeiro]);
      const antes = await contar();

      const pre = await previa(arquivo).expect(200);
      expect(pre.body.resumo).toEqual({ total: 2, novos: 2, atualizar: 0, semAlteracao: 0, invalidos: 0 });
      expect(pre.body.podeConfirmar).toBe(true);

      const res = await importar(arquivo).expect(200);
      expect(res.body.resumo).toEqual({ total: 2, cadastrados: 2, atualizados: 0, ignorados: 0 });
      expect(await contar()).toBe(antes + 2);

      const t = await porCpf(tecnico.cpf);
      expect(t.profissional).toMatchObject({ formacao: 'tecnico', tipoVinculo: 'rpa', status: 'ativo', coren: tecnico[2] });
      expect(String(t.profissional?.setorId)).toBe(uti.id);
      expect(String(t.profissional?.subsetorId)).toBe(uti.subsetores.find((s) => s.nome === 'UTI Adulto')!.id);
      expect(t.usuario?.cpf).toBe(tecnico.cpf);
      expect(t.usuario?.senhaTemporaria).toBe(true);
      expect((await porCpf(enfermeiro.cpf)).profissional?.status).toBe('ferias');

      // Reimportação da mesma planilha: nada novo, nada alterado.
      const outra = await importar(arquivo).expect(200);
      expect(outra.body.resumo).toEqual({ total: 2, cadastrados: 0, atualizados: 0, ignorados: 2 });
      expect(await contar()).toBe(antes + 2);
    });

    it('atualiza só os campos alterados, preserva células vazias, mostra atual/novo e não toca em quem não está na planilha', async () => {
      const a = novo({ vinculo: 'CLT' });
      const b = novo();
      const c = novo(); // fora da segunda planilha
      await importar(await planilha([a, b, c])).expect(200);
      const antesC = await porCpf(c.cpf);
      const antesA = await porCpf(a.cpf);

      // A: muda vínculo e situação; e-mail em branco (preserva). B: idêntica. Nova linha D.
      const d = novo();
      const arquivo = await planilha([
        [a[0], a[1], a[2], '', '', 'Concursado', '', '', 'Afastado'],
        b,
        d,
      ]);
      const pre = await previa(arquivo).expect(200);
      expect(pre.body.resumo).toEqual({ total: 3, novos: 1, atualizar: 1, semAlteracao: 1, invalidos: 0 });
      const linhaA = pre.body.linhas[0];
      expect(linhaA.acao).toBe('atualizar');
      expect(linhaA.alteracoes).toEqual([
        { campo: 'Tipo de vínculo', atual: 'CLT', novo: 'Concursado' },
        { campo: 'Situação', atual: 'Ativo', novo: 'Afastado' },
      ]);

      const res = await importar(arquivo).expect(200);
      expect(res.body.resumo).toEqual({ total: 3, cadastrados: 1, atualizados: 1, ignorados: 1 });
      const depoisA = await porCpf(a.cpf);
      expect(depoisA.profissional).toMatchObject({ tipoVinculo: 'concursado', status: 'afastado', formacao: 'tecnico' });
      expect(depoisA.usuario?.email).toBe(antesA.usuario?.email); // célula vazia não sobrescreve
      expect(String(depoisA.profissional?.setorId)).toBe(String(antesA.profissional?.setorId));
      const depoisC = await porCpf(c.cpf);
      expect(depoisC.profissional?.toObject()).toEqual(antesC.profissional?.toObject());
      expect((await porCpf(d.cpf)).profissional).not.toBeNull();
    });

    it('troca de setor limpa o subsetor e mostra isso na prévia; mudança de e-mail é aplicada', async () => {
      const t = novo({ setor: 'UTI', subsetor: 'UTI Intermediária' });
      await importar(await planilha([t])).expect(200);
      const arquivo = await planilha([[t[0], t[1], t[2], 'novo.email.import@nurseflow.com', '', '', 'Emergência', '', '']]);
      const pre = await previa(arquivo).expect(200);
      expect(pre.body.linhas[0].alteracoes).toEqual([
        { campo: 'E-mail', atual: t[3], novo: 'novo.email.import@nurseflow.com' },
        { campo: 'Setor', atual: 'UTI', novo: 'Emergência' },
        { campo: 'Subsetor', atual: 'UTI Intermediária', novo: null },
      ]);
      await importar(arquivo).expect(200);
      const depois = await porCpf(t.cpf);
      expect(depois.usuario?.email).toBe('novo.email.import@nurseflow.com');
      expect(depois.profissional?.subsetorId).toBeNull();
    });

    it('identifica o profissional pelo CPF, ignorando máscara, e avisa quando o nome difere sem alterá-lo', async () => {
      const t = novo();
      await importar(await planilha([t])).expect(200);
      const arquivo = await planilha([[`Outro Nome Qualquer`, t.cpf, t[2], '', '', '', '', '', '']]);
      const pre = await previa(arquivo).expect(200);
      expect(pre.body.linhas[0].acao).toBe('sem_alteracao');
      expect(pre.body.linhas[0].avisos[0]).toMatch(/não é alterado/);
      expect((await porCpf(t.cpf)).usuario?.nome).toBe(t[0]);
    });
  });

  describe('validações', () => {
    it('informa linha, campo e motivo; obrigatórios, formatos, domínios e relacionamentos', async () => {
      const antes = await contar();
      const linhas: Linha[] = [
        ['', '', '', '', '', '', '', '', ''], // linha totalmente vazia: ignorada
        ['AB', '111.111.111-11', 'X', 'sem-arroba', 'Médico', 'Estagiário', 'Setor Fantasma', '', 'Quase'],
        novo({ setor: 'Setor Inativo' }),
        novo({ setor: 'Emergência', subsetor: 'UTI Adulto' }),
        novo({ formacao: 'Enfermeiro', setor: 'UTI', subsetor: 'UTI Adulto' }),
        novo({ setor: 'UTI', subsetor: 'Subsetor Inexistente' }),
        ['Sem Dados Obrigatórios', mascara(cpfDe(600099001)), '', '', '', '', '', '', ''],
      ];
      const res = await previa(await planilha(linhas)).expect(200);
      expect(res.body.resumo).toEqual({ total: 6, novos: 0, atualizar: 0, semAlteracao: 0, invalidos: 6 });
      const [l1, l2, l3, l4, l5, l6] = res.body.linhas as { linha: number; erros: { campo: string; mensagem: string }[] }[];
      const campos = (l: { erros: { campo: string }[] }) => l.erros.map((e) => e.campo);

      expect(l1.linha).toBe(3); // linha 2 era vazia
      expect(campos(l1)).toEqual(expect.arrayContaining(['Nome completo', 'CPF', 'COREN', 'E-mail', 'Formação', 'Tipo de vínculo', 'Setor', 'Situação']));
      expect(l1.erros.find((e) => e.campo === 'CPF')?.mensagem).toBe('CPF inválido.');
      expect(l2.erros).toEqual([{ campo: 'Setor', mensagem: 'O setor "Setor Inativo" está inativo.' }]);
      expect(l3.erros[0]).toMatchObject({ campo: 'Subsetor' });
      expect(l3.erros[0].mensagem).toMatch(/Emergência não possui subsetores/);
      expect(l4.erros[0]).toMatchObject({ campo: 'Subsetor', mensagem: expect.stringMatching(/sem subsetor/) });
      expect(l5.erros[0].mensagem).toMatch(/Subsetor Inexistente.*não encontrado/);
      expect(campos(l6)).toEqual(expect.arrayContaining(['COREN', 'E-mail', 'Formação', 'Tipo de vínculo', 'Setor']));
      expect(await contar()).toBe(antes);
      await importar(await planilha(linhas)).expect(422);
      expect(await contar()).toBe(antes);
    });

    it('rejeita subsetor de outro setor e enfermeiro com subsetor (inclusive existente que vira enfermeiro)', async () => {
      await http.post('/setores').set(auth()).send({
        nome: 'Centro Cirúrgico', plantao24h: { enfermeiros: 1 }, subsetores: [{ nome: 'Sala Cirúrgica', plantao24h: { tecnicos: 1 } }],
      }).expect(201);
      const tecnico = novo({ setor: 'UTI', subsetor: 'Sala Cirúrgica' });
      const enfermeiro = novo({ formacao: 'Enfermeiro', setor: 'UTI', subsetor: 'UTI Adulto' });
      const existente = novo({ setor: 'UTI', subsetor: 'UTI Adulto' });
      await importar(await planilha([existente])).expect(200);
      const virouEnfermeiro = [existente[0], existente[1], existente[2], '', 'Enfermeiro', '', '', 'UTI Adulto', ''];
      const res = await previa(await planilha([tecnico, enfermeiro, virouEnfermeiro])).expect(200);
      const [a, b, c] = res.body.linhas as { acao: string; erros: { campo: string; mensagem: string }[] }[];
      expect(a.erros).toEqual([{ campo: 'Subsetor', mensagem: 'O subsetor "Sala Cirúrgica" pertence ao setor Centro Cirúrgico, não ao setor UTI.' }]);
      expect(b.erros).toEqual([{ campo: 'Subsetor', mensagem: 'Enfermeiros são vinculados apenas ao setor, sem subsetor.' }]);
      expect(c.acao).toBe('invalido');
      expect(c.erros[0]).toMatchObject({ campo: 'Subsetor' });
      await importar(await planilha([tecnico, enfermeiro])).expect(422);
    });

    it('detecta CPF, COREN e e-mail repetidos dentro da planilha', async () => {
      const a = novo();
      const b = novo({ cpf: a[1] as string });
      const c = novo({ coren: 'COREN-CE 123123', email: 'repetido@nurseflow.com' });
      const d = novo({ coren: 'coren-ce  123123', email: 'REPETIDO@nurseflow.com' });
      const res = await previa(await planilha([a, b, c, d])).expect(200);
      const linhas = res.body.linhas as { linha: number; acao: string; erros: { campo: string; mensagem: string }[] }[];
      expect(linhas.every((l) => l.acao === 'invalido')).toBe(true);
      expect(linhas[0].erros[0]).toEqual({ campo: 'CPF', mensagem: 'CPF repetido na planilha (também na linha 3).' });
      expect(linhas[2].erros.map((e) => e.campo)).toEqual(['COREN', 'E-mail']);
    });

    it('rejeita COREN/e-mail já usados por outro profissional do sistema e COREN divergente do cadastro', async () => {
      const existente = novo();
      await importar(await planilha([existente])).expect(200);
      const colisao = novo({ coren: existente[2] as string, email: existente[3] as string });
      const divergente = [existente[0], existente[1], 'COREN-CE 111222', '', '', '', '', '', ''];
      const res = await previa(await planilha([colisao, divergente])).expect(200);
      expect(res.body.linhas[0].erros.map((e: { campo: string }) => e.campo)).toContain('COREN');
      expect(res.body.linhas[1].erros[0]).toMatchObject({ campo: 'COREN', mensagem: expect.stringMatching(/difere do cadastro/) });
    });

    it('rejeita CPF que pertence a um usuário que não é profissional', async () => {
      const res = await previa(await planilha([novo({ cpf: '111.444.777-35' })])).expect(200);
      expect(res.body.linhas[0].erros[0]).toMatchObject({ campo: 'CPF', mensagem: expect.stringMatching(/não é profissional/) });
    });

    it('aceita CPF numérico na célula (zeros à esquerda restaurados) e cabeçalhos da exportação', async () => {
      const cpf = '00000000191';
      const arquivo = await planilha(
        [['Sem Zeros Iniciais', Number(cpf), 'COREN-CE 555111', 'zeros@nurseflow.com', 'Enfermeiro', 'CLT', 'Emergência']],
        ['Nome completo', 'CPF', 'COREN', 'E-mail', 'Formação', 'Tipo de vínculo', 'Setor'],
      );
      const res = await previa(arquivo).expect(200);
      expect(res.body.linhas[0]).toMatchObject({ acao: 'criar', cpf: '000.000.001-91' });
    });
  });

  describe('regras de negócio reutilizadas e atomicidade', () => {
    it('falha durante a persistência desfaz a importação inteira', async () => {
      const antes = await contar();
      const usuariosAntes = await usuarioModel.countDocuments();
      const servico = app.get(ProfissionaisService);
      const original = servico.criar.bind(servico);
      let chamadas = 0;
      const espiao = jest.spyOn(servico, 'criar').mockImplementation((dto, sessao) => {
        chamadas += 1;
        if (chamadas === 3) return Promise.reject(new Error('falha simulada no banco'));
        return original(dto, sessao);
      });
      try {
        const res = await importar(await planilha([novo(), novo(), novo()]));
        expect(res.status).toBe(500);
      } finally {
        espiao.mockRestore();
      }
      expect(await contar()).toBe(antes);
      expect(await usuarioModel.countDocuments()).toBe(usuariosAntes);
    });

    it('respeita a regra de desativação com plantões futuros publicados (erro na linha, nada gravado)', async () => {
      const t = novo();
      await importar(await planilha([t])).expect(200);
      const servico = app.get(ProfissionaisService);
      const checker = (servico as unknown as { plantoesFuturos: { buscarPublicadosFuturos: (id: string) => Promise<unknown[]> } }).plantoesFuturos;
      const espiao = jest.spyOn(checker, 'buscarPublicadosFuturos').mockResolvedValue([{ id: 'plantao-1' }]);
      try {
        const arquivo = await planilha([[t[0], t[1], t[2], '', '', '', '', '', 'Desativado']]);
        const res = await previa(arquivo).expect(200);
        expect(res.body.linhas[0].acao).toBe('invalido');
        expect(res.body.linhas[0].erros[0]).toMatchObject({ campo: 'Situação', mensagem: expect.stringMatching(/plantões futuros/) });
        await importar(arquivo).expect(422);
      } finally {
        espiao.mockRestore();
      }
      expect((await porCpf(t.cpf)).profissional?.status).toBe('ativo');
    });
  });
});
