import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoVinculo } from '../profissionais/profissionais.enums';
import { utcDate } from '../common/utils/date';
import { AtualizarLimitesDto, DefinirCargaDto } from './configuracoes.dto';
import { Configuracao, chaveCarga } from './configuracao.schema';

@Injectable()
export class ConfiguracoesService {
  constructor(@InjectModel(Configuracao.name) private readonly model: Model<Configuracao>) {}

  // As regras valem para todos os meses; ano e mes só identificam o período consultado.
  private readonly chaveGlobal = 'global';

  private periodo(ano: number, mes: number) {
    return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
  }

  private cargasPadrao() {
    return Object.fromEntries(
      [28, 29, 30, 31].flatMap((diasMes) => [
        [chaveCarga(TipoVinculo.CONCURSADO, diasMes), { plantoes24h: 6, plantoes12h: 1 }],
        [chaveCarga(TipoVinculo.CLT, diasMes), { plantoes24h: 5, plantoes12h: 2 }],
      ]),
    );
  }

  private async garantirConfiguracao() {
    const chave = this.chaveGlobal;
    const padroes = {
      limiteTrocas: 3,
      maxExtras: 2,
      limitePlantoes: 12,
      maxExtrasConcursado: 1,
      maxExtrasClt: 1,
    };
    // Aproveita a configuração mensal do mês atual (ou do mais recente até ele), ignorando meses futuros.
    const hoje = new Date();
    const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const legado =
      (await this.model
        .findOne({ chave: { $ne: chave, $lte: atual } })
        .sort({ chave: -1 })
        .lean()
        .exec()) ??
      (await this.model.findOne({ chave: { $ne: chave } }).sort({ chave: 1 }).lean().exec());
    const cargas = { ...this.cargasPadrao(), ...(legado?.cargas ?? {}) };
    const inicial = legado
      ? {
          limiteTrocas: legado.limiteTrocas,
          maxExtras: legado.maxExtras,
          limitePlantoes: legado.limitePlantoes,
          maxExtrasConcursado: legado.maxExtrasConcursado,
          maxExtrasClt: legado.maxExtrasClt,
        }
      : padroes;
    await this.model.updateOne(
      { chave },
      {
        $setOnInsert: {
          chave,
          ...inicial,
          cargas,
        },
      },
      { upsert: true },
    ).exec();

    await Promise.all([
      ...Object.entries(padroes).map(([nome, valor]) =>
        this.model.updateOne(
          { chave, [nome]: { $exists: false } },
          { $set: { [nome]: valor } },
        ).exec(),
      ),
      ...Object.entries(cargas).map(([nome, carga]) =>
        this.model.updateOne(
          { chave, [`cargas.${nome}`]: { $exists: false } },
          { $set: { [`cargas.${nome}`]: carga } },
        ).exec(),
      ),
    ]);
  }

  private async documento() {
    return this.model.findOne({ chave: this.chaveGlobal }).lean().exec();
  }

  async consultar(ano: number, mes: number) {
    await this.garantirConfiguracao();
    const doc = await this.documento();
    if (!doc) throw new Error('A configuração das regras não foi criada.');
    return {
      periodo: this.periodo(ano, mes),
      limiteTrocas: doc.limiteTrocas,
      maxExtras: doc.maxExtras,
      limitePlantoes: doc.limitePlantoes,
      maxExtrasConcursado: doc.maxExtrasConcursado,
      maxExtrasClt: doc.maxExtrasClt,
      cargas: doc.cargas,
    };
  }

  async limites(ano: number, mes: number, dto: AtualizarLimitesDto) {
    await this.garantirConfiguracao();
    const { cargas = [], ...limites } = dto;
    const set: Record<string, unknown> = { ...limites };
    for (const carga of cargas) {
      set[`cargas.${chaveCarga(carga.vinculo, carga.diasMes)}`] = {
        plantoes24h: carga.plantoes24h,
        plantoes12h: carga.plantoes12h,
      };
    }
    if (Object.keys(set).length > 0) {
      await this.model.updateOne({ chave: this.chaveGlobal }, { $set: set }).exec();
    }
    return this.consultar(ano, mes);
  }

  async carga(ano: number, mes: number, dto: DefinirCargaDto) {
    await this.garantirConfiguracao();
    const campo = `cargas.${chaveCarga(dto.vinculo, dto.diasMes)}`;
    await this.model.updateOne(
      { chave: this.chaveGlobal },
      { $set: { [campo]: { plantoes24h: dto.plantoes24h, plantoes12h: dto.plantoes12h } } },
    ).exec();
    return this.consultar(ano, mes);
  }

  async cargaEsperada(ano: number, mes: number, vinculo: TipoVinculo) {
    const config = await this.consultar(ano, mes);
    const diasMes = utcDate(ano, mes, 0).getUTCDate();
    return config.cargas[chaveCarga(vinculo, diasMes)] ?? null;
  }
}
