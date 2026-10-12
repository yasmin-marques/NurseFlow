import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoVinculo } from '../profissionais/profissionais.enums';
import { AtualizarLimitesDto, DefinirCargaDto } from './configuracoes.dto';
import { Configuracao, chaveCarga } from './configuracao.schema';

@Injectable()
export class ConfiguracoesService {
  constructor(@InjectModel(Configuracao.name) private readonly model: Model<Configuracao>) {}
  private chave(ano: number, mes: number) { return `${ano}-${String(mes).padStart(2, '0')}`; }
  private async documento(ano: number, mes: number) {
    return this.model.findOne({ chave: this.chave(ano, mes) }).lean().exec();
  }
  async consultar(ano: number, mes: number) {
    const doc = await this.documento(ano, mes);
    return { periodo: this.chave(ano, mes), limiteTrocas: doc?.limiteTrocas ?? 3,
      maxExtras: doc?.maxExtras ?? 0, limitePlantoes: doc?.limitePlantoes ?? 0,
      maxExtrasConcursado: doc?.maxExtrasConcursado ?? 0, maxExtrasClt: doc?.maxExtrasClt ?? 0, cargas: doc?.cargas ?? {} };
  }
  async limites(ano: number, mes: number, dto: AtualizarLimitesDto) {
    await this.model.updateOne({ chave: this.chave(ano, mes) },
      { $set: dto, $setOnInsert: { chave: this.chave(ano, mes) } }, { upsert: true }).exec();
    return this.consultar(ano, mes);
  }
  async carga(ano: number, mes: number, dto: DefinirCargaDto) {
    const campo = `cargas.${chaveCarga(dto.vinculo, dto.diasMes)}`;
    await this.model.updateOne({ chave: this.chave(ano, mes) },
      { $set: { [campo]: { plantoes24h: dto.plantoes24h, plantoes12h: dto.plantoes12h } },
        $setOnInsert: { chave: this.chave(ano, mes) } }, { upsert: true }).exec();
    return this.consultar(ano, mes);
  }
  async cargaEsperada(ano: number, mes: number, vinculo: TipoVinculo) {
    const config = await this.consultar(ano, mes);
    const diasMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return config.cargas[chaveCarga(vinculo, diasMes)] ?? null;
  }
}
