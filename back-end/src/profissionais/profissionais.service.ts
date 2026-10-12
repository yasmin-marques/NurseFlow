import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { type Model, type PipelineStage, type Types } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { formatarCpf, somenteDigitos } from '../common/utils/cpf';
import { COLLATION_PT, escaparRegex, regexSemAcentos } from '../common/utils/text';
import { TipoUsuario, type Usuario, type UsuarioDocument } from '../usuarios/schemas/usuario.schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { CreateProfissionalDto } from './dto/create-profissional.dto';
import { type ListProfissionaisQueryDto, Ordem } from './dto/list-profissionais-query.dto';
import type { ProfissionalListaDto, ProfissionalResponseDto } from './dto/profissional-response.dto';
import type { UpdateProfissionalDto } from './dto/update-profissional.dto';
import { PlantoesFuturosChecker } from './plantoes-futuros.checker';
import { StatusProfissional } from './profissionais.enums';
import { Profissional, type ProfissionalDocument } from './schemas/profissional.schema';

/** Remove chaves `undefined` (em `doc.set`, undefined apagaria o campo). */
function semUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, valor]) => valor !== undefined)) as Partial<T>;
}

type UsuarioPublico = Pick<Usuario, 'nome' | 'cpf' | 'email'>;
type ProfissionalAgregado = Omit<Profissional, 'usuarioId'> & { _id: Types.ObjectId; usuario: UsuarioPublico };

@Injectable()
export class ProfissionaisService {
  constructor(
    @InjectModel(Profissional.name) private readonly profissionalModel: Model<Profissional>,
    private readonly usuariosService: UsuariosService,
    private readonly plantoesFuturos: PlantoesFuturosChecker,
  ) {}

  /** DA02: cadastra o profissional (usuário de acesso + dados profissionais). */
  async criar(dto: CreateProfissionalDto): Promise<ProfissionalResponseDto> {
    await this.garantirNaoCadastrado({ cpf: dto.cpf, coren: dto.coren, email: dto.email });

    const senhaTemporaria = !dto.senha;
    const senha = await AuthService.gerarHashSenha(dto.senha ?? randomBytes(24).toString('base64url'));
    const usuario = await this.usuariosService.criar({
      nome: dto.nome,
      email: dto.email,
      cpf: dto.cpf,
      senha,
      senhaTemporaria,
      tipoUsuario: TipoUsuario.PROFISSIONAL_DA_SAUDE,
    });

    try {
      const status = dto.status ?? StatusProfissional.ATIVO;
      const profissional = await this.profissionalModel.create({
        usuarioId: usuario._id,
        coren: dto.coren,
        formacao: dto.formacao,
        tipoVinculo: dto.tipoVinculo,
        status,
        desativadoEm: status === StatusProfissional.DESATIVADO ? new Date() : null,
      });
      return this.paraResposta(profissional, usuario);
    } catch (erro) {
      // Mongo standalone não tem transações: desfaz o usuário criado na primeira etapa.
      await this.usuariosService.removerCriacaoParcial(usuario._id);
      throw erro;
    }
  }

  /** DA03: busca (nome, CPF ou COREN), filtros por formação/status/vínculo e ordenação por nome. */
  async listar(query: ListProfissionaisQueryDto): Promise<ProfissionalListaDto> {
    const filtro: Record<string, unknown> = {};
    if (query.formacao) filtro.formacao = query.formacao;
    if (query.status) filtro.status = query.status;
    if (query.tipoVinculo) filtro.tipoVinculo = query.tipoVinculo;

    const pipeline: PipelineStage[] = [
      { $match: filtro },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioId',
          foreignField: '_id',
          as: 'usuario',
          // Projeção explícita: o hash da senha e os tokens nunca saem do banco.
          pipeline: [{ $project: { nome: 1, cpf: 1, email: 1 } }],
        },
      },
      { $unwind: '$usuario' },
    ];

    if (query.busca) {
      const condicoes: Record<string, unknown>[] = [
        { 'usuario.nome': { $regex: regexSemAcentos(query.busca), $options: 'i' } },
        { coren: { $regex: escaparRegex(query.busca), $options: 'i' } },
      ];
      const digitos = somenteDigitos(query.busca);
      if (digitos) condicoes.push({ 'usuario.cpf': { $regex: digitos } });
      pipeline.push({ $match: { $or: condicoes } });
    }

    pipeline.push(
      { $sort: { 'usuario.nome': query.ordem === Ordem.DESC ? -1 : 1, _id: 1 } },
      {
        $facet: {
          data: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
          total: [{ $count: 'total' }],
        },
      },
    );

    const [resultado] = await this.profissionalModel
      .aggregate<{ data: ProfissionalAgregado[]; total: { total: number }[] }>(pipeline)
      .collation(COLLATION_PT)
      .exec();
    const total = resultado.total[0]?.total ?? 0;

    return {
      data: resultado.data.map((item) => this.agregadoParaResposta(item)),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  /** Lista todos os profissionais, sem filtros nem paginação, ordenados por nome. */
  async listarTodos(): Promise<ProfissionalResponseDto[]> {
    const { data } = await this.listar({ ordem: Ordem.ASC, page: 1, limit: Number.MAX_SAFE_INTEGER });
    return data;
  }

  async obter(id: string): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id);
    return this.paraResposta(profissional, usuario);
  }

  /** DA03: edição. Se o status passar para "desativado", aplica a regra do DA04. */
  async atualizar(id: string, dto: UpdateProfissionalDto): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id);
    await this.garantirNaoCadastrado(
      { cpf: dto.cpf, coren: dto.coren, email: dto.email },
      { usuarioId: usuario._id, profissionalId: profissional._id },
    );

    if (dto.status && dto.status !== profissional.status) {
      await this.aplicarStatus(profissional, dto.status);
    }

    usuario.set(semUndefined({ nome: dto.nome, cpf: dto.cpf, email: dto.email }));
    profissional.set(semUndefined({ coren: dto.coren, formacao: dto.formacao, tipoVinculo: dto.tipoVinculo }));
    await usuario.save();
    await profissional.save();
    return this.paraResposta(profissional, usuario);
  }

  /** DA04: desativação lógica. O registro é preservado e nenhum DELETE físico é feito. */
  async desativar(id: string): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id);
    if (profissional.status !== StatusProfissional.DESATIVADO) {
      await this.aplicarStatus(profissional, StatusProfissional.DESATIVADO);
      await profissional.save();
    }
    return this.paraResposta(profissional, usuario);
  }

  /** Atualiza o status em memória, validando a regra de plantões futuros ao desativar. */
  private async aplicarStatus(profissional: ProfissionalDocument, status: StatusProfissional): Promise<void> {
    if (status === StatusProfissional.DESATIVADO) {
      const pendentes = await this.plantoesFuturos.buscarPublicadosFuturos(profissional._id.toString());
      if (pendentes.length > 0) {
        throw new ConflictException({
          message: 'Não é possível desativar: o profissional possui plantões futuros em escalas publicadas que precisam de cobertura.',
          plantoes: pendentes,
        });
      }
    }
    profissional.status = status;
    profissional.desativadoEm = status === StatusProfissional.DESATIVADO ? new Date() : null;
  }

  private async carregar(id: string): Promise<{ profissional: ProfissionalDocument; usuario: UsuarioDocument }> {
    const profissional = await this.profissionalModel.findById(id).exec();
    const usuario = profissional ? await this.usuariosService.buscarPorId(profissional.usuarioId) : null;
    if (!profissional || !usuario) throw new NotFoundException('Profissional não encontrado.');
    return { profissional, usuario };
  }

  /** "Profissional já cadastrado?" — CPF e COREN (DA02) e e-mail de acesso, ignorando o próprio registro na edição. */
  private async garantirNaoCadastrado(
    campos: { cpf?: string; coren?: string; email?: string },
    proprio?: { usuarioId: Types.ObjectId; profissionalId: Types.ObjectId },
  ): Promise<void> {
    const [porCpf, porEmail, porCoren] = await Promise.all([
      campos.cpf ? this.usuariosService.buscarPorCpf(campos.cpf) : null,
      campos.email ? this.usuariosService.buscarPorEmail(campos.email) : null,
      campos.coren ? this.profissionalModel.findOne({ coren: campos.coren }).exec() : null,
    ]);

    const conflitos: string[] = [];
    if (porCpf && !porCpf._id.equals(proprio?.usuarioId)) conflitos.push('CPF');
    if (porCoren && !porCoren._id.equals(proprio?.profissionalId)) conflitos.push('COREN');
    if (conflitos.length > 0) {
      throw new ConflictException(`Profissional já cadastrado com o mesmo ${conflitos.join(' e ')}.`);
    }
    if (porEmail && !porEmail._id.equals(proprio?.usuarioId)) {
      throw new ConflictException('E-mail já utilizado por outro usuário.');
    }
  }

  private paraResposta(profissional: ProfissionalDocument, usuario: UsuarioPublico): ProfissionalResponseDto {
    return {
      id: profissional._id.toString(),
      nome: usuario.nome,
      cpf: formatarCpf(usuario.cpf),
      email: usuario.email,
      coren: profissional.coren,
      formacao: profissional.formacao,
      tipoVinculo: profissional.tipoVinculo,
      status: profissional.status,
      createdAt: profissional.createdAt,
      updatedAt: profissional.updatedAt,
    };
  }

  private agregadoParaResposta(item: ProfissionalAgregado): ProfissionalResponseDto {
    return {
      id: item._id.toString(),
      nome: item.usuario.nome,
      cpf: formatarCpf(item.usuario.cpf),
      email: item.usuario.email,
      coren: item.coren,
      formacao: item.formacao,
      tipoVinculo: item.tipoVinculo,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
