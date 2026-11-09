import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import {
  type ClientSession,
  type Connection,
  type QueryFilter,
  type Model,
  Types,
  isValidObjectId,
} from 'mongoose';
import { executarTransacao } from '../common/utils/mongo-transaction';
import {
  AuditoriaExtra,
  AuditoriaExtraDocument,
  AuditoriaExtraSchema,
  ExtraEventoTipo,
  ExtraMotivo,
  ExtraOpcao,
  ExtraProgramado,
  ExtraProgramadoDocument,
  ExtraProgramadoSchema,
  ExtraProgramadoSituacao,
  calcularIntervaloJornada,
  validarDataCivil,
} from './extras.schema';
import { Profissional, ProfissionalDocument, ProfissionalSchema } from '../profissionais/schemas/profissional.schema';
import { StatusProfissional, TipoVinculo } from '../profissionais/profissionais.enums';
import { Setor, SetorDocument, SetorSchema } from '../setores/schemas/setor.schema';
import { Restricao, RestricaoDocument, RestricaoSchema, TipoRestricao } from '../restricoes/restricao.schema';
import {
  Escala,
  EscalaSchema,
  OrigemCobertura,
  Plantao,
  PlantaoProfissional,
  PlantaoProfissionalSchema,
  PlantaoSchema,
  StatusEscala,
  TipoPlantao,
  VersaoEscala,
  VersaoEscalaSchema,
} from '../escalas/schemas';
import { Configuracao, ConfiguracaoSchema } from '../configuracoes/configuracao.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema';
import { ListarExtrasDto } from './dto/listar-extras.dto';
import { calcularBloqueiosDoProfissional, type RestricaoEntrada } from '../escalas/montar-problema';
import { calcularPendenciasCobertura, resumirCobertura, type AlocacaoPlantaoValidacao } from '../escalas/regras-plantao';
import { utcDate } from '../common/utils/date';

export type CriarExtraDto = {
  data: string;
  opcao: ExtraOpcao;
  setorId: Types.ObjectId | string;
  funcao: 'enfermeiro' | 'tecnico';
  substitutoId: Types.ObjectId | string;
  motivo: string;
  cobertoId?: Types.ObjectId | string | null;
  restricaoId?: Types.ObjectId | string | null;
  observacao?: string | null;
  criadoPor: Types.ObjectId | string;
  escalaId?: Types.ObjectId | string | null;
  plantaoId?: Types.ObjectId | string | null;
  plantaoProfissionalId?: Types.ObjectId | string | null;
};

export type AtualizarExtraDto = {
  data?: string;
  opcao?: ExtraOpcao;
  setorId?: Types.ObjectId | string;
  funcao?: 'enfermeiro' | 'tecnico';
  substitutoId?: Types.ObjectId | string;
  motivo?: string;
  cobertoId?: Types.ObjectId | string | null;
  restricaoId?: Types.ObjectId | string | null;
  observacao?: string | null;
  atualizadoPor: Types.ObjectId | string;
  revisaoEsperada: number;
  escalaId?: Types.ObjectId | string | null;
  plantaoId?: Types.ObjectId | string | null;
  plantaoProfissionalId?: Types.ObjectId | string | null;
};

export type CancelarExtraDto = {
  justificativa: string;
  canceladoPor: Types.ObjectId | string;
  revisaoEsperada: number;
};

export type ValidarExtraDto = {
  data: string;
  opcao: ExtraOpcao;
  setorId: Types.ObjectId | string;
  funcao: 'enfermeiro' | 'tecnico';
  substitutoId: Types.ObjectId | string;
  motivo: string;
  cobertoId?: Types.ObjectId | string | null;
  restricaoId?: Types.ObjectId | string | null;
  observacao?: string | null;
  escalaId?: Types.ObjectId | string | null;
  plantaoId?: Types.ObjectId | string | null;
  plantaoProfissionalId?: Types.ObjectId | string | null;
};

interface ProfissionalPopulado {
  _id: Types.ObjectId;
  coren?: string;
  formacao?: string;
  tipoVinculo?: string;
  usuarioId?: { _id: Types.ObjectId; nome: string; email: string };
  nome?: string;
  email?: string;
}

interface ExtraPopulado {
  _id: Types.ObjectId;
  substitutoId?: ProfissionalPopulado;
  cobertoId?: ProfissionalPopulado;
  plantaoProfissionalId?: Types.ObjectId | null;
  escalaId?: Types.ObjectId | null;
  [key: string]: unknown;
}

export interface ErroValidacaoDetalhe {
  regra: string;
  campo?: string;
  mensagem: string;
}

@Injectable()
export class ExtrasService {
  private readonly extraModel: Model<ExtraProgramado>;
  private readonly auditoriaModel: Model<AuditoriaExtra>;
  private readonly profissionalModel: Model<Profissional>;
  private readonly setorModel: Model<Setor>;
  private readonly restricaoModel: Model<Restricao>;
  private readonly plantaoModel: Model<Plantao>;
  private readonly plantaoProfissionalModel: Model<PlantaoProfissional>;
  private readonly escalaModel: Model<Escala>;
  private readonly versaoEscalaModel: Model<VersaoEscala>;
  private readonly configuracaoModel: Model<Configuracao>;
  private readonly usuarioModel: Model<Usuario>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.extraModel =
      (this.connection.models['ExtraProgramado'] as Model<ExtraProgramado> | undefined) ??
      this.connection.model<ExtraProgramado>('ExtraProgramado', ExtraProgramadoSchema);

    this.auditoriaModel =
      (this.connection.models['AuditoriaExtra'] as Model<AuditoriaExtra> | undefined) ??
      this.connection.model<AuditoriaExtra>('AuditoriaExtra', AuditoriaExtraSchema);

    this.profissionalModel =
      (this.connection.models[Profissional.name] as Model<Profissional> | undefined) ??
      this.connection.model<Profissional>(Profissional.name, ProfissionalSchema);

    this.setorModel =
      (this.connection.models[Setor.name] as Model<Setor> | undefined) ??
      this.connection.model<Setor>(Setor.name, SetorSchema);

    this.restricaoModel =
      (this.connection.models[Restricao.name] as Model<Restricao> | undefined) ??
      this.connection.model<Restricao>(Restricao.name, RestricaoSchema);

    this.plantaoModel =
      (this.connection.models[Plantao.name] as Model<Plantao> | undefined) ??
      this.connection.model<Plantao>(Plantao.name, PlantaoSchema);

    this.plantaoProfissionalModel =
      (this.connection.models[PlantaoProfissional.name] as Model<PlantaoProfissional> | undefined) ??
      this.connection.model<PlantaoProfissional>(PlantaoProfissional.name, PlantaoProfissionalSchema);

    this.escalaModel =
      (this.connection.models[Escala.name] as Model<Escala> | undefined) ??
      this.connection.model<Escala>(Escala.name, EscalaSchema);

    this.versaoEscalaModel =
      (this.connection.models[VersaoEscala.name] as Model<VersaoEscala> | undefined) ??
      this.connection.model<VersaoEscala>(VersaoEscala.name, VersaoEscalaSchema);

    this.configuracaoModel =
      (this.connection.models[Configuracao.name] as Model<Configuracao> | undefined) ??
      this.connection.model<Configuracao>(Configuracao.name, ConfiguracaoSchema);

    this.usuarioModel =
      (this.connection.models[Usuario.name] as Model<Usuario> | undefined) ??
      this.connection.model<Usuario>(Usuario.name, UsuarioSchema);
  }

  async inicializarIndices(): Promise<void> {
    await this.extraModel.createIndexes();
    await this.auditoriaModel.createIndexes();
    await this.plantaoProfissionalModel.createIndexes();
  }

  normalizarId(valor: Types.ObjectId | string | null | undefined, campo = 'ID'): Types.ObjectId | null {
    if (valor == null || valor === '') return null;
    if (valor instanceof Types.ObjectId) return valor;
    if (typeof valor === 'string') {
      if (!isValidObjectId(valor)) {
        throw new BadRequestException(`${campo} inválido: ${valor}.`);
      }
      return new Types.ObjectId(valor);
    }
    throw new BadRequestException(`${campo} inválido.`);
  }

  private async registrarEvento(
    extraId: Types.ObjectId,
    evento: ExtraEventoTipo,
    usuarioId: Types.ObjectId,
    revisao: number,
    detalhes: Record<string, unknown> = {},
    session?: ClientSession,
  ): Promise<void> {
    await this.auditoriaModel.create(
      [
        {
          extraId,
          evento,
          usuarioId,
          revisao,
          detalhes,
          ocorridoEm: new Date(),
        },
      ],
      session ? { session } : {},
    );
  }

  verificarEscalaEditavel(escala: Escala): void {
    if (
      escala.status === StatusEscala.VALIDADA ||
      escala.status === StatusEscala.PUBLICADA ||
      escala.status === StatusEscala.FINALIZADA
    ) {
      throw new ConflictException('Escalas validadas, publicadas ou finalizadas não podem ser alteradas diretamente.');
    }
  }

  private async atualizarPendenciasEscala(escalaId: Types.ObjectId, session: ClientSession): Promise<void> {
    const escala = await this.escalaModel.findById(escalaId).session(session).exec();
    if (!escala) return;

    const plantoes = await this.plantaoModel.find({ escalaId }).session(session).lean().exec();
    const idsPlantoes = plantoes.map((item) => item._id);
    const vinculos = idsPlantoes.length
      ? await this.plantaoProfissionalModel.find({ plantaoId: { $in: idsPlantoes } }).session(session).lean().exec()
      : [];

    const geracao = (escala.geracao ?? {}) as {
      configuracao?: unknown;
      escopo?: { setorIds?: string[]; turnos?: ('diurno' | 'noturno')[] };
    };

    const idsSetores = plantoes.map((item) => item.setorId);
    const setores = await this.setorModel
      .find({
        $or: [
          { ativo: true },
          { _id: { $in: idsSetores } },
          { _id: { $in: (geracao.escopo?.setorIds ?? []).map((id) => new Types.ObjectId(id)) } },
        ],
      })
      .session(session)
      .lean()
      .exec();

    const plantaoPorId = new Map(plantoes.map((item) => [String(item._id), item]));
    const profissionaisDocs = await this.profissionalModel
      .find({ status: StatusProfissional.ATIVO })
      .session(session)
      .lean()
      .exec();
    const profissionais = new Map(profissionaisDocs.map((item) => [String(item._id), item]));

    const alocacoes = vinculos.flatMap((vinculo) => {
      const plantao = plantaoPorId.get(String(vinculo.plantaoId));
      const profissional = profissionais.get(String(vinculo.profissionalId));
      if (!plantao || !profissional) return [];
      return [
        {
          profissional: {
            id: String(profissional._id),
            nome: String(profissional._id),
            formacao: profissional.formacao,
            tipoVinculo: profissional.tipoVinculo,
            status: profissional.status,
          },
          funcao: vinculo.funcao as AlocacaoPlantaoValidacao['funcao'],
          data: plantao.data,
          horarioInicio: plantao.horarioInicio,
          duracaoHoras: plantao.duracaoHoras,
          tipo: plantao.tipo,
          setorId: String(plantao.setorId),
        },
      ];
    });

    const setorIdsDoEscopo = new Set(
      geracao.escopo?.setorIds ?? setores.filter((item) => item.ativo).map((item) => String(item._id)),
    );
    for (const plantao of plantoes) setorIdsDoEscopo.add(String(plantao.setorId));
    const turnosDoEscopo = new Set<'diurno' | 'noturno'>(geracao.escopo?.turnos ?? ['diurno', 'noturno']);
    for (const plantao of plantoes) {
      if (plantao.duracaoHoras >= 24) {
        turnosDoEscopo.add('diurno');
        turnosDoEscopo.add('noturno');
      } else {
        turnosDoEscopo.add(plantao.horarioInicio === '07:00' ? 'diurno' : 'noturno');
      }
    }
    const escopoAtualizado = { setorIds: [...setorIdsDoEscopo], turnos: [...turnosDoEscopo] };
    const setoresDoEscopo = setores.filter((item) => setorIdsDoEscopo.has(String(item._id)));

    const pendencias = calcularPendenciasCobertura({
      ano: escala.ano,
      mes: escala.mes,
      setores: setoresDoEscopo.map((item) => ({
        id: String(item._id),
        nome: item.nome,
        turnos: item.turnos,
      })),
      alocacoes,
      turnos: escopoAtualizado.turnos,
    });

    const cobertura = resumirCobertura({
      ano: escala.ano,
      mes: escala.mes,
      setores: setoresDoEscopo,
      turnos: escopoAtualizado.turnos,
      pendencias,
    });

    await this.escalaModel.updateOne(
      { _id: escala._id },
      {
        $set: {
          'geracao.pendencias': pendencias,
          'geracao.escopo': escopoAtualizado,
          'geracao.resumo.alocacoes': vinculos.length,
          'geracao.resumo.vagasDescobertas': pendencias.length,
          'geracao.resumo.cobertura': cobertura,
        },
      },
      { session },
    );
  }

  private async executarConciliacao(
    extra: ExtraProgramadoDocument,
    escala: Escala & { _id: Types.ObjectId },
    usuarioId: Types.ObjectId,
    session: ClientSession,
  ): Promise<ExtraProgramadoDocument> {
    const [anoExtra, mesExtra] = extra.data.split('-').map(Number);
    if (escala.ano !== anoExtra || escala.mes !== mesExtra) {
      throw new UnprocessableEntityException('A data do extra não pertence ao período da escala.');
    }

    this.verificarEscalaEditavel(escala);

    if (
      extra.escalaId &&
      extra.escalaId.equals(escala._id) &&
      extra.plantaoProfissionalId
    ) {
      const vinculoExistente = await this.plantaoProfissionalModel
        .findOne({ _id: extra.plantaoProfissionalId, extraProgramadoId: extra._id })
        .session(session)
        .exec();
      if (vinculoExistente) {
        return extra;
      }
    }

    if (extra.plantaoProfissionalId) {
      await this.plantaoProfissionalModel.deleteOne({ _id: extra.plantaoProfissionalId }, { session });
      if (extra.plantaoId) {
        const restantes = await this.plantaoProfissionalModel
          .countDocuments({ plantaoId: extra.plantaoId })
          .session(session)
          .exec();
        if (restantes === 0) {
          await this.plantaoModel.deleteOne({ _id: extra.plantaoId, tipo: TipoPlantao.EXTRA }, { session });
        }
      }
    }

    const dataPlantao = new Date(`${extra.data}T00:00:00.000Z`);
    const horarioInicio = extra.opcao === ExtraOpcao.DOZE_NOITE ? '19:00' : '07:00';
    const horarioFim = extra.opcao === ExtraOpcao.DOZE_DIA ? '19:00' : '07:00';
    const duracaoHoras = extra.opcao === ExtraOpcao.VINTE_QUATRO_HORAS ? 24 : 12;

    let plantao = await this.plantaoModel
      .findOne({
        escalaId: escala._id,
        setorId: extra.setorId,
        data: dataPlantao,
        horarioInicio,
        horarioFim,
        duracaoHoras,
        tipo: TipoPlantao.EXTRA,
      })
      .session(session)
      .exec();

    if (!plantao) {
      const [novoPlantao] = await this.plantaoModel.create(
        [
          {
            escalaId: escala._id,
            setorId: extra.setorId,
            data: dataPlantao,
            horarioInicio,
            horarioFim,
            duracaoHoras,
            tipo: TipoPlantao.EXTRA,
          },
        ],
        { session },
      );
      plantao = novoPlantao;
    }

    const [vinculo] = await this.plantaoProfissionalModel.create(
      [
        {
          plantaoId: plantao._id,
          profissionalId: extra.substitutoId,
          funcao: extra.funcao,
          lideranca: false,
          origemCobertura: OrigemCobertura.COMPLEMENTAR,
          extraProgramadoId: extra._id,
        },
      ],
      { session },
    );

    const revisaoNova = extra.revisao + 1;
    extra.escalaId = escala._id;
    extra.plantaoId = plantao._id;
    extra.plantaoProfissionalId = vinculo._id;
    extra.revisao = revisaoNova;
    extra.atualizadoPor = usuarioId;
    await extra.save({ session });

    await this.registrarEvento(
      extra._id,
      ExtraEventoTipo.VINCULADO,
      usuarioId,
      revisaoNova,
      {
        escalaId: String(escala._id),
        plantaoId: String(plantao._id),
        plantaoProfissionalId: String(vinculo._id),
      },
      session,
    );

    await this.escalaModel.updateOne(
      { _id: escala._id },
      { $unset: { validacao: 1 }, $inc: { revisao: 1 } },
      { session },
    );
    await this.atualizarPendenciasEscala(escala._id, session);

    return extra;
  }

  async validarElegibilidade(
    dto: ValidarExtraDto,
    session?: ClientSession,
  ): Promise<{
    substituto: ProfissionalDocument;
    setor: SetorDocument;
    coberto?: ProfissionalDocument | null;
    restricao?: RestricaoDocument | null;
  }> {
    const substitutoId = this.normalizarId(dto.substitutoId, 'Substituto');
    if (!substitutoId) throw new BadRequestException('Substituto é obrigatório.');

    const substituto = await this.profissionalModel
      .findById(substitutoId)
      .session(session ?? null)
      .exec();
    if (!substituto) {
      throw new NotFoundException({
        message: 'Profissional substituto não encontrado.',
        erros: [{ regra: 'substituto_inexistente', campo: 'substitutoId', mensagem: 'Profissional substituto não encontrado.' }],
      });
    }
    if (substituto.status !== StatusProfissional.ATIVO) {
      const msg = 'Profissional substituto não está ativo.';
      throw new UnprocessableEntityException({
        message: msg,
        erros: [{ regra: 'status_profissional', campo: 'substitutoId', mensagem: msg }],
      });
    }
    if (substituto.formacao !== dto.funcao) {
      const msg = `Formação incompatível: profissional é ${substituto.formacao}, mas a função exigida é ${dto.funcao}.`;
      throw new UnprocessableEntityException({
        message: msg,
        erros: [{ regra: 'formacao_incompativel', campo: 'funcao', mensagem: msg }],
      });
    }

    const setorId = this.normalizarId(dto.setorId, 'Setor');
    if (!setorId) throw new BadRequestException('Setor é obrigatório.');

    const setor = await this.setorModel
      .findById(setorId)
      .session(session ?? null)
      .exec();
    if (!setor) {
      throw new NotFoundException({
        message: 'Setor não encontrado.',
        erros: [{ regra: 'setor_inexistente', campo: 'setorId', mensagem: 'Setor não encontrado.' }],
      });
    }
    if (!setor.ativo) {
      const msg = 'Setor está inativo.';
      throw new UnprocessableEntityException({
        message: msg,
        erros: [{ regra: 'setor_inativo', campo: 'setorId', mensagem: msg }],
      });
    }

    const motivoNorm = (dto.motivo ?? '').trim().toLowerCase();
    const motivosAfastamento = ['ferias', 'ausencia', 'atestado'];
    const exigeCoberto = motivosAfastamento.includes(motivoNorm);

    let coberto: ProfissionalDocument | null = null;
    if (exigeCoberto && !dto.cobertoId) {
      const msg = 'Profissional coberto é obrigatório para motivos de afastamento/férias/atestado.';
      throw new BadRequestException({
        message: msg,
        erros: [{ regra: 'coberto_obrigatorio', campo: 'cobertoId', mensagem: msg }],
      });
    }

    if (dto.cobertoId) {
      const cobertoId = this.normalizarId(dto.cobertoId, 'cobertoId');
      if (cobertoId && substitutoId.equals(cobertoId)) {
        const msg = 'O profissional substituto não pode ser igual ao profissional coberto.';
        throw new BadRequestException({
          message: msg,
          erros: [{ regra: 'substituto_igual_coberto', campo: 'cobertoId', mensagem: msg }],
        });
      }
      coberto = await this.profissionalModel
        .findById(cobertoId)
        .session(session ?? null)
        .exec();
      if (!coberto) {
        throw new NotFoundException({
          message: 'Profissional coberto não encontrado.',
          erros: [{ regra: 'coberto_inexistente', campo: 'cobertoId', mensagem: 'Profissional coberto não encontrado.' }],
        });
      }
    }

    let restricao: RestricaoDocument | null = null;
    if (dto.restricaoId) {
      const restricaoId = this.normalizarId(dto.restricaoId, 'restricaoId');
      restricao = await this.restricaoModel
        .findById(restricaoId)
        .session(session ?? null)
        .exec();
      if (!restricao) {
        throw new NotFoundException({
          message: 'Restrição de afastamento não encontrada.',
          erros: [{ regra: 'restricao_inexistente', campo: 'restricaoId', mensagem: 'Restrição de afastamento não encontrada.' }],
        });
      }
      if (dto.cobertoId) {
        const cobertoId = this.normalizarId(dto.cobertoId, 'cobertoId')!;
        if (!restricao.profissionalId.equals(cobertoId)) {
          const msg = 'A restrição informada não pertence ao profissional coberto.';
          throw new BadRequestException({
            message: msg,
            erros: [{ regra: 'restricao_incompativel', campo: 'restricaoId', mensagem: msg }],
          });
        }
      }
    }

    return { substituto, setor, coberto, restricao };
  }

  async validarDisponibilidade(
    substitutoId: Types.ObjectId,
    data: string,
    opcao: ExtraOpcao,
    session?: ClientSession,
  ): Promise<void> {
    validarDataCivil(data);
    const { inicio: inicioExtra, fim: fimExtra } = calcularIntervaloJornada(data, opcao);
    const [ano, mes, dia] = data.split('-').map(Number);

    const restricoes = await this.restricaoModel
      .find({ profissionalId: substitutoId })
      .session(session ?? null)
      .lean()
      .exec();

    const restricoesEntrada: RestricaoEntrada[] = restricoes.map((r) => ({
      profissionalId: String(r.profissionalId),
      tipo: r.tipo,
      inicio: r.inicio,
      fim: r.fim,
      diasSemana: r.diasSemana ?? undefined,
      diaSemana: r.diaSemana ?? undefined,
      turno: r.turno ?? undefined,
      motivo: r.motivo ?? undefined,
      observacao: r.observacao ?? undefined,
      instituicao: r.instituicao ?? undefined,
      tipoVinculo: r.tipoVinculo ?? undefined,
    }));

    const bloqueiosMes = calcularBloqueiosDoProfissional(restricoesEntrada, ano, mes);

    if (bloqueiosMes.diasBloqueados.includes(dia)) {
      const motivos = bloqueiosMes.motivosPorDia.get(dia);
      const motivoStr = motivos ? [...motivos].join(', ') : 'indisponivel';
      const msg = `Profissional indisponível na data selecionada: ${motivoStr}.`;
      throw new UnprocessableEntityException({
        message: msg,
        erros: [{ regra: 'indisponivel', campo: 'data', mensagem: msg }],
      });
    }

    const turnosAlocacao: ('diurno' | 'noturno')[] =
      opcao === ExtraOpcao.VINTE_QUATRO_HORAS
        ? ['diurno', 'noturno']
        : opcao === ExtraOpcao.DOZE_DIA
          ? ['diurno']
          : ['noturno'];

    for (const t of turnosAlocacao) {
      const bloqueioTurno = bloqueiosMes.turnosBloqueados.find(
        (tb) => tb.dia === dia && tb.turno === t,
      );
      if (bloqueioTurno) {
        const msg = `Profissional indisponível no turno ${t} na data selecionada: ${bloqueioTurno.motivo}.`;
        throw new UnprocessableEntityException({
          message: msg,
          erros: [{ regra: 'turno_indisponivel', campo: 'opcao', mensagem: msg }],
        });
      }
    }

    for (const r of restricoes) {
      const eBloqueante = [
        TipoRestricao.FERIAS,
        TipoRestricao.AUSENCIA,
        TipoRestricao.INDISPONIVEL,
        TipoRestricao.VINCULO_EXTERNO,
      ].includes(r.tipo);

      if (!eBloqueante) continue;

      const temRecorrencia = (Array.isArray(r.diasSemana) && r.diasSemana.length > 0) || r.diaSemana != null;
      if (!temRecorrencia && !r.turno) {
        const rInicio = new Date(r.inicio).getTime();
        const rFim = new Date(r.fim).getTime();
        if (Math.max(inicioExtra.getTime(), rInicio) < Math.min(fimExtra.getTime(), rFim)) {
          const nomeTipo =
            r.tipo === TipoRestricao.FERIAS
              ? 'férias'
              : r.tipo === TipoRestricao.AUSENCIA
                ? 'ausência'
                : r.tipo;
          const msg = `Profissional indisponível devido a ${nomeTipo} no período da jornada.`;
          throw new UnprocessableEntityException({
            message: msg,
            erros: [{ regra: r.tipo, campo: 'data', mensagem: msg }],
          });
        }
      }
    }

    if (opcao === ExtraOpcao.DOZE_NOITE || opcao === ExtraOpcao.VINTE_QUATRO_HORAS) {
      const proximoDiaDate = new Date(Date.UTC(ano, mes - 1, dia + 1));
      const proxAno = proximoDiaDate.getUTCFullYear();
      const proxMes = proximoDiaDate.getUTCMonth() + 1;
      const proxDia = proximoDiaDate.getUTCDate();

      const bloqueiosProx =
        proxMes === mes
          ? bloqueiosMes
          : calcularBloqueiosDoProfissional(restricoesEntrada, proxAno, proxMes);

      if (bloqueiosProx.diasBloqueados.includes(proxDia)) {
        const motivos = bloqueiosProx.motivosPorDia.get(proxDia);
        const motivoStr = motivos ? [...motivos].join(', ') : 'indisponivel';
        const msg = `Profissional indisponível: jornada atravessa a meia-noite para data bloqueada (${motivoStr}).`;
        throw new UnprocessableEntityException({
          message: msg,
          erros: [{ regra: 'meia_noite_bloqueada', campo: 'opcao', mensagem: msg }],
        });
      }
    }
  }

  async validarSobreposicaoEDescanso(
    substitutoId: Types.ObjectId,
    data: string,
    opcao: ExtraOpcao,
    session?: ClientSession,
    extraIdIgnorar?: Types.ObjectId | null,
    plantaoProfissionalIdIgnorar?: Types.ObjectId | null,
  ): Promise<void> {
    const { inicio: inicioExtra, fim: fimExtra } = calcularIntervaloJornada(data, opcao);
    const duracaoHoras = opcao === ExtraOpcao.VINTE_QUATRO_HORAS ? 24 : 12;
    const horarioInicio = opcao === ExtraOpcao.DOZE_NOITE ? '19:00' : '07:00';
    const [ano, mes, dia] = data.split('-').map(Number);
    const candidataData = utcDate(ano, mes - 1, dia);

    const candidata = {
      data: candidataData,
      horarioInicio,
      duracaoHoras,
      inicioMs: inicioExtra.getTime(),
      fimMs: fimExtra.getTime(),
      origem: 'candidata' as const,
    };

    const janelaInicioMs = inicioExtra.getTime() - 4 * 86400 * 1000;
    const janelaFimMs = fimExtra.getTime() + 4 * 86400 * 1000;

    const queryVinculos: QueryFilter<PlantaoProfissional> = { profissionalId: substitutoId };
    if (plantaoProfissionalIdIgnorar) {
      queryVinculos._id = { $ne: plantaoProfissionalIdIgnorar };
    }
    const vinculos = await this.plantaoProfissionalModel
      .find(queryVinculos)
      .session(session ?? null)
      .lean()
      .exec();

    const plantaoIds = vinculos.map((v) => v.plantaoId);
    const plantoes =
      plantaoIds.length > 0
        ? await this.plantaoModel
            .find({
              _id: { $in: plantaoIds },
              data: {
                $gte: new Date(janelaInicioMs - 86400 * 1000),
                $lte: new Date(janelaFimMs + 86400 * 1000),
              },
            })
            .session(session ?? null)
            .lean()
            .exec()
        : [];

    const plantaoIdsInclusos = new Set(plantoes.map((p) => String(p._id)));
    const vinculoIdsInclusos = new Set(vinculos.map((v) => String(v._id)));

    const queryExtras: QueryFilter<ExtraProgramado> = {
      substitutoId,
      situacao: ExtraProgramadoSituacao.PROGRAMADO,
    };
    if (extraIdIgnorar) {
      queryExtras._id = { $ne: extraIdIgnorar };
    }
    const outrosExtras = await this.extraModel
      .find(queryExtras)
      .session(session ?? null)
      .lean()
      .exec();

    const extrasFiltrados = outrosExtras.filter((e) => {
      if (e.plantaoId && plantaoIdsInclusos.has(String(e.plantaoId))) {
        return false;
      }
      if (e.plantaoProfissionalId && vinculoIdsInclusos.has(String(e.plantaoProfissionalId))) {
        return false;
      }
      if (
        plantaoProfissionalIdIgnorar &&
        e.plantaoProfissionalId &&
        String(e.plantaoProfissionalId) === String(plantaoProfissionalIdIgnorar)
      ) {
        return false;
      }
      return true;
    });

    const agenda = [
      candidata,
      ...plantoes.map((p) => {
        const [h, m] = p.horarioInicio.split(':').map(Number);
        const pInicioMs = utcDate(
          p.data.getUTCFullYear(),
          p.data.getUTCMonth(),
          p.data.getUTCDate(),
          h,
          m,
        ).getTime();
        return {
          data: p.data,
          horarioInicio: p.horarioInicio,
          duracaoHoras: p.duracaoHoras,
          inicioMs: pInicioMs,
          fimMs: pInicioMs + p.duracaoHoras * 3600 * 1000,
          origem: 'plantao' as const,
        };
      }),
      ...extrasFiltrados
        .map((e) => {
          const intervalo = calcularIntervaloJornada(e.data, e.opcao);
          const [anoE, mesE, diaE] = e.data.split('-').map(Number);
          return {
            data: utcDate(anoE, mesE - 1, diaE),
            horarioInicio: e.opcao === ExtraOpcao.DOZE_NOITE ? '19:00' : '07:00',
            duracaoHoras: e.opcao === ExtraOpcao.VINTE_QUATRO_HORAS ? 24 : 12,
            inicioMs: intervalo.inicio.getTime(),
            fimMs: intervalo.fim.getTime(),
            origem: 'extra' as const,
          };
        })
        .filter((e) => e.fimMs >= janelaInicioMs && e.inicioMs <= janelaFimMs),
    ].sort((a, b) => a.inicioMs - b.inicioMs);

    for (let i = 0; i < agenda.length - 1; i++) {
      const a = agenda[i];
      const b = agenda[i + 1];

      const envolveCandidata = a.origem === 'candidata' || b.origem === 'candidata';
      if (!envolveCandidata) continue;

      if (b.inicioMs < a.fimMs) {
        const msg = 'O profissional já possui plantão ou extra programado sobreposto a este horário.';
        throw new UnprocessableEntityException({
          message: msg,
          erros: [{ regra: 'sobreposicao', campo: 'opcao', mensagem: msg }],
        });
      }

      const mesmaData = a.data.getTime() === b.data.getTime();
      const par12Permitido =
        mesmaData &&
        a.duracaoHoras === 12 &&
        a.horarioInicio === '07:00' &&
        b.horarioInicio === '19:00' &&
        b.duracaoHoras === 12;

      if (par12Permitido) continue;

      const descansoObrigatorioHoras = a.duracaoHoras >= 24 ? 72 : 36;
      const descansoObrigatorioMs = descansoObrigatorioHoras * 3600 * 1000;

      if (b.inicioMs < a.fimMs + descansoObrigatorioMs) {
        const msg = 'O profissional não respeita o descanso obrigatório entre plantões.';
        throw new UnprocessableEntityException({
          message: msg,
          erros: [{ regra: 'descanso', campo: 'opcao', mensagem: msg }],
        });
      }
    }
  }

  async validarLimites(
    substituto: ProfissionalDocument,
    data: string,
    session?: ClientSession,
    extraIdIgnorar?: Types.ObjectId | null,
    plantaoProfissionalIdIgnorar?: Types.ObjectId | null,
  ): Promise<void> {
    const [ano, mes] = data.split('-').map(Number);
    const chavePeriodo = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;

    const configDoc = await this.configuracaoModel
      .findOne({ chave: chavePeriodo })
      .session(session ?? null)
      .lean()
      .exec();

    const maxExtrasPadrao = configDoc?.maxExtras ?? 2;
    const maxExtrasConcursado = configDoc?.maxExtrasConcursado ?? 1;
    const maxExtrasClt = configDoc?.maxExtrasClt ?? 1;
    const limitePlantoes = configDoc?.limitePlantoes ?? 12;

    const maxExtrasPermitido =
      substituto.tipoVinculo === TipoVinculo.CONCURSADO && maxExtrasConcursado > 0
        ? maxExtrasConcursado
        : substituto.tipoVinculo === TipoVinculo.CLT && maxExtrasClt > 0
          ? maxExtrasClt
          : maxExtrasPadrao;

    const inicioMes = utcDate(ano, mes - 1, 1);
    const fimMes = utcDate(ano, mes, 0, 23, 59, 59, 999);

    const queryVinculos: QueryFilter<PlantaoProfissional> = { profissionalId: substituto._id };
    if (plantaoProfissionalIdIgnorar) {
      queryVinculos._id = { $ne: plantaoProfissionalIdIgnorar };
    }
    const vinculos = await this.plantaoProfissionalModel
      .find(queryVinculos)
      .session(session ?? null)
      .lean()
      .exec();

    const plantaoIds = vinculos.map((v) => v.plantaoId);
    const plantoes =
      plantaoIds.length > 0
        ? await this.plantaoModel
            .find({
              _id: { $in: plantaoIds },
              data: { $gte: inicioMes, $lte: fimMes },
            })
            .session(session ?? null)
            .lean()
            .exec()
        : [];

    const plantaoIdsInclusos = new Set(plantoes.map((p) => String(p._id)));
    const vinculoIdsInclusos = new Set(vinculos.map((v) => String(v._id)));

    let plantoesRegulares = 0;
    let plantoesExtras = 0;
    for (const p of plantoes) {
      if (p.tipo === TipoPlantao.EXTRA) {
        plantoesExtras++;
      } else {
        plantoesRegulares++;
      }
    }

    const prefixoMes = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
    const queryExtras: QueryFilter<ExtraProgramado> = {
      substitutoId: substituto._id,
      situacao: ExtraProgramadoSituacao.PROGRAMADO,
      data: { $regex: `^${prefixoMes}` },
    };
    if (extraIdIgnorar) {
      queryExtras._id = { $ne: extraIdIgnorar };
    }
    const outrosExtras = await this.extraModel
      .find(queryExtras)
      .session(session ?? null)
      .lean()
      .exec();

    let outrosExtrasContados = 0;
    for (const e of outrosExtras) {
      if (e.plantaoId && plantaoIdsInclusos.has(String(e.plantaoId))) {
        continue;
      }
      if (e.plantaoProfissionalId && vinculoIdsInclusos.has(String(e.plantaoProfissionalId))) {
        continue;
      }
      if (
        plantaoProfissionalIdIgnorar &&
        e.plantaoProfissionalId &&
        String(e.plantaoProfissionalId) === String(plantaoProfissionalIdIgnorar)
      ) {
        continue;
      }
      outrosExtrasContados++;
    }

    const totalExtrasNoMes = plantoesExtras + outrosExtrasContados + 1;
    const totalGeralNoMes = plantoesRegulares + totalExtrasNoMes;

    if (totalExtrasNoMes > maxExtrasPermitido) {
      const msg = `Limite de plantões extras excedido para o período (${totalExtrasNoMes}/${maxExtrasPermitido}).`;
      throw new UnprocessableEntityException({
        message: msg,
        erros: [
          {
            regra: 'limite_extras',
            campo: 'substitutoId',
            mensagem: msg,
          },
        ],
      });
    }

    if (limitePlantoes > 0 && totalGeralNoMes > limitePlantoes) {
      const msg = `Limite total de plantões do período excedido (${totalGeralNoMes}/${limitePlantoes}).`;
      throw new UnprocessableEntityException({
        message: msg,
        erros: [
          {
            regra: 'limite_plantoes',
            campo: 'substitutoId',
            mensagem: msg,
          },
        ],
      });
    }
  }

  async validar(
    dto: ValidarExtraDto,
    session?: ClientSession,
    extraIdIgnorar?: Types.ObjectId | null,
    plantaoProfissionalIdIgnorar?: Types.ObjectId | null,
  ): Promise<void> {
    const { substituto } = await this.validarElegibilidade(dto, session);
    const substitutoId = substituto._id;
    await this.validarDisponibilidade(substitutoId, dto.data, dto.opcao, session);
    await this.validarSobreposicaoEDescanso(
      substitutoId,
      dto.data,
      dto.opcao,
      session,
      extraIdIgnorar,
      plantaoProfissionalIdIgnorar,
    );
    await this.validarLimites(
      substituto,
      dto.data,
      session,
      extraIdIgnorar,
      plantaoProfissionalIdIgnorar,
    );
  }

  async criar(
    dto: CriarExtraDto,
    options?: { validar?: boolean },
  ): Promise<ExtraProgramadoDocument> {
    this.validarData(dto.data);
    if (!dto.opcao || !Object.values(ExtraOpcao).includes(dto.opcao)) {
      throw new BadRequestException('Opção de jornada inválida.');
    }
    if (!dto.funcao || !['enfermeiro', 'tecnico'].includes(dto.funcao)) {
      throw new BadRequestException('Função inválida. Deve ser enfermeiro ou tecnico.');
    }
    if (!dto.motivo || !dto.motivo.trim()) {
      throw new BadRequestException('Motivo é obrigatório.');
    }
    if (!dto.setorId) throw new BadRequestException('Setor é obrigatório.');
    if (!dto.substitutoId) throw new BadRequestException('Substituto é obrigatório.');
    if (!dto.criadoPor) throw new BadRequestException('Usuário criador é obrigatório.');

    const setorId = this.normalizarId(dto.setorId, 'Setor')!;
    const substitutoId = this.normalizarId(dto.substitutoId, 'Substituto')!;
    const criadoPor = this.normalizarId(dto.criadoPor, 'criadoPor')!;
    const cobertoId = this.normalizarId(dto.cobertoId, 'cobertoId');
    const restricaoId = this.normalizarId(dto.restricaoId, 'restricaoId');
    const escalaId = this.normalizarId(dto.escalaId, 'escalaId');
    const plantaoId = this.normalizarId(dto.plantaoId, 'plantaoId');
    const plantaoProfissionalId = this.normalizarId(dto.plantaoProfissionalId, 'plantaoProfissionalId');

    const payload = {
      data: dto.data,
      opcao: dto.opcao,
      setorId,
      funcao: dto.funcao,
      substitutoId,
      motivo: dto.motivo.trim(),
      cobertoId,
      restricaoId,
      observacao: dto.observacao?.trim() ?? null,
      situacao: ExtraProgramadoSituacao.PROGRAMADO,
      escalaId,
      plantaoId,
      plantaoProfissionalId,
      revisao: 1,
      criadoPor,
      atualizadoPor: null,
      canceladoPor: null,
      canceladoEm: null,
      justificativaCancelamento: null,
    };

    return await executarTransacao(this.connection, async (session) => {
      if (options?.validar) {
        await this.validar(dto, session);
      }

      try {
        const [extra] = await this.extraModel.create([payload], { session });
        await this.registrarEvento(
          extra._id,
          ExtraEventoTipo.CRIADO,
          criadoPor,
          1,
          { data: dto.data, opcao: dto.opcao },
          session,
        );
        if (escalaId) {
          const escala = (await this.escalaModel.findById(escalaId).session(session).exec()) as (Escala & { _id: Types.ObjectId }) | null;
          if (!escala) throw new NotFoundException('Escala informada não foi encontrada.');
          await this.executarConciliacao(extra, escala, criadoPor, session);
        }
        return extra;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('duplicate') ||
          message.includes('duplicada') ||
          message.includes('duplicado') ||
          (error as { code?: number }).code === 11000
        ) {
          throw new ConflictException(
            'Extra programado duplicado. Já existe um registro ativo para o mesmo substituto, data e opção ou alocação vinculada duplicada.',
          );
        }
        throw error;
      }
    });
  }

  async editar(
    id: string,
    dto: AtualizarExtraDto,
    options?: { validar?: boolean },
  ): Promise<ExtraProgramadoDocument> {
    const extraId = this.normalizarId(id, 'ID do extra');
    if (!extraId) throw new BadRequestException('ID do extra é obrigatório.');

    if (!dto.atualizadoPor) {
      throw new BadRequestException('Usuário atualizador é obrigatório.');
    }
    const atualizadoPor = this.normalizarId(dto.atualizadoPor, 'atualizadoPor')!;

    if (dto.revisaoEsperada == null || typeof dto.revisaoEsperada !== 'number') {
      throw new BadRequestException('Revisão esperada é obrigatória.');
    }

    if (dto.data != null) {
      this.validarData(dto.data);
    }
    if (dto.opcao != null && !Object.values(ExtraOpcao).includes(dto.opcao)) {
      throw new BadRequestException('Opção de jornada inválida.');
    }
    if (dto.funcao != null && !['enfermeiro', 'tecnico'].includes(dto.funcao)) {
      throw new BadRequestException('Função inválida. Deve ser enfermeiro ou tecnico.');
    }
    if (dto.motivo != null && !dto.motivo.trim()) {
      throw new BadRequestException('Motivo não pode ser vazio.');
    }

    const setorId = dto.setorId !== undefined ? this.normalizarId(dto.setorId, 'Setor') : undefined;
    const substitutoId = dto.substitutoId !== undefined ? this.normalizarId(dto.substitutoId, 'Substituto') : undefined;
    const cobertoId = dto.cobertoId !== undefined ? this.normalizarId(dto.cobertoId, 'cobertoId') : undefined;
    const restricaoId = dto.restricaoId !== undefined ? this.normalizarId(dto.restricaoId, 'restricaoId') : undefined;
    const escalaId = dto.escalaId !== undefined ? this.normalizarId(dto.escalaId, 'escalaId') : undefined;
    const plantaoId = dto.plantaoId !== undefined ? this.normalizarId(dto.plantaoId, 'plantaoId') : undefined;
    const plantaoProfissionalId =
      dto.plantaoProfissionalId !== undefined
        ? this.normalizarId(dto.plantaoProfissionalId, 'plantaoProfissionalId')
        : undefined;

    return await executarTransacao(this.connection, async (session) => {
      const atual = await this.extraModel.findById(extraId).session(session).exec();
      if (!atual) throw new NotFoundException('Extra programado não encontrado.');
      if (atual.situacao === ExtraProgramadoSituacao.CANCELADO) {
        throw new ConflictException('Não é possível editar um extra cancelado.');
      }
      if (dto.revisaoEsperada !== atual.revisao) {
        throw new ConflictException(`Revisão obsoleta: esperava ${atual.revisao}, recebeu ${dto.revisaoEsperada}.`);
      }

      if (options?.validar) {
        const mergedDto: ValidarExtraDto = {
          data: (dto.data ?? atual.data) as string,
          opcao: (dto.opcao ?? atual.opcao) as ExtraOpcao,
          setorId: (setorId ?? atual.setorId) as Types.ObjectId,
          funcao: (dto.funcao ?? atual.funcao) as 'enfermeiro' | 'tecnico',
          substitutoId: (substitutoId ?? atual.substitutoId) as Types.ObjectId,
          motivo: (dto.motivo ?? atual.motivo) as string,
          cobertoId: cobertoId !== undefined ? cobertoId : atual.cobertoId,
          restricaoId: restricaoId !== undefined ? restricaoId : atual.restricaoId,
          observacao: dto.observacao !== undefined ? dto.observacao : atual.observacao,
          escalaId: escalaId !== undefined ? escalaId : atual.escalaId,
          plantaoId: plantaoId !== undefined ? plantaoId : atual.plantaoId,
          plantaoProfissionalId:
            plantaoProfissionalId !== undefined ? plantaoProfissionalId : atual.plantaoProfissionalId,
        };
        await this.validar(mergedDto, session, extraId, plantaoProfissionalId ?? atual.plantaoProfissionalId);
      }

      const patch: Record<string, unknown> = {
        ...(dto.data != null ? { data: dto.data } : {}),
        ...(dto.opcao != null ? { opcao: dto.opcao } : {}),
        ...(setorId !== undefined ? { setorId } : {}),
        ...(dto.funcao != null ? { funcao: dto.funcao } : {}),
        ...(substitutoId !== undefined ? { substitutoId } : {}),
        ...(dto.motivo != null ? { motivo: dto.motivo.trim() } : {}),
        ...(cobertoId !== undefined ? { cobertoId } : {}),
        ...(restricaoId !== undefined ? { restricaoId } : {}),
        ...(dto.observacao !== undefined ? { observacao: dto.observacao?.trim() ?? null } : {}),
        ...(escalaId !== undefined ? { escalaId } : {}),
        ...(plantaoId !== undefined ? { plantaoId } : {}),
        ...(plantaoProfissionalId !== undefined ? { plantaoProfissionalId } : {}),
        atualizadoPor,
        revisao: atual.revisao + 1,
      };

      if (atual.escalaId) {
        const escala = await this.escalaModel.findById(atual.escalaId).session(session).exec();
        if (escala) {
          this.verificarEscalaEditavel(escala);

          if (atual.plantaoProfissionalId) {
            const novaData = dto.data ?? atual.data;
            const novaOpcao = dto.opcao ?? atual.opcao;
            const novoSetorId = (setorId ?? atual.setorId) as Types.ObjectId;
            const novoSubstitutoId = (substitutoId ?? atual.substitutoId) as Types.ObjectId;
            const novaFuncao = dto.funcao ?? atual.funcao;

            const mudouSlot =
              novaData !== atual.data ||
              novaOpcao !== atual.opcao ||
              String(novoSetorId) !== String(atual.setorId);

            if (mudouSlot) {
              await this.plantaoProfissionalModel.deleteOne({ _id: atual.plantaoProfissionalId }, { session });
              if (atual.plantaoId) {
                const restantes = await this.plantaoProfissionalModel
                  .countDocuments({ plantaoId: atual.plantaoId })
                  .session(session)
                  .exec();
                if (restantes === 0) {
                  await this.plantaoModel.deleteOne({ _id: atual.plantaoId, tipo: TipoPlantao.EXTRA }, { session });
                }
              }

              const [anoNovaData, mesNovaData] = novaData.split('-').map(Number);
              if (escala.ano === anoNovaData && escala.mes === mesNovaData) {
                const dataPlantao = new Date(`${novaData}T00:00:00.000Z`);
                const horarioInicio = novaOpcao === ExtraOpcao.DOZE_NOITE ? '19:00' : '07:00';
                const horarioFim = novaOpcao === ExtraOpcao.DOZE_DIA ? '19:00' : '07:00';
                const duracaoHoras = novaOpcao === ExtraOpcao.VINTE_QUATRO_HORAS ? 24 : 12;

                let novoPlantao = await this.plantaoModel
                  .findOne({
                    escalaId: escala._id,
                    setorId: novoSetorId,
                    data: dataPlantao,
                    horarioInicio,
                    horarioFim,
                    duracaoHoras,
                    tipo: TipoPlantao.EXTRA,
                  })
                  .session(session)
                  .exec();

                if (!novoPlantao) {
                  const criados = await this.plantaoModel.create(
                    [
                      {
                        escalaId: escala._id,
                        setorId: novoSetorId,
                        data: dataPlantao,
                        horarioInicio,
                        horarioFim,
                        duracaoHoras,
                        tipo: TipoPlantao.EXTRA,
                      },
                    ],
                    { session },
                  );
                  novoPlantao = criados[0];
                }

                const vinculosCriados = await this.plantaoProfissionalModel.create(
                  [
                    {
                      plantaoId: novoPlantao._id,
                      profissionalId: novoSubstitutoId,
                      funcao: novaFuncao,
                      lideranca: false,
                      origemCobertura: OrigemCobertura.COMPLEMENTAR,
                      extraProgramadoId: extraId,
                    },
                  ],
                  { session },
                );
                const novoVinculo = vinculosCriados[0];

                patch.plantaoId = novoPlantao._id;
                patch.plantaoProfissionalId = novoVinculo._id;
              } else {
                patch.escalaId = null;
                patch.plantaoId = null;
                patch.plantaoProfissionalId = null;
                await this.registrarEvento(
                  extraId,
                  ExtraEventoTipo.DESVINCULADO,
                  atualizadoPor,
                  atual.revisao + 1,
                  { escalaId: String(escala._id), motivo: 'alteracao_competencia_data' },
                  session,
                );
              }
            } else {
              await this.plantaoProfissionalModel.updateOne(
                { _id: atual.plantaoProfissionalId },
                { $set: { profissionalId: novoSubstitutoId, funcao: novaFuncao } },
                { session },
              );
            }

            await this.escalaModel.updateOne(
              { _id: escala._id },
              { $unset: { validacao: 1 }, $inc: { revisao: 1 } },
              { session },
            );
            await this.atualizarPendenciasEscala(escala._id, session);
          }
        }
      }

      try {
        const atualizado = await this.extraModel
          .findOneAndUpdate(
            { _id: extraId, revisao: dto.revisaoEsperada },
            { $set: patch },
            { new: true, runValidators: true, session },
          )
          .exec();

        if (!atualizado) {
          throw new ConflictException('Extra programado não pôde ser atualizado porque a revisão ficou obsoleta.');
        }

        await this.registrarEvento(
          extraId,
          ExtraEventoTipo.EDITADO,
          atualizadoPor,
          atual.revisao + 1,
          { campos: Object.keys(patch) },
          session,
        );

        return atualizado;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('duplicate') ||
          message.includes('duplicada') ||
          message.includes('duplicado') ||
          (error as { code?: number }).code === 11000
        ) {
          throw new ConflictException(
            'Extra programado duplicado. Já existe um registro ativo para o mesmo substituto, data e opção ou alocação vinculada duplicada.',
          );
        }
        throw error;
      }
    });
  }

  async cancelar(id: string, dto: CancelarExtraDto): Promise<ExtraProgramadoDocument> {
    const extraId = this.normalizarId(id, 'ID do extra');
    if (!extraId) throw new BadRequestException('ID do extra é obrigatório.');

    if (!dto.justificativa || !dto.justificativa.trim()) {
      throw new BadRequestException('A justificativa do cancelamento é obrigatória.');
    }

    if (!dto.canceladoPor) {
      throw new BadRequestException('Usuário responsável pelo cancelamento é obrigatório.');
    }
    const canceladoPor = this.normalizarId(dto.canceladoPor, 'canceladoPor')!;

    if (dto.revisaoEsperada == null || typeof dto.revisaoEsperada !== 'number') {
      throw new BadRequestException('Revisão esperada é obrigatória.');
    }

    return await executarTransacao(this.connection, async (session) => {
      const atual = await this.extraModel.findById(extraId).session(session).exec();
      if (!atual) throw new NotFoundException('Extra programado não encontrado.');
      if (atual.situacao === ExtraProgramadoSituacao.CANCELADO) {
        throw new ConflictException('Esse extra já está cancelado.');
      }
      if (dto.revisaoEsperada !== atual.revisao) {
        throw new ConflictException(`Revisão obsoleta: esperava ${atual.revisao}, recebeu ${dto.revisaoEsperada}.`);
      }

      if (atual.escalaId) {
        const escala = await this.escalaModel.findById(atual.escalaId).session(session).exec();
        if (escala) {
          this.verificarEscalaEditavel(escala);

          if (atual.plantaoProfissionalId) {
            await this.plantaoProfissionalModel.deleteOne({ _id: atual.plantaoProfissionalId }, { session });
            if (atual.plantaoId) {
              const restantes = await this.plantaoProfissionalModel
                .countDocuments({ plantaoId: atual.plantaoId })
                .session(session)
                .exec();
              if (restantes === 0) {
                await this.plantaoModel.deleteOne({ _id: atual.plantaoId, tipo: TipoPlantao.EXTRA }, { session });
              }
            }
          }

          await this.escalaModel.updateOne(
            { _id: escala._id },
            { $unset: { validacao: 1 }, $inc: { revisao: 1 } },
            { session },
          );
          await this.atualizarPendenciasEscala(escala._id, session);
        }
      }

      const cancelado = await this.extraModel
        .findOneAndUpdate(
          { _id: extraId, revisao: dto.revisaoEsperada },
          {
            $set: {
              situacao: ExtraProgramadoSituacao.CANCELADO,
              canceladoPor,
              canceladoEm: new Date(),
              justificativaCancelamento: dto.justificativa.trim(),
              plantaoId: null,
              plantaoProfissionalId: null,
              revisao: atual.revisao + 1,
            },
          },
          { new: true, runValidators: true, session },
        )
        .exec();

      if (!cancelado) {
        throw new ConflictException('Não foi possível cancelar o extra por conflito de revisão.');
      }

      if (atual.plantaoProfissionalId) {
        await this.registrarEvento(
          extraId,
          ExtraEventoTipo.DESVINCULADO,
          canceladoPor,
          atual.revisao + 1,
          { escalaId: atual.escalaId ? String(atual.escalaId) : null, motivo: 'cancelamento_extra' },
          session,
        );
      }

      await this.registrarEvento(
        extraId,
        ExtraEventoTipo.CANCELADO,
        canceladoPor,
        atual.revisao + 1,
        { justificativa: dto.justificativa.trim() },
        session,
      );

      return cancelado;
    });
  }

  async conciliar(
    extraId: string,
    dto: { escalaId?: string },
    usuarioId: Types.ObjectId | string,
  ): Promise<ExtraProgramadoDocument> {
    const idNormalizado = this.normalizarId(extraId, 'ID do extra');
    if (!idNormalizado) throw new BadRequestException('ID do extra é obrigatório.');
    const usuarioIdNormalizado = this.normalizarId(usuarioId, 'usuarioId');
    if (!usuarioIdNormalizado) throw new BadRequestException('ID do usuário é obrigatório.');

    return await executarTransacao(this.connection, async (session) => {
      const extra = await this.extraModel.findById(idNormalizado).session(session).exec();
      if (!extra) throw new NotFoundException('Extra programado não encontrado.');

      if (extra.situacao === ExtraProgramadoSituacao.CANCELADO) {
        throw new ConflictException('Não é possível vincular um extra cancelado.');
      }

      let escala: Escala & { _id: Types.ObjectId };
      if (dto.escalaId) {
        const escalaIdNorm = this.normalizarId(dto.escalaId, 'escalaId')!;
        const encontrada = (await this.escalaModel.findById(escalaIdNorm).session(session).exec()) as (Escala & { _id: Types.ObjectId }) | null;
        if (!encontrada) throw new NotFoundException('Escala informada não foi encontrada.');
        escala = encontrada;
      } else {
        const [anoStr, mesStr] = extra.data.split('-');
        const ano = Number(anoStr);
        const mes = Number(mesStr);
        const encontrada = (await this.escalaModel.findOne({ ano, mes }).session(session).exec()) as (Escala & { _id: Types.ObjectId }) | null;
        if (!encontrada) {
          throw new NotFoundException(`Nenhuma escala encontrada para a competência ${mes}/${ano}.`);
        }
        escala = encontrada;
      }

      return await this.executarConciliacao(extra, escala, usuarioIdNormalizado, session);
    });
  }

  async desconciliar(
    extraId: string,
    usuarioId: Types.ObjectId | string,
  ): Promise<ExtraProgramadoDocument> {
    const idNormalizado = this.normalizarId(extraId, 'ID do extra');
    if (!idNormalizado) throw new BadRequestException('ID do extra é obrigatório.');
    const usuarioIdNormalizado = this.normalizarId(usuarioId, 'usuarioId');
    if (!usuarioIdNormalizado) throw new BadRequestException('ID do usuário é obrigatório.');

    return await executarTransacao(this.connection, async (session) => {
      const extra = await this.extraModel.findById(idNormalizado).session(session).exec();
      if (!extra) throw new NotFoundException('Extra programado não encontrado.');

      if (!extra.escalaId && !extra.plantaoProfissionalId) {
        return extra;
      }

      if (extra.escalaId) {
        const escala = await this.escalaModel.findById(extra.escalaId).session(session).exec();
        if (escala) {
          this.verificarEscalaEditavel(escala);

          if (extra.plantaoProfissionalId) {
            await this.plantaoProfissionalModel.deleteOne({ _id: extra.plantaoProfissionalId }, { session });
            if (extra.plantaoId) {
              const restantes = await this.plantaoProfissionalModel
                .countDocuments({ plantaoId: extra.plantaoId })
                .session(session)
                .exec();
              if (restantes === 0) {
                await this.plantaoModel.deleteOne({ _id: extra.plantaoId, tipo: TipoPlantao.EXTRA }, { session });
              }
            }
          }

          await this.escalaModel.updateOne(
            { _id: escala._id },
            { $unset: { validacao: 1 }, $inc: { revisao: 1 } },
            { session },
          );
          await this.atualizarPendenciasEscala(escala._id, session);
        }
      }

      const revisaoNova = extra.revisao + 1;
      const extraAtualizado = await this.extraModel
        .findByIdAndUpdate(
          extra._id,
          {
            $set: {
              escalaId: null,
              plantaoId: null,
              plantaoProfissionalId: null,
              revisao: revisaoNova,
              atualizadoPor: usuarioIdNormalizado,
            },
          },
          { new: true, session },
        )
        .exec();

      await this.registrarEvento(
        extra._id,
        ExtraEventoTipo.DESVINCULADO,
        usuarioIdNormalizado,
        revisaoNova,
        { escalaId: extra.escalaId ? String(extra.escalaId) : null },
        session,
      );

      return extraAtualizado!;
    });
  }

  async buscarPorId(id: Types.ObjectId | string): Promise<ExtraProgramadoDocument | null> {
    const extraId = this.normalizarId(id, 'ID do extra');
    return this.extraModel.findById(extraId).exec();
  }

  async detalhe(id: string): Promise<Record<string, unknown>> {
    const extraId = this.normalizarId(id, 'ID do extra');
    if (!extraId) {
      throw new BadRequestException('ID do extra é obrigatório.');
    }

    const rawExtra = await this.extraModel
      .findById(extraId)
      .populate({
        path: 'substitutoId',
        select: 'coren tipoVinculo formacao usuarioId',
        populate: { path: 'usuarioId', select: 'nome email' },
      })
      .populate({
        path: 'cobertoId',
        select: 'coren formacao usuarioId',
        populate: { path: 'usuarioId', select: 'nome email' },
      })
      .populate('setorId', 'nome')
      .populate('criadoPor', 'nome email')
      .populate('atualizadoPor', 'nome email')
      .populate('canceladoPor', 'nome email')
      .lean()
      .exec();

    if (!rawExtra) {
      throw new NotFoundException('Extra programado não encontrado.');
    }

    const rawHistorico = await this.auditoriaModel
      .find({ extraId })
      .sort({ ocorridoEm: -1, createdAt: -1 })
      .populate('usuarioId', 'nome email')
      .lean()
      .exec();

    let statusVinculo: 'vinculado' | 'pendente_conciliacao' | 'sem_escala' = 'sem_escala';
    const extraTyped = rawExtra as unknown as ExtraPopulado;
    if (extraTyped.plantaoProfissionalId) {
      statusVinculo = 'vinculado';
    } else if (extraTyped.escalaId) {
      statusVinculo = 'pendente_conciliacao';
    }

    if (extraTyped.substitutoId && extraTyped.substitutoId.usuarioId) {
      extraTyped.substitutoId.nome = extraTyped.substitutoId.usuarioId.nome;
      extraTyped.substitutoId.email = extraTyped.substitutoId.usuarioId.email;
    }
    if (extraTyped.cobertoId && extraTyped.cobertoId.usuarioId) {
      extraTyped.cobertoId.nome = extraTyped.cobertoId.usuarioId.nome;
      extraTyped.cobertoId.email = extraTyped.cobertoId.usuarioId.email;
    }

    const historico = rawHistorico.map((h) => {
      const hTyped = h as unknown as Record<string, unknown>;
      return {
        ...hTyped,
        id: (hTyped._id as Types.ObjectId).toString(),
      };
    });

    return {
      ...rawExtra,
      id: (extraTyped._id as Types.ObjectId).toString(),
      statusVinculo,
      historico,
    };
  }

  async listar(dto: ListarExtrasDto): Promise<{
    itens: Array<Record<string, unknown>>;
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    const filtro: Record<string, unknown> = {};

    if (dto.ano && dto.mes) {
      const mesStr = String(dto.mes).padStart(2, '0');
      filtro.data = { $regex: `^${dto.ano}-${mesStr}` };
    } else if (dto.ano) {
      filtro.data = { $regex: `^${dto.ano}-` };
    } else if (dto.mes) {
      const mesStr = String(dto.mes).padStart(2, '0');
      filtro.data = { $regex: `^\\d{4}-${mesStr}-` };
    }

    if (dto.setorId) {
      const sId = this.normalizarId(dto.setorId, 'ID do setor');
      if (sId) filtro.setorId = sId;
    }

    if (dto.motivo) {
      filtro.motivo = dto.motivo;
    }

    if (dto.situacao) {
      filtro.situacao = dto.situacao;
    }

    let condicaoProfissional: Record<string, unknown>[] | undefined;
    if (dto.profissionalId) {
      const pId = this.normalizarId(dto.profissionalId, 'ID do profissional');
      if (pId) {
        condicaoProfissional = [{ substitutoId: pId }, { cobertoId: pId }];
      }
    }

    let condicaoBusca: Record<string, unknown>[] | undefined;
    if (dto.busca && dto.busca.trim()) {
      const termo = dto.busca.trim();
      const termoEscapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: termoEscapado, $options: 'i' };

      const usuarios = await this.usuarioModel
        .find({ nome: regex })
        .select('_id')
        .exec();
      const usuarioIds = usuarios.map((u) => u._id);

      const profissionais = await this.profissionalModel
        .find({
          $or: [
            ...(usuarioIds.length > 0 ? [{ usuarioId: { $in: usuarioIds } }] : []),
            { coren: regex },
          ],
        })
        .select('_id')
        .exec();

      const profIds = profissionais.map((p) => p._id);

      condicaoBusca = [
        { observacao: regex },
        { motivo: regex },
      ];
      if (profIds.length > 0) {
        condicaoBusca.push({ substitutoId: { $in: profIds } });
        condicaoBusca.push({ cobertoId: { $in: profIds } });
      }
    }

    if (condicaoProfissional && condicaoBusca) {
      filtro.$and = [
        { $or: condicaoProfissional },
        { $or: condicaoBusca },
      ];
    } else if (condicaoProfissional) {
      filtro.$or = condicaoProfissional;
    } else if (condicaoBusca) {
      filtro.$or = condicaoBusca;
    }

    const pagina = Math.max(1, Number(dto.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(dto.limite) || 20));
    const skip = (pagina - 1) * limite;

    const total = await this.extraModel.countDocuments(filtro).exec();
    const rawItens = await this.extraModel
      .find(filtro)
      .sort({ data: -1, createdAt: -1 })
      .skip(skip)
      .limit(limite)
      .populate({
        path: 'substitutoId',
        select: 'coren tipoVinculo formacao usuarioId',
        populate: { path: 'usuarioId', select: 'nome email' },
      })
      .populate({
        path: 'cobertoId',
        select: 'coren formacao usuarioId',
        populate: { path: 'usuarioId', select: 'nome email' },
      })
      .populate('setorId', 'nome')
      .lean()
      .exec();

    const itens = rawItens.map((item) => {
      let statusVinculo: 'vinculado' | 'pendente_conciliacao' | 'sem_escala' = 'sem_escala';
      const itemTyped = item as unknown as ExtraPopulado;
      if (itemTyped.plantaoProfissionalId) {
        statusVinculo = 'vinculado';
      } else if (itemTyped.escalaId) {
        statusVinculo = 'pendente_conciliacao';
      }
      if (itemTyped.substitutoId && itemTyped.substitutoId.usuarioId) {
        itemTyped.substitutoId.nome = itemTyped.substitutoId.usuarioId.nome;
        itemTyped.substitutoId.email = itemTyped.substitutoId.usuarioId.email;
      }
      if (itemTyped.cobertoId && itemTyped.cobertoId.usuarioId) {
        itemTyped.cobertoId.nome = itemTyped.cobertoId.usuarioId.nome;
        itemTyped.cobertoId.email = itemTyped.cobertoId.usuarioId.email;
      }
      return {
        ...itemTyped,
        id: (itemTyped._id as Types.ObjectId).toString(),
        statusVinculo,
      };
    });

    return {
      itens,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  async resumo(ano: number, mes: number): Promise<{
    ano: number;
    mes: number;
    totalExtrasAtivos: number;
    totalHoras: number;
    totalRpaAtivos: number;
  }> {
    if (!ano || ano < 1 || !mes || mes < 1 || mes > 12) {
      throw new BadRequestException('Ano ou mês inválido.');
    }

    const mesStr = String(mes).padStart(2, '0');
    const prefixo = `${ano}-${mesStr}`;

    const resultado = await this.extraModel.aggregate<{ totalExtrasAtivos: number; totalHoras: number }>([
      {
        $match: {
          data: { $regex: `^${prefixo}` },
          situacao: ExtraProgramadoSituacao.PROGRAMADO,
        },
      },
      {
        $group: {
          _id: null,
          totalExtrasAtivos: { $sum: 1 },
          totalHoras: {
            $sum: {
              $cond: [{ $eq: ['$opcao', ExtraOpcao.VINTE_QUATRO_HORAS] }, 24, 12],
            },
          },
        },
      },
    ]);

    const totalExtrasAtivos = resultado[0]?.totalExtrasAtivos ?? 0;
    const totalHoras = resultado[0]?.totalHoras ?? 0;

    const totalRpaAtivos = await this.profissionalModel
      .countDocuments({
        status: StatusProfissional.ATIVO,
        tipoVinculo: TipoVinculo.RPA,
      })
      .exec();

    return {
      ano: Number(ano),
      mes: Number(mes),
      totalExtrasAtivos,
      totalHoras,
      totalRpaAtivos,
    };
  }

  async contarEventos(extraId: Types.ObjectId | string, evento?: ExtraEventoTipo): Promise<number> {
    const id = this.normalizarId(extraId, 'ID do extra');
    const filtro: QueryFilter<AuditoriaExtraDocument> = { extraId: id };
    if (evento) filtro.evento = evento;
    return this.auditoriaModel.countDocuments(filtro).exec();
  }

  validarData(data: string): void {
    validarDataCivil(data);
  }
}

export {
  calcularIntervaloJornada,
  validarDataCivil,
  ExtraOpcao,
  ExtraMotivo,
  ExtraProgramadoSituacao,
  ExtraEventoTipo,
};
