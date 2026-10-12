import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { CriarRestricaoDto } from './restricoes.dto';
import { Restricao, TipoRestricao } from './restricao.schema';
@Injectable()
export class RestricoesService {
  constructor(@InjectModel(Restricao.name) private readonly model: Model<Restricao>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>) {}
  private async profissional(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID de profissional inválido');
    if (!await this.profissionais.exists({ _id: id })) throw new NotFoundException('Profissional não encontrado');
  }
  private datas(dto: CriarRestricaoDto) {
    const inicio = new Date(dto.inicio); const fim = new Date(dto.fim);
    if (inicio > fim) throw new BadRequestException('A data inicial deve ser anterior ou igual à final');
    if (dto.diaSemana !== undefined && [TipoRestricao.FERIAS, TipoRestricao.AUSENCIA].includes(dto.tipo))
      throw new BadRequestException('Férias e ausências não podem ser semanais');
    return { inicio, fim };
  }
  async criar(id: string, dto: CriarRestricaoDto) {
    await this.profissional(id);
    const { inicio, fim } = this.datas(dto);
    if (await this.model.exists({ profissionalId: id, tipo: dto.tipo, inicio: { $lte: fim }, fim: { $gte: inicio }, diaSemana: dto.diaSemana ?? null }))
      throw new ConflictException('Já existe restrição desse tipo no período informado');
    return this.model.create({
      ...dto,
      profissionalId: new Types.ObjectId(id),
      inicio,
      fim,
      diaSemana: dto.diaSemana ?? null,
    });
  }
  async listar(id: string) { await this.profissional(id); return this.model.find({ profissionalId: id }).sort({ inicio: 1 }).lean().exec(); }
  async excluir(id: string, restricaoId: string) {
    await this.profissional(id);
    if (!Types.ObjectId.isValid(restricaoId)) throw new BadRequestException('ID de restrição inválido');
    const apagada = await this.model.findOneAndDelete({ _id: restricaoId, profissionalId: id }).exec();
    if (!apagada) throw new NotFoundException('Restrição não encontrada para o profissional');
    return { removida: true };
  }
  /** Consulta de conflitos a ser reutilizada pelos futuros módulos de escalas. Intervalos inclusivos UTC. */
  async conflitos(id: string, inicioIso: string, fimIso: string) {
    await this.profissional(id);
    const inicio = new Date(inicioIso); const fim = new Date(fimIso);
    if (!Number.isFinite(inicio.valueOf()) || !Number.isFinite(fim.valueOf()) || inicio > fim)
      throw new BadRequestException('Período inválido');
    const registros = await this.model.find({ profissionalId: id, inicio: { $lte: fim }, fim: { $gte: inicio } }).lean().exec();
    return registros.filter(r => {
      if (r.diaSemana === null || r.diaSemana === undefined) return true;
      const de = new Date(Math.max(inicio.valueOf(), r.inicio.valueOf()));
      const ate = Math.min(fim.valueOf(), r.fim.valueOf());
      for (let i = 0; i < 7 && de.valueOf() <= ate; i++, de.setUTCDate(de.getUTCDate() + 1))
        if (de.getUTCDay() === r.diaSemana) return true;
      return false;
    });
  }
}