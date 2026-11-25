import { HttpException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { ClientSession, Connection, Model, Types } from 'mongoose';
import { cpfValido, formatarCpf, somenteDigitos } from '../../common/utils/cpf';
import { executarTransacao } from '../../common/utils/mongo-transaction';
import { normalizarEspacos, semAcentos } from '../../common/utils/text';
import { Setor } from '../../setores/schemas/setor.schema';
import { Subsetor } from '../../setores/schemas/subsetor.schema';
import { Usuario, type UsuarioDocument } from '../../usuarios/schemas/usuario.schema';
import { CreateProfissionalDto } from '../dto/create-profissional.dto';
import type { ProfissionalResponseDto } from '../dto/profissional-response.dto';
import { UpdateProfissionalDto } from '../dto/update-profissional.dto';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';
import { ProfissionaisService } from '../profissionais.service';
import { Profissional, type ProfissionalDocument } from '../schemas/profissional.schema';
import type {
  AcaoImportacao,
  AlteracaoCampoDto,
  ErroLinhaDto,
  LinhaImportacaoDto,
  PreviaImportacaoDto,
  ResultadoImportacaoDto,
} from './importacao.dto';
import {
  type ChaveColuna,
  FORMACAO_ROTULO,
  gerarModelo,
  interpretarFormacao,
  interpretarSituacao,
  interpretarVinculo,
  type LinhaPlanilha,
  lerPlanilha,
  normalizarChave,
  ROTULO,
  STATUS_ROTULO,
  VINCULO_ROTULO,
} from './planilha-profissionais';

type SetorLean = { _id: Types.ObjectId; nome: string; ativo: boolean; possuiSubsetores?: boolean };
type SubsetorLean = { _id: Types.ObjectId; nome: string; setorId: Types.ObjectId; ativo: boolean };

interface Contexto {
  session: ClientSession;
  setores: SetorLean[];
  subsetores: SubsetorLean[];
  usuariosPorCpf: Map<string, UsuarioDocument>;
  profissionaisPorUsuario: Map<string, ProfissionalDocument>;
  duplicidades: Map<number, ErroLinhaDto[]>;
}

interface Estado {
  email: string;
  formacao: Formacao;
  tipoVinculo: TipoVinculo;
  status: StatusProfissional;
  setorNome: string | null;
  subsetorNome: string | null;
}

interface Processamento {
  linhas: LinhaImportacaoDto[];
}

/** Sinaliza que a transação deve ser desfeita de propósito (pré-visualização ou planilha com erros). */
class DesfazerTransacao extends Error {}

const ordenarPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Importação de profissionais por planilha: o CPF identifica o cadastro; cadastro/edição reutilizam o ProfissionaisService. */
@Injectable()
export class ProfissionaisImportacaoService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    @InjectModel(Profissional.name) private readonly profissionalModel: Model<Profissional>,
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(Subsetor.name) private readonly subsetorModel: Model<Subsetor>,
    private readonly profissionais: ProfissionaisService,
  ) {}

  /** Modelo de planilha com os setores/subsetores ativos reais do banco. */
  async baixarModelo(): Promise<Buffer> {
    const setores = await this.setorModel.find({ ativo: true }).lean().exec();
    const subsetores = await this.subsetorModel.find({ ativo: true }).lean().exec();
    return gerarModelo(
      setores
        .map((setor) => ({
          nome: setor.nome,
          subsetores: subsetores
            .filter((subsetor) => subsetor.setorId.equals(setor._id))
            .map((subsetor) => subsetor.nome)
            .sort(ordenarPtBr),
        }))
        .sort((a, b) => ordenarPtBr(a.nome, b.nome)),
    );
  }

  /** Valida a planilha e simula a importação inteira numa transação que é sempre desfeita. Nada é gravado. */
  async previa(buffer: Buffer): Promise<PreviaImportacaoDto> {
    const { linhas } = await this.executar(buffer, false);
    const resumo = this.resumir(linhas);
    return { resumo, linhas, podeConfirmar: resumo.invalidos === 0 };
  }

  /** Reavalia a planilha no servidor (nunca confia na prévia do cliente) e grava tudo em uma única transação. */
  async confirmar(buffer: Buffer): Promise<ResultadoImportacaoDto> {
    const { linhas } = await this.executar(buffer, true);
    const resumo = this.resumir(linhas);
    if (resumo.invalidos > 0) {
      throw new UnprocessableEntityException({
        message: 'A planilha possui registros inválidos. Corrija os erros e envie novamente; nada foi importado.',
        previa: { resumo, linhas, podeConfirmar: false } satisfies PreviaImportacaoDto,
      });
    }
    return {
      resumo: { total: resumo.total, cadastrados: resumo.novos, atualizados: resumo.atualizar, ignorados: resumo.semAlteracao },
      linhas,
    };
  }

  private resumir(linhas: LinhaImportacaoDto[]) {
    const conta = (acao: AcaoImportacao) => linhas.filter((linha) => linha.acao === acao).length;
    return {
      total: linhas.length,
      novos: conta('criar'),
      atualizar: conta('atualizar'),
      semAlteracao: conta('sem_alteracao'),
      invalidos: conta('invalido'),
    };
  }

  /**
   * Roda a análise dentro de uma transação. Com `persistir` e sem erros ela é confirmada; caso contrário é desfeita,
   * de modo que a prévia percorre exatamente o mesmo caminho de regras do cadastro/edição reais.
   */
  private async executar(buffer: Buffer, persistir: boolean): Promise<Processamento> {
    const planilha = await lerPlanilha(buffer);
    let resultado: Processamento | undefined;
    try {
      await executarTransacao(this.connection, async (session) => {
        // A callback pode ser repetida pelo driver em erros transitórios: tudo é recalculado a cada execução.
        resultado = await this.processar(planilha, session);
        const invalido = resultado.linhas.some((linha) => linha.acao === 'invalido');
        if (!persistir || invalido) throw new DesfazerTransacao();
      });
    } catch (erro) {
      if (!(erro instanceof DesfazerTransacao)) throw erro;
    }
    return resultado as Processamento;
  }

  private async processar(planilha: LinhaPlanilha[], session: ClientSession): Promise<Processamento> {
    const setores = await this.setorModel.find().session(session).lean().exec();
    const subsetores = await this.subsetorModel.find().session(session).lean().exec();

    const cpfs = [...new Set(planilha.map((item) => somenteDigitos(item.valores.cpf)).filter(cpfValido))];
    const usuarios = await this.usuarioModel.find({ cpf: { $in: cpfs } }).session(session).exec();
    const profissionais = await this.profissionalModel
      .find({ usuarioId: { $in: usuarios.map((usuario) => usuario._id) } })
      .session(session)
      .exec();

    const contexto: Contexto = {
      session,
      setores,
      subsetores,
      usuariosPorCpf: new Map(usuarios.map((usuario) => [usuario.cpf, usuario])),
      profissionaisPorUsuario: new Map(profissionais.map((profissional) => [profissional.usuarioId.toString(), profissional])),
      duplicidades: this.detectarDuplicidades(planilha),
    };

    const linhas: LinhaImportacaoDto[] = [];
    for (const item of planilha) linhas.push(await this.processarLinha(item, contexto));
    return { linhas };
  }

  /** CPF, COREN e e-mail precisam ser únicos dentro da própria planilha. */
  private detectarDuplicidades(planilha: LinhaPlanilha[]): Map<number, ErroLinhaDto[]> {
    const erros = new Map<number, ErroLinhaDto[]>();
    const regras: { chave: ChaveColuna; normalizar: (valor: string) => string; mensagem: string }[] = [
      { chave: 'cpf', normalizar: somenteDigitos, mensagem: 'CPF repetido na planilha' },
      { chave: 'coren', normalizar: (valor) => (normalizarEspacos(valor) as string).toUpperCase(), mensagem: 'COREN repetido na planilha' },
      { chave: 'email', normalizar: (valor) => valor.trim().toLowerCase(), mensagem: 'E-mail repetido na planilha' },
    ];
    for (const regra of regras) {
      const grupos = new Map<string, number[]>();
      for (const item of planilha) {
        const chave = regra.normalizar(item.valores[regra.chave]);
        if (chave) grupos.set(chave, [...(grupos.get(chave) ?? []), item.linha]);
      }
      for (const numeros of grupos.values()) {
        if (numeros.length < 2) continue;
        for (const linha of numeros) {
          const outras = numeros.filter((numero) => numero !== linha).join(', ');
          erros.set(linha, [...(erros.get(linha) ?? []), { campo: ROTULO[regra.chave], mensagem: `${regra.mensagem} (também na linha ${outras}).` }]);
        }
      }
    }
    return erros;
  }

  private async processarLinha(item: LinhaPlanilha, contexto: Contexto): Promise<LinhaImportacaoDto> {
    const { valores } = item;
    const erros: ErroLinhaDto[] = [...(contexto.duplicidades.get(item.linha) ?? [])];
    const avisos: string[] = [];
    const registrarErro = (chave: ChaveColuna, mensagem: string) => erros.push({ campo: ROTULO[chave], mensagem });

    const cpf = somenteDigitos(valores.cpf);
    const cpfOk = cpfValido(cpf);
    if (!valores.cpf) registrarErro('cpf', 'Campo obrigatório.');
    else if (!cpfOk) registrarErro('cpf', 'CPF inválido.');

    const usuario = cpfOk ? contexto.usuariosPorCpf.get(cpf) : undefined;
    const existente = usuario ? contexto.profissionaisPorUsuario.get(usuario._id.toString()) : undefined;
    if (usuario && !existente) registrarErro('cpf', 'Este CPF pertence a um usuário que não é profissional da saúde.');
    // Sem cadastro para o CPF (inclusive CPF ausente/inválido): valida como cadastro novo para listar todos os problemas.
    const novo = !usuario;

    const pronto = (acao: AcaoImportacao, alteracoes: AlteracaoCampoDto[] = []): LinhaImportacaoDto => ({
      linha: item.linha,
      nome: valores.nome || usuario?.nome || '',
      cpf: cpfOk ? formatarCpf(cpf) : valores.cpf,
      acao,
      alteracoes,
      erros,
      avisos,
    });

    // Campos de domínio (enums e relacionamentos), traduzidos dos textos da planilha.
    const formacao = valores.formacao ? interpretarFormacao(valores.formacao) : undefined;
    if (valores.formacao && !formacao) registrarErro('formacao', `Valor inválido. Use: ${Object.values(FORMACAO_ROTULO).join(' ou ')}.`);
    const tipoVinculo = valores.tipoVinculo ? interpretarVinculo(valores.tipoVinculo) : undefined;
    if (valores.tipoVinculo && !tipoVinculo) registrarErro('tipoVinculo', `Valor inválido. Use: ${Object.values(VINCULO_ROTULO).join(', ')}.`);
    const status = valores.status ? interpretarSituacao(valores.status) : undefined;
    if (valores.status && !status) registrarErro('status', `Valor inválido. Use: ${Object.values(STATUS_ROTULO).join(', ')}.`);

    const setor = this.resolverSetor(valores.setor, contexto, (mensagem) => registrarErro('setor', mensagem));
    const setorBase = valores.setor ? setor : existente?.setorId ? contexto.setores.find((s) => s._id.equals(existente.setorId!)) : undefined;
    const subsetor = valores.subsetor
      ? this.resolverSubsetor(valores.subsetor, setorBase, contexto, (mensagem) => registrarErro('subsetor', mensagem))
      : undefined;

    // Enfermeiro é vinculado só ao setor: subsetor nunca é permitido (a formação efetiva considera o cadastro atual).
    const formacaoEfetiva = formacao ?? existente?.formacao;
    if (valores.subsetor && formacaoEfetiva === Formacao.ENFERMEIRO) {
      registrarErro('subsetor', 'Enfermeiros são vinculados apenas ao setor, sem subsetor.');
    }

    if (novo) {
      for (const chave of ['nome', 'coren', 'email', 'formacao', 'tipoVinculo', 'setor'] as const) {
        if (!valores[chave]) registrarErro(chave, 'Campo obrigatório para cadastrar um novo profissional.');
      }
    }

    const nome = normalizarEspacos(valores.nome) as string;
    const coren = (normalizarEspacos(valores.coren) as string).toUpperCase();
    const email = valores.email.trim().toLowerCase();

    if (existente && usuario) {
      if (nome && semAcentos(nome).toLowerCase() !== semAcentos(usuario.nome).toLowerCase()) {
        avisos.push(`O nome na planilha ("${nome}") difere do cadastro ("${usuario.nome}") e não é alterado pela importação.`);
      }
      if (coren && coren !== existente.coren) {
        registrarErro('coren', `O COREN difere do cadastro (${existente.coren}). O COREN não é alterado pela importação; confira o CPF.`);
      }
    }

    // Validações de formato reaproveitam os decoradores dos DTOs de cadastro/edição.
    if (novo) {
      const dto = plainToInstance(CreateProfissionalDto, {
        ...(valores.nome && { nome }),
        ...(valores.coren && { coren }),
        ...(valores.email && { email }),
        ...(cpfOk && { cpf }),
      });
      await this.coletarErrosDto(dto, { nome: 'nome', coren: 'coren', email: 'email' }, registrarErro);
    } else if (existente && valores.email) {
      await this.coletarErrosDto(plainToInstance(UpdateProfissionalDto, { email }), { email: 'email' }, registrarErro);
    }

    if (erros.length > 0) return pronto('invalido');

    if (novo) {
      return this.cadastrar(
        pronto,
        {
          nome,
          cpf,
          coren,
          email,
          formacao: formacao!,
          tipoVinculo: tipoVinculo!,
          setorId: setor!._id.toString(),
          subsetorId: subsetor ? subsetor._id.toString() : undefined,
          status,
        },
        contexto.session,
        erros,
      );
    }

    // Existente: somente os campos preenchidos e diferentes do cadastro atual entram na atualização.
    const dto: UpdateProfissionalDto = {};
    if (valores.email && email !== usuario!.email) dto.email = email;
    if (formacao && formacao !== existente!.formacao) dto.formacao = formacao;
    if (tipoVinculo && tipoVinculo !== existente!.tipoVinculo) dto.tipoVinculo = tipoVinculo;
    if (setor && !setor._id.equals(existente!.setorId ?? undefined)) dto.setorId = setor._id.toString();
    if (subsetor && !subsetor._id.equals(existente!.subsetorId ?? undefined)) dto.subsetorId = subsetor._id.toString();
    if (status && status !== existente!.status) dto.status = status;
    if (Object.keys(dto).length === 0) return pronto('sem_alteracao');

    const antes = this.estadoAtual(usuario!, existente!, contexto);
    try {
      const depois = await this.profissionais.atualizar(existente!._id.toString(), dto, contexto.session);
      const alteracoes = this.compararEstados(antes, depois);
      return pronto(alteracoes.length ? 'atualizar' : 'sem_alteracao', alteracoes);
    } catch (erro) {
      this.registrarErrosDaExcecao(erro, erros);
      return pronto('invalido');
    }
  }

  private async cadastrar(
    pronto: (acao: AcaoImportacao, alteracoes?: AlteracaoCampoDto[]) => LinhaImportacaoDto,
    dados: CreateProfissionalDto,
    session: ClientSession,
    erros: ErroLinhaDto[],
  ): Promise<LinhaImportacaoDto> {
    try {
      await this.profissionais.criar(dados, session);
      return pronto('criar');
    } catch (erro) {
      this.registrarErrosDaExcecao(erro, erros);
      return pronto('invalido');
    }
  }

  private resolverSetor(texto: string, contexto: Contexto, erro: (mensagem: string) => void): SetorLean | undefined {
    if (!texto) return undefined;
    const iguais = contexto.setores.filter((setor) => normalizarChave(setor.nome) === normalizarChave(texto));
    if (iguais.length === 0) return void erro(`Setor "${texto}" não encontrado. Use um nome da aba "Listas".`);
    const ativos = iguais.filter((setor) => setor.ativo);
    if (ativos.length === 0) return void erro(`O setor "${texto}" está inativo.`);
    if (ativos.length > 1) return void erro(`Há mais de um setor ativo chamado "${texto}"; não é possível identificar qual usar.`);
    return ativos[0];
  }

  private resolverSubsetor(texto: string, setor: SetorLean | undefined, contexto: Contexto, erro: (mensagem: string) => void): SubsetorLean | undefined {
    if (!setor) return void erro('Informe o setor correspondente ao subsetor.');
    const doSetor = contexto.subsetores.filter((subsetor) => subsetor.setorId.equals(setor._id));
    const iguais = doSetor.filter((subsetor) => normalizarChave(subsetor.nome) === normalizarChave(texto));
    if (iguais.length === 0) {
      if (doSetor.length === 0) return void erro(`O setor ${setor.nome} não possui subsetores.`);
      const outro = contexto.subsetores.find((subsetor) => normalizarChave(subsetor.nome) === normalizarChave(texto));
      const dono = outro && contexto.setores.find((item) => item._id.equals(outro.setorId));
      return void erro(
        dono
          ? `O subsetor "${texto}" pertence ao setor ${dono.nome}, não ao setor ${setor.nome}.`
          : `Subsetor "${texto}" não encontrado no setor ${setor.nome}.`,
      );
    }
    const ativos = iguais.filter((subsetor) => subsetor.ativo);
    if (ativos.length === 0) return void erro(`O subsetor "${texto}" está inativo.`);
    if (ativos.length > 1) return void erro(`Há mais de um subsetor ativo chamado "${texto}" no setor ${setor.nome}.`);
    return ativos[0];
  }

  private async coletarErrosDto(
    dto: object,
    propriedades: Record<string, ChaveColuna>,
    registrar: (chave: ChaveColuna, mensagem: string) => void,
  ): Promise<void> {
    const encontrados: ValidationError[] = await validate(dto, { skipMissingProperties: true });
    for (const item of encontrados) {
      const chave = propriedades[item.property];
      if (chave) registrar(chave, Object.values(item.constraints ?? {})[0] ?? 'Valor inválido.');
    }
  }

  private nomeDoSetor(id: Types.ObjectId | null | undefined, contexto: Contexto): string | null {
    return id ? (contexto.setores.find((setor) => setor._id.equals(id))?.nome ?? null) : null;
  }

  private estadoAtual(usuario: UsuarioDocument, profissional: ProfissionalDocument, contexto: Contexto): Estado {
    return {
      email: usuario.email,
      formacao: profissional.formacao,
      tipoVinculo: profissional.tipoVinculo,
      status: profissional.status,
      setorNome: this.nomeDoSetor(profissional.setorId, contexto),
      subsetorNome: profissional.subsetorId
        ? (contexto.subsetores.find((subsetor) => subsetor._id.equals(profissional.subsetorId!))?.nome ?? null)
        : null,
    };
  }

  /** Diferença real entre o cadastro antes e depois da atualização (inclui efeitos das regras, como limpar o subsetor). */
  private compararEstados(antes: Estado, depois: ProfissionalResponseDto): AlteracaoCampoDto[] {
    const campos: [ChaveColuna, string | null, string | null][] = [
      ['email', antes.email, depois.email],
      ['formacao', FORMACAO_ROTULO[antes.formacao], FORMACAO_ROTULO[depois.formacao]],
      ['tipoVinculo', VINCULO_ROTULO[antes.tipoVinculo], VINCULO_ROTULO[depois.tipoVinculo]],
      ['setor', antes.setorNome, depois.setorNome],
      ['subsetor', antes.subsetorNome, depois.subsetorNome],
      ['status', STATUS_ROTULO[antes.status], STATUS_ROTULO[depois.status]],
    ];
    return campos.filter(([, atual, novo]) => atual !== novo).map(([chave, atual, novo]) => ({ campo: ROTULO[chave], atual, novo }));
  }

  /** Erros de regra de negócio do cadastro/edição viram erros da linha; qualquer outra falha aborta a importação. */
  private registrarErrosDaExcecao(erro: unknown, erros: ErroLinhaDto[]): void {
    if (!(erro instanceof HttpException)) throw erro;
    const resposta = erro.getResponse();
    const corpo = typeof resposta === 'string' ? { message: resposta } : (resposta as { message?: string | string[]; erros?: string[] });
    const mensagens = corpo.erros?.length ? corpo.erros : Array.isArray(corpo.message) ? corpo.message : [corpo.message ?? erro.message];
    for (const mensagem of new Set(mensagens)) erros.push({ campo: this.campoDaMensagem(mensagem), mensagem });
  }

  private campoDaMensagem(mensagem: string): string {
    const regras: [RegExp, ChaveColuna][] = [
      [/coren/i, 'coren'],
      [/e-?mail/i, 'email'],
      [/subsetor/i, 'subsetor'],
      [/setor/i, 'setor'],
      [/cpf/i, 'cpf'],
      [/desativ|situa/i, 'status'],
    ];
    const regra = regras.find(([padrao]) => padrao.test(mensagem));
    return regra ? ROTULO[regra[1]] : 'Linha';
  }
}
