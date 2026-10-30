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

  private chave(ano: number, mes: number) {
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

  private async garantirConfiguracao(ano: number, mes: number) {
    const chave = this.chave(ano, mes);
    const cargas = this.cargasPadrao();
    const padroes = {
      limiteTrocas: 3,
      maxExtras: 2,
      limitePlantoes: 12,
      maxExtrasConcursado: 1,
      maxExtrasClt: 1,
    };
    await this.model.updateOne(
      { chave },
      {
        $setOnInsert: {
          chave,
          ...padroes,
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

  private async documento(ano: number, mes: number) {
    return this.model.findOne({ chave: this.chave(ano, mes) }).lean().exec();
  }

  async consultar(ano: number, mes: number) {
    await this.garantirConfiguracao(ano, mes);
    const doc = await this.documento(ano, mes);
    if (!doc) throw new Error(`Configuração do período ${this.chave(ano, mes)} não foi criada.`);
    return {
      periodo: this.chave(ano, mes),
      limiteTrocas: doc.limiteTrocas,
      maxExtras: doc.maxExtras,
      limitePlantoes: doc.limitePlantoes,
      maxExtrasConcursado: doc.maxExtrasConcursado,
      maxExtrasClt: doc.maxExtrasClt,
      cargas: doc.cargas,
    };
  }

  async limites(ano: number, mes: number, dto: AtualizarLimitesDto) {
    await this.garantirConfiguracao(ano, mes);
    const { cargas = [], ...limites } = dto;
    const set: Record<string, unknown> = { ...limites };
    for (const carga of cargas) {
      set[`cargas.${chaveCarga(carga.vinculo, carga.diasMes)}`] = {
        plantoes24h: carga.plantoes24h,
        plantoes12h: carga.plantoes12h,
      };
    }
    if (Object.keys(set).length > 0) {
      await this.model.updateOne({ chave: this.chave(ano, mes) }, { $set: set }).exec();
    }
    return this.consultar(ano, mes);
  }

  async carga(ano: number, mes: number, dto: DefinirCargaDto) {
    await this.garantirConfiguracao(ano, mes);
    const campo = `cargas.${chaveCarga(dto.vinculo, dto.diasMes)}`;
    await this.model.updateOne(
      { chave: this.chave(ano, mes) },
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
