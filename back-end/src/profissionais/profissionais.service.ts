import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import {
  type ClientSession,
  type Model,
  type PipelineStage,
  Types,
} from "mongoose";
import type { AppConfig } from "../config/configuration";
import { AuthService } from "../auth/auth.service";
import { formatarCpf, somenteDigitos } from "../common/utils/cpf";
import {
  COLLATION_PT,
  escaparRegex,
  regexSemAcentos,
} from "../common/utils/text";
import {
  TipoUsuario,
  type Usuario,
  type UsuarioDocument,
} from "../usuarios/schemas/usuario.schema";
import { UsuariosService } from "../usuarios/usuarios.service";
import type { CreateProfissionalDto } from "./dto/create-profissional.dto";
import {
  type ListProfissionaisQueryDto,
  Ordem,
} from "./dto/list-profissionais-query.dto";
import type {
  ProfissionalListaDto,
  ProfissionalResponseDto,
} from "./dto/profissional-response.dto";
import type { UpdateProfissionalDto } from "./dto/update-profissional.dto";
import { PlantoesFuturosChecker } from "./plantoes-futuros.checker";
import {
  Formacao,
  StatusProfissional,
  TipoVinculo,
} from "./profissionais.enums";
import { Setor } from "../setores/schemas/setor.schema";
import { Subsetor } from "../setores/schemas/subsetor.schema";
import {
  Profissional,
  type ProfissionalDocument,
} from "./schemas/profissional.schema";

/** Remove chaves `undefined` (em `doc.set`, undefined apagaria o campo). */
function semUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>;
}

type UsuarioPublico = Pick<Usuario, "nome" | "cpf" | "email">;
type ProfissionalAgregado = Omit<Profissional, "usuarioId"> & {
  _id: Types.ObjectId;
  usuario: UsuarioPublico;
  setor?: { nome: string };
  subsetor?: { nome: string };
};

@Injectable()
export class ProfissionaisService {
  constructor(
    @InjectModel(Profissional.name)
    private readonly profissionalModel: Model<Profissional>,
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(Subsetor.name) private readonly subsetorModel: Model<Subsetor>,
    private readonly usuariosService: UsuariosService,
    private readonly plantoesFuturos: PlantoesFuturosChecker,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Hash da senha padrão do .env (única fonte de senha inicial: cadastro manual e importação passam por aqui). */
  private async hashSenhaPadrao(): Promise<string> {
    const senhaPadrao = this.config.get("profissionais", {
      infer: true,
    }).senhaPadrao;
    if (!senhaPadrao)
      throw new InternalServerErrorException(
        "Senha padrão de profissionais não configurada no servidor.",
      );
    return AuthService.gerarHashSenha(senhaPadrao);
  }

  /** DA02: cadastra o profissional (usuário de acesso + dados profissionais). */
  async criar(
    dto: CreateProfissionalDto,
    session?: ClientSession,
  ): Promise<ProfissionalResponseDto> {
    await this.garantirNaoCadastrado(
      { cpf: dto.cpf, coren: dto.coren, email: dto.email },
      undefined,
      session,
    );
    const setor = await this.exigirSetorAtivo(dto.setorId, session);
    const subsetorId = await this.resolverSubsetor(
      dto.formacao,
      setor,
      dto.subsetorId,
      session,
    );

    const senha = await this.hashSenhaPadrao();
    const usuario = await this.usuariosService.criar(
      {
        nome: dto.nome,
        email: dto.email,
        cpf: dto.cpf,
        senha,
        senhaTemporaria: true,
        tipoUsuario: TipoUsuario.PROFISSIONAL_DA_SAUDE,
      },
      session,
    );

    try {
      const status = dto.status ?? StatusProfissional.ATIVO;
      const dados = {
        usuarioId: usuario._id,
        coren: dto.coren,
        formacao: dto.formacao,
        tipoVinculo: dto.tipoVinculo,
        setorId: setor?._id ?? null,
        subsetorId,
        status,
        desativadoEm:
          status === StatusProfissional.DESATIVADO ? new Date() : null,
      };
      const profissional = session
        ? (await this.profissionalModel.create([dados], { session }))[0]
        : await this.profissionalModel.create(dados);
      return this.paraResposta(
        profissional,
        usuario,
        setor.nome,
        await this.nomeDoSubsetor(subsetorId, session),
      );
    } catch (erro) {
      // Sem sessão não há transação: desfaz o usuário criado na primeira etapa. Com sessão, o rollback é do chamador.
      if (!session)
        await this.usuariosService.removerCriacaoParcial(usuario._id);
      throw erro;
    }
  }

  /** DA03: busca (nome, CPF ou COREN), filtros por formação/status/vínculo e ordenação por nome. */
  async listar(
    query: ListProfissionaisQueryDto,
  ): Promise<ProfissionalListaDto> {
    const filtro: Record<string, unknown> = {};
    if (query.formacao) filtro.formacao = query.formacao;
    if (query.status) filtro.status = query.status;
    if (query.tipoVinculo) filtro.tipoVinculo = query.tipoVinculo;
    if (query.setorId) filtro.setorId = new Types.ObjectId(query.setorId);
    if (query.semSetor === true) filtro.setorId = null;
    if (query.subsetorId)
      filtro.subsetorId = new Types.ObjectId(query.subsetorId);

    const pipeline: PipelineStage[] = [
      { $match: filtro },
      {
        $lookup: {
          from: "usuarios",
          localField: "usuarioId",
          foreignField: "_id",
          as: "usuario",
          // Projeção explícita: o hash da senha e os tokens nunca saem do banco.
          pipeline: [{ $project: { nome: 1, cpf: 1, email: 1 } }],
        },
      },
      { $unwind: "$usuario" },
      {
        $lookup: {
          from: "setores",
          localField: "setorId",
          foreignField: "_id",
          as: "setor",
          pipeline: [{ $project: { nome: 1, possuiSubsetores: 1 } }],
        },
      },
      { $unwind: { path: "$setor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "subsetores",
          localField: "subsetorId",
          foreignField: "_id",
          as: "subsetor",
          pipeline: [{ $project: { nome: 1 } }],
        },
      },
      { $unwind: { path: "$subsetor", preserveNullAndEmptyArrays: true } },
    ];

    // Pendência de adequação: técnico de setor que passou a ter subsetores e ainda não tem subsetor.
    if (query.semSubsetor === true) {
      pipeline.push({
        $match: {
          formacao: Formacao.TECNICO,
          subsetorId: null,
          "setor.possuiSubsetores": true,
        },
      });
    }

    if (query.busca) {
      const condicoes: Record<string, unknown>[] = [
        {
          "usuario.nome": {
            $regex: regexSemAcentos(query.busca),
            $options: "i",
          },
        },
        { coren: { $regex: escaparRegex(query.busca), $options: "i" } },
      ];
      const digitos = somenteDigitos(query.busca);
      if (digitos) condicoes.push({ "usuario.cpf": { $regex: digitos } });
      pipeline.push({ $match: { $or: condicoes } });
    }

    pipeline.push(
      {
        $sort: { "usuario.nome": query.ordem === Ordem.DESC ? -1 : 1, _id: 1 },
      },
      {
        $facet: {
          data: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          total: [{ $count: "total" }],
        },
      },
    );

    const [resultado] = await this.profissionalModel
      .aggregate<{
        data: ProfissionalAgregado[];
        total: { total: number }[];
      }>(pipeline)
      .collation(COLLATION_PT)
      .exec();
    const total = resultado.total[0]?.total ?? 0;

    return {
      data: resultado.data.map((item) => this.agregadoParaResposta(item)),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Lista todos os profissionais, sem filtros nem paginação, ordenados por nome. */
  async listarTodos(): Promise<ProfissionalResponseDto[]> {
    const { data } = await this.listar({
      ordem: Ordem.ASC,
      page: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    return data;
  }

  async obter(id: string): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id);
    return this.paraResposta(
      profissional,
      usuario,
      await this.nomeDoSetor(profissional.setorId),
      await this.nomeDoSubsetor(profissional.subsetorId),
    );
  }

  /** DA03: edição. Se o status passar para "desativado", aplica a regra do DA04. */
  async atualizar(
    id: string,
    dto: UpdateProfissionalDto,
    session?: ClientSession,
  ): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id, session);
    await this.garantirNaoCadastrado(
      { email: dto.email },
      { usuarioId: usuario._id, profissionalId: profissional._id },
      session,
    );

    if (
      dto.setorId !== undefined ||
      dto.subsetorId !== undefined ||
      dto.formacao !== undefined
    ) {
      const setor =
        dto.setorId !== undefined
          ? await this.exigirSetorAtivo(dto.setorId, session)
          : profissional.setorId
            ? await this.setorModel
                .findById(profissional.setorId)
                .session(session ?? null)
                .lean()
                .exec()
            : null;
      const mudouSetor =
        setor !== null && !setor._id.equals(profissional.setorId ?? undefined);
      if (mudouSetor)
        await this.exigirSemPlantoesFuturosAoMudarSetor(profissional);
      if (!setor && dto.subsetorId) {
        throw new UnprocessableEntityException(
          "Selecione um setor antes do subsetor.",
        );
      }
      // Cadastro legado sem setor e sem setorId no pedido: não há vínculo a validar.
      if (setor) {
        const formacao = dto.formacao ?? profissional.formacao;
        // Sem subsetorId no pedido, o vínculo atual é herdado, exceto ao trocar de setor (o subsetor antigo é de outro setor).
        const herdado = dto.subsetorId === undefined;
        const atual = mudouSetor
          ? null
          : (profissional.subsetorId?.toString() ?? null);
        // Ao virar enfermeiro, um subsetor herdado deixa de se aplicar (enfermeiro é vinculado só ao setor).
        const solicitado = herdado
          ? formacao === Formacao.ENFERMEIRO
            ? null
            : atual
          : dto.subsetorId;
        profissional.subsetorId = await this.resolverSubsetor(
          formacao,
          setor,
          solicitado,
          session,
        );
        profissional.setorId = setor._id;
      }
    }

    if (dto.status && dto.status !== profissional.status) {
      await this.aplicarStatus(profissional, dto.status);
    }

    usuario.set(semUndefined({ email: dto.email }));
    profissional.set(
      semUndefined({ formacao: dto.formacao, tipoVinculo: dto.tipoVinculo }),
    );
    await usuario.save({ session });
    await profissional.save({ session });
    return this.paraResposta(
      profissional,
      usuario,
      await this.nomeDoSetor(profissional.setorId, session),
      await this.nomeDoSubsetor(profissional.subsetorId, session),
    );
  }

  /** DA04: desativação lógica. O registro é preservado e nenhum DELETE físico é feito. */
  async desativar(id: string): Promise<ProfissionalResponseDto> {
    const { profissional, usuario } = await this.carregar(id);
    if (profissional.status !== StatusProfissional.DESATIVADO) {
      await this.aplicarStatus(profissional, StatusProfissional.DESATIVADO);
      await profissional.save();
    }
    return this.paraResposta(
      profissional,
      usuario,
      await this.nomeDoSetor(profissional.setorId),
      await this.nomeDoSubsetor(profissional.subsetorId),
    );
  }

  /** Atualiza o status em memória, validando a regra de plantões futuros ao desativar. */
  private async aplicarStatus(
    profissional: ProfissionalDocument,
    status: StatusProfissional,
  ): Promise<void> {
    if (status === StatusProfissional.DESATIVADO) {
      const pendentes = await this.plantoesFuturos.buscarPublicadosFuturos(
        profissional._id.toString(),
      );
      if (pendentes.length > 0) {
        throw new ConflictException({
          message:
            "Não é possível desativar: o profissional possui plantões futuros em escalas publicadas que precisam de cobertura.",
          plantoes: pendentes,
        });
      }
    }
    profissional.status = status;
    profissional.desativadoEm =
      status === StatusProfissional.DESATIVADO ? new Date() : null;
  }

  /** O setor fixo precisa existir e estar ativo (validação no backend, independente do formulário). */
  private async exigirSetorAtivo(setorId: string, session?: ClientSession) {
    const setor = Types.ObjectId.isValid(setorId)
      ? await this.setorModel
          .findById(setorId)
          .session(session ?? null)
          .lean()
          .exec()
      : null;
    if (!setor) {
      throw new UnprocessableEntityException({
        message: "Setor não encontrado.",
        erros: ["Selecione um setor cadastrado."],
      });
    }
    if (!setor.ativo) {
      throw new UnprocessableEntityException({
        message: "Setor inativo.",
        erros: ["Selecione um setor ativo."],
      });
    }
    return setor;
  }

  /**
   * Regra do vínculo setor/subsetor (validada no backend, independente do formulário):
   * - enfermeiro: só o setor, nunca subsetor;
   * - técnico de setor sem subsetores: só o setor, nunca subsetor;
   * - técnico de setor com subsetores: subsetor opcional; se informado, ativo e pertencente a ESTE setor.
   * Devolve o `subsetorId` a persistir (nulo quando não se aplica).
   */
  private async resolverSubsetor(
    formacao: Formacao,
    setor: { _id: Types.ObjectId; nome: string; possuiSubsetores?: boolean },
    subsetorId: string | null | undefined,
    session?: ClientSession,
  ): Promise<Types.ObjectId | null> {
    const erro = (message: string) =>
      new UnprocessableEntityException({ message, erros: [message] });
    if (formacao === Formacao.ENFERMEIRO) {
      if (subsetorId)
        throw erro(
          "Enfermeiros são vinculados diretamente ao setor, sem subsetor.",
        );
      return null;
    }
    if (!setor.possuiSubsetores) {
      if (subsetorId)
        throw erro(`O setor ${setor.nome} não possui subsetores.`);
      return null;
    }
    if (!subsetorId) return null;
    const subsetor = Types.ObjectId.isValid(subsetorId)
      ? await this.subsetorModel
          .findById(subsetorId)
          .session(session ?? null)
          .lean()
          .exec()
      : null;
    if (!subsetor) throw erro("Subsetor não encontrado.");
    if (!subsetor.setorId.equals(setor._id))
      throw erro("O subsetor selecionado pertence a outro setor.");
    if (!subsetor.ativo)
      throw erro("Subsetor inativo: selecione um subsetor ativo.");
    return subsetor._id;
  }

  /** Trocar o setor com plantões publicados futuros deixaria a escala vigente fora da regra do setor fixo. */
  private async exigirSemPlantoesFuturosAoMudarSetor(
    profissional: ProfissionalDocument,
  ): Promise<void> {
    if (!profissional.setorId) return; // atribuição inicial de um cadastro legado
    const pendentes = await this.plantoesFuturos.buscarPublicadosFuturos(
      profissional._id.toString(),
    );
    if (pendentes.length > 0) {
      throw new ConflictException({
        message:
          "Não é possível trocar o setor: o profissional possui plantões futuros em escalas publicadas no setor atual.",
        plantoes: pendentes,
      });
    }
  }

  private async nomeDoSetor(
    setorId: Types.ObjectId | null | undefined,
    session?: ClientSession,
  ): Promise<string | null> {
    if (!setorId) return null;
    return (
      (
        await this.setorModel
          .findById(setorId, { nome: 1 })
          .session(session ?? null)
          .lean()
          .exec()
      )?.nome ?? null
    );
  }

  private async nomeDoSubsetor(
    subsetorId: Types.ObjectId | null | undefined,
    session?: ClientSession,
  ): Promise<string | null> {
    if (!subsetorId) return null;
    return (
      (
        await this.subsetorModel
          .findById(subsetorId, { nome: 1 })
          .session(session ?? null)
          .lean()
          .exec()
      )?.nome ?? null
    );
  }

  private async carregar(
    id: string,
    session?: ClientSession,
  ): Promise<{ profissional: ProfissionalDocument; usuario: UsuarioDocument }> {
    const profissional = await this.profissionalModel
      .findById(id)
      .session(session ?? null)
      .exec();
    const usuario = profissional
      ? await this.usuariosService.buscarPorId(profissional.usuarioId, session)
      : null;
    if (!profissional || !usuario)
      throw new NotFoundException("Profissional não encontrado.");
    return { profissional, usuario };
  }

  /** "Profissional já cadastrado?" — CPF e COREN (DA02) e e-mail de acesso, ignorando o próprio registro na edição. */
  private async garantirNaoCadastrado(
    campos: { cpf?: string; coren?: string; email?: string },
    proprio?: { usuarioId: Types.ObjectId; profissionalId: Types.ObjectId },
    session?: ClientSession,
  ): Promise<void> {
    // Sequencial: operações concorrentes numa mesma sessão transacional não são suportadas.
    const porCpf = campos.cpf
      ? await this.usuariosService.buscarPorCpf(campos.cpf, session)
      : null;
    const porEmail = campos.email
      ? await this.usuariosService.buscarPorEmail(campos.email, false, session)
      : null;
    const porCoren = campos.coren
      ? await this.profissionalModel
          .findOne({ coren: campos.coren })
          .session(session ?? null)
          .exec()
      : null;

    const conflitos: string[] = [];
    if (porCpf && !porCpf._id.equals(proprio?.usuarioId)) conflitos.push("CPF");
    if (porCoren && !porCoren._id.equals(proprio?.profissionalId))
      conflitos.push("COREN");
    if (conflitos.length > 0) {
      throw new ConflictException(
        `Profissional já cadastrado com o mesmo ${conflitos.join(" e ")}.`,
      );
    }
    if (porEmail && !porEmail._id.equals(proprio?.usuarioId)) {
      throw new ConflictException("E-mail já utilizado por outro usuário.");
    }
  }

  private paraResposta(
    profissional: ProfissionalDocument,
    usuario: UsuarioPublico,
    setorNome: string | null,
    subsetorNome: string | null,
  ): ProfissionalResponseDto {
    return {
      id: profissional._id.toString(),
      nome: usuario.nome,
      cpf: formatarCpf(usuario.cpf),
      email: usuario.email,
      coren: profissional.coren,
      formacao: profissional.formacao,
      tipoVinculo: profissional.tipoVinculo,
      status: profissional.status,
      setorId: profissional.setorId ? String(profissional.setorId) : null,
      setorNome,
      subsetorId: profissional.subsetorId
        ? String(profissional.subsetorId)
        : null,
      subsetorNome,
      createdAt: profissional.createdAt,
      updatedAt: profissional.updatedAt,
    };
  }

  private agregadoParaResposta(
    item: ProfissionalAgregado,
  ): ProfissionalResponseDto {
    return {
      id: item._id.toString(),
      nome: item.usuario.nome,
      cpf: formatarCpf(item.usuario.cpf),
      email: item.usuario.email,
      coren: item.coren,
      formacao: item.formacao,
      tipoVinculo: item.tipoVinculo,
      status: item.status,
      setorId: item.setorId ? String(item.setorId) : null,
      setorNome: item.setor?.nome ?? null,
      subsetorId: item.subsetorId ? String(item.subsetorId) : null,
      subsetorNome: item.subsetor?.nome ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
