import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Profissional } from "../profissionais/schemas/profissional.schema";
import { AtualizarRestricaoDto, CriarRestricaoDto } from "./restricoes.dto";
import { Restricao, TipoRestricao } from "./restricao.schema";

const TURNOS_VALIDOS = new Set(["diurno", "noturno", "flexivel"]);

type RestricaoPayload = Partial<CriarRestricaoDto> & { tipo?: TipoRestricao };

@Injectable()
export class RestricoesService {
  constructor(
    @InjectModel(Restricao.name) private readonly model: Model<Restricao>,
    @InjectModel(Profissional.name)
    private readonly profissionais: Model<Profissional>,
  ) {}

  private async profissional(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("ID de profissional inválido");
    if (!(await this.profissionais.exists({ _id: id })))
      throw new NotFoundException("Profissional não encontrado");
  }

  private persistivel<T extends Record<string, any>>(obj: T): Partial<T> {
    const copia = { ...obj } as Partial<T>;
    for (const chave of Object.keys(copia)) {
      const valor = copia[chave as keyof T];
      if (valor === undefined || valor === "") {
        delete copia[chave as keyof T];
      }
    }
    return copia;
  }

  private temCampo(dto: Record<string, unknown>, chave: string) {
    return (
      Object.prototype.hasOwnProperty.call(dto, chave) &&
      dto[chave] !== undefined
    );
  }

  private diasSemanaLegado(registro: Partial<Restricao> | null | undefined) {
    if (!registro) return [];
    if (Array.isArray(registro.diasSemana)) return registro.diasSemana;
    if (registro.diaSemana === undefined || registro.diaSemana === null)
      return [];
    return [registro.diaSemana];
  }

  private normalizarDiasSemana(raw: unknown, { permitirVazio = false } = {}) {
    const valores = Array.isArray(raw)
      ? raw
      : raw === undefined || raw === null
        ? []
        : [raw];

    if (!permitirVazio && valores.length === 0) {
      throw new BadRequestException(
        "Informe pelo menos um dia da semana válido para a recorrência.",
      );
    }

    const dias = valores.filter(
      (valor) => valor !== undefined && valor !== null,
    );
    if (dias.length !== valores.length) {
      throw new BadRequestException(
        "diasSemana não pode conter valores vazios",
      );
    }

    const normalizados = dias.map((valor) => {
      const numero = Number(valor);
      if (!Number.isInteger(numero) || numero < 0 || numero > 6) {
        throw new BadRequestException(
          "diasSemana deve conter apenas valores de 0 a 6",
        );
      }
      return numero;
    });

    if (new Set(normalizados).size !== normalizados.length) {
      throw new BadRequestException("diasSemana não pode repetir dias");
    }

    return normalizados;
  }

  private resolverRecorrencia(
    dto: Record<string, unknown>,
    fallback?: Partial<Restricao> | null,
  ) {
    const temDias = this.temCampo(dto, "diasSemana");
    const temDia = this.temCampo(dto, "diaSemana");

    if (temDias && temDia) {
      const dias = this.normalizarDiasSemana(dto.diasSemana, {
        permitirVazio: true,
      });
      const dia = this.normalizarDiasSemana(dto.diaSemana, {
        permitirVazio: true,
      });
      const diaInformado =
        dto.diaSemana !== undefined && dto.diaSemana !== null;
      if (
        diaInformado &&
        (dias.length !== 1 || dia.length !== 1 || dias[0] !== dia[0])
      ) {
        throw new BadRequestException(
          "Use apenas um campo de recorrência: diasSemana ou diaSemana.",
        );
      }
    }

    if (temDias) {
      const diasSemana = this.normalizarDiasSemana(dto.diasSemana, {
        permitirVazio: true,
      });
      return {
        diasSemana,
        diaSemana: diasSemana.length === 1 ? diasSemana[0] : null,
      };
    }

    if (temDia) {
      const diasSemana = this.normalizarDiasSemana(dto.diaSemana, {
        permitirVazio: true,
      });
      return {
        diasSemana,
        diaSemana: diasSemana.length === 1 ? diasSemana[0] : null,
      };
    }

    const legado = this.diasSemanaLegado(fallback ?? null);
    return {
      diasSemana: legado,
      diaSemana: legado.length === 1 ? legado[0] : null,
    };
  }

  private proximoDiaCivil(data: Date) {
    return new Date(
      Date.UTC(
        data.getUTCFullYear(),
        data.getUTCMonth(),
        data.getUTCDate() + 1,
      ),
    );
  }

  private temOcorrenciaNoIntervalo(
    diasSemana: number[],
    inicio: Date,
    fim: Date,
  ) {
    if (!diasSemana.length) return true;

    let cursor = new Date(
      Date.UTC(
        inicio.getUTCFullYear(),
        inicio.getUTCMonth(),
        inicio.getUTCDate(),
      ),
    );

    while (cursor <= fim) {
      if (diasSemana.includes(cursor.getUTCDay())) return true;
      cursor = this.proximoDiaCivil(cursor);
    }
    return false;
  }

  private async existeConflito({
    profissionalId,
    tipo,
    inicio,
    fim,
    diasSemana,
    ignorarId,
  }: {
    profissionalId: string;
    tipo: TipoRestricao;
    inicio: Date;
    fim: Date;
    diasSemana: number[];
    ignorarId?: string;
  }) {
    const filtro: Record<string, any> = {
      profissionalId: new Types.ObjectId(profissionalId),
      tipo,
      inicio: { $lte: fim },
      fim: { $gte: inicio },
    };
    if (ignorarId) {
      filtro._id = { $ne: new Types.ObjectId(ignorarId) };
    }

    const regras = await this.model.find(filtro).lean().exec();
    if (!regras.length) return false;

    if (!diasSemana.length) {
      return regras.length > 0;
    }

    return regras.some((registro) => {
      const diasExistentes = this.diasSemanaLegado(
        registro as Partial<Restricao>,
      );
      if (!diasExistentes.length) return true;

      const interInicio = new Date(
        Math.max(inicio.valueOf(), new Date(registro.inicio).valueOf()),
      );
      const interFim = new Date(
        Math.min(fim.valueOf(), new Date(registro.fim).valueOf()),
      );
      if (interFim < interInicio) return false;

      const diasComuns = diasSemana.filter((dia) =>
        diasExistentes.includes(dia),
      );
      if (!diasComuns.length) return false;

      return this.temOcorrenciaNoIntervalo(diasComuns, interInicio, interFim);
    });
  }

  private normalizar(dto: RestricaoPayload) {
    const tipo = dto.tipo ?? TipoRestricao.INDISPONIVEL;
    const motivo = this.temCampo(dto as Record<string, unknown>, "motivo")
      ? (dto.motivo?.trim() ?? null)
      : null;
    const observacao = this.temCampo(
      dto as Record<string, unknown>,
      "observacao",
    )
      ? (dto.observacao?.trim() ?? null)
      : null;
    const instituicao = this.temCampo(
      dto as Record<string, unknown>,
      "instituicao",
    )
      ? (dto.instituicao?.trim() ?? null)
      : null;
    const tipoVinculo = this.temCampo(
      dto as Record<string, unknown>,
      "tipoVinculo",
    )
      ? (dto.tipoVinculo?.trim() ?? null)
      : null;

    const { diasSemana } = this.resolverRecorrencia(
      dto as Record<string, unknown>,
    );

    if (
      diasSemana.length > 0 &&
      [TipoRestricao.FERIAS, TipoRestricao.AUSENCIA].includes(tipo)
    ) {
      throw new BadRequestException(
        "Férias e ausências não podem ser semanais",
      );
    }

    if (
      dto.turno !== undefined &&
      dto.turno !== null &&
      !TURNOS_VALIDOS.has(dto.turno)
    ) {
      throw new BadRequestException(
        "Turno inválido. Use diurno, noturno ou flexivel.",
      );
    }
    if (tipo === TipoRestricao.DISPONIVEL && dto.turno == null) {
      throw new BadRequestException(
        "Disponibilidade deve informar um turno explícito.",
      );
    }
    if (tipo === TipoRestricao.VINCULO_EXTERNO && !instituicao) {
      throw new BadRequestException(
        "Vínculo externo deve informar a instituição.",
      );
    }
    const motivoFinal = motivo ?? observacao ?? null;

    return { motivo: motivoFinal, observacao, instituicao, tipoVinculo, diasSemana };
  }

  private datas(
    dto: { inicio?: string; fim?: string },
    fallback?: { inicio: Date; fim: Date },
  ) {
    const inicio = new Date(dto.inicio ?? fallback?.inicio.toISOString() ?? "");
    const fim = new Date(dto.fim ?? fallback?.fim.toISOString() ?? "");

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException("Data de início ou fim inválida");
    }
    if (inicio > fim)
      throw new BadRequestException(
        "A data inicial deve ser anterior ou igual à final",
      );
    return { inicio, fim };
  }

  private serializar(registro: Record<string, any>) {
    const diasSemana = this.diasSemanaLegado(registro as Partial<Restricao>);
    return {
      ...registro,
      diasSemana: diasSemana.length ? diasSemana : undefined,
      diaSemana: diasSemana.length === 1 ? diasSemana[0] : null,
    };
  }

  async criar(id: string, dto: CriarRestricaoDto) {
    await this.profissional(id);
    const { inicio, fim } = this.datas(dto);
    const { motivo, observacao, instituicao, tipoVinculo } =
      this.normalizar(dto);
    const { diasSemana } = this.resolverRecorrencia(
      dto as unknown as Record<string, unknown>,
    );

    if (
      await this.existeConflito({
        profissionalId: id,
        tipo: dto.tipo,
        inicio,
        fim,
        diasSemana,
      })
    ) {
      throw new ConflictException(
        "Já existe restrição desse tipo no período informado",
      );
    }

    const persistido = await this.model.create(
      this.persistivel({
        ...dto,
        profissionalId: new Types.ObjectId(id),
        inicio,
        fim,
        diasSemana: diasSemana.length ? diasSemana : null,
        diaSemana: diasSemana.length === 1 ? diasSemana[0] : null,
        turno: dto.turno ?? undefined,
        motivo: motivo ?? undefined,
        observacao: observacao ?? undefined,
        instituicao: instituicao ?? undefined,
        tipoVinculo: tipoVinculo ?? undefined,
      }),
    );

    return this.serializar(persistido.toObject());
  }

  async atualizar(id: string, restricaoId: string, dto: AtualizarRestricaoDto) {
    await this.profissional(id);
    if (!Types.ObjectId.isValid(restricaoId))
      throw new BadRequestException("ID de restrição inválido");

    const existente = await this.model
      .findOne({ _id: restricaoId, profissionalId: id })
      .exec();
    if (!existente)
      throw new NotFoundException(
        "Restrição não encontrada para o profissional",
      );

    const tipo = this.temCampo(dto as Record<string, unknown>, "tipo")
      ? (dto.tipo ?? existente.tipo)
      : existente.tipo;
    const inicioIso = this.temCampo(dto as Record<string, unknown>, "inicio")
      ? (dto.inicio ?? existente.inicio.toISOString())
      : existente.inicio.toISOString();
    const fimIso = this.temCampo(dto as Record<string, unknown>, "fim")
      ? (dto.fim ?? existente.fim.toISOString())
      : existente.fim.toISOString();
    const { diasSemana, diaSemana: diaSemanaNormalizado } =
      this.resolverRecorrencia(
        dto as unknown as Record<string, unknown>,
        existente.toObject(),
      );
    const turno = this.temCampo(dto as Record<string, unknown>, "turno")
      ? (dto.turno ?? null)
      : (existente.turno ?? null);
    const motivo = this.temCampo(dto as Record<string, unknown>, "motivo")
      ? (dto.motivo ?? null)
      : (existente.motivo ?? null);
    const observacao = this.temCampo(
      dto as Record<string, unknown>,
      "observacao",
    )
      ? (dto.observacao ?? null)
      : (existente.observacao ?? null);
    const instituicao = this.temCampo(
      dto as Record<string, unknown>,
      "instituicao",
    )
      ? (dto.instituicao ?? null)
      : (existente.instituicao ?? null);
    const tipoVinculo = this.temCampo(
      dto as Record<string, unknown>,
      "tipoVinculo",
    )
      ? (dto.tipoVinculo ?? null)
      : (existente.tipoVinculo ?? null);

    const payload: RestricaoPayload = {
      ...existente.toObject(),
      tipo,
      inicio: inicioIso,
      fim: fimIso,
      diasSemana,
      diaSemana: diaSemanaNormalizado,
      turno,
      motivo,
      observacao,
      instituicao,
      tipoVinculo,
    };

    const { inicio, fim } = this.datas(payload, {
      inicio: existente.inicio,
      fim: existente.fim,
    });
    const {
      motivo: motivoNormalizado,
      observacao: observacaoNormalizada,
      instituicao: instituicaoNormalizada,
      tipoVinculo: tipoVinculoNormalizado,
    } = this.normalizar(payload);

    if (
      await this.existeConflito({
        profissionalId: id,
        tipo,
        inicio,
        fim,
        diasSemana,
        ignorarId: restricaoId,
      })
    ) {
      throw new ConflictException(
        "Já existe restrição desse tipo no período informado",
      );
    }

    const overrideRecorrencia =
      this.temCampo(dto as Record<string, unknown>, "diasSemana") ||
      this.temCampo(dto as Record<string, unknown>, "diaSemana");

    const atualizado = await this.model
      .findOneAndUpdate(
        { _id: restricaoId, profissionalId: id },
        this.persistivel({
          tipo,
          inicio,
          fim,
          diasSemana: overrideRecorrencia
            ? diasSemana.length
              ? diasSemana
              : null
            : undefined,
          diaSemana: overrideRecorrencia
            ? diasSemana.length === 1
              ? diasSemana[0]
              : null
            : undefined,
          turno: this.temCampo(dto as Record<string, unknown>, "turno")
            ? (turno ?? null)
            : (existente.turno ?? undefined),
          motivo: this.temCampo(dto as Record<string, unknown>, "motivo")
            ? (motivoNormalizado ?? null)
            : (existente.motivo ?? undefined),
          observacao: this.temCampo(
            dto as Record<string, unknown>,
            "observacao",
          )
            ? (observacaoNormalizada ?? null)
            : (existente.observacao ?? undefined),
          instituicao: this.temCampo(
            dto as Record<string, unknown>,
            "instituicao",
          )
            ? (instituicaoNormalizada ?? null)
            : (existente.instituicao ?? undefined),
          tipoVinculo: this.temCampo(
            dto as Record<string, unknown>,
            "tipoVinculo",
          )
            ? (tipoVinculoNormalizado ?? null)
            : (existente.tipoVinculo ?? undefined),
        }),
        { new: true },
      )
      .exec();

    if (!atualizado)
      throw new NotFoundException(
        "Restrição não encontrada para o profissional",
      );
    return this.serializar(atualizado.toObject());
  }

  async listar(id: string) {
    await this.profissional(id);
    return (
      await this.model
        .find({ profissionalId: id })
        .sort({ inicio: 1 })
        .lean()
        .exec()
    ).map((registro) => this.serializar(registro));
  }

  async excluir(id: string, restricaoId: string) {
    await this.profissional(id);
    if (!Types.ObjectId.isValid(restricaoId))
      throw new BadRequestException("ID de restrição inválido");
    const apagada = await this.model
      .findOneAndDelete({ _id: restricaoId, profissionalId: id })
      .exec();
    if (!apagada)
      throw new NotFoundException(
        "Restrição não encontrada para o profissional",
      );
    return { removida: true };
  }

  /** Consulta de conflitos a ser reutilizada pelos futuros módulos de escalas. Intervalos inclusivos UTC. */
  async conflitos(id: string, inicioIso: string, fimIso: string) {
    await this.profissional(id);
    const inicio = new Date(inicioIso);
    const fim = new Date(fimIso);
    if (
      !Number.isFinite(inicio.valueOf()) ||
      !Number.isFinite(fim.valueOf()) ||
      inicio > fim
    )
      throw new BadRequestException("Período inválido");
    const registros = await this.model
      .find({
        profissionalId: id,
        inicio: { $lte: fim },
        fim: { $gte: inicio },
      })
      .lean()
      .exec();

    return registros
      .map((registro) => this.serializar(registro))
      .filter((registro: any) => {
        const dias = Array.isArray(registro.diasSemana)
          ? registro.diasSemana
          : registro.diaSemana === null || registro.diaSemana === undefined
            ? []
            : [registro.diaSemana];

        const de = new Date(
          Math.max(inicio.valueOf(), new Date(registro.inicio).valueOf()),
        );
        const ate = new Date(
          Math.min(fim.valueOf(), new Date(registro.fim).valueOf()),
        );
        if (de > ate) return false;
        if (!dias.length) return true;

        return this.temOcorrenciaNoIntervalo(dias, de, ate);
      });
  }
}
