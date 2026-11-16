import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { AuditoriaEscala, Escala } from './schemas';

@Injectable()
export class EscalaAuditoriaService {
  constructor(
    @InjectModel(AuditoriaEscala.name) private readonly auditoria: Model<AuditoriaEscala>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
  ) {}

  async registrar(eventos: Partial<AuditoriaEscala>[], options: { session: ClientSession }): Promise<void> {
    await this.auditoria.create(eventos, options);
  }

  async listar(escalaId: string) {
    const escala = await this.escalas.findById(escalaId, { _id: 1 }).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const eventos = await this.auditoria.find({ escalaId: new Types.ObjectId(escalaId) }).sort({ ocorridoEm: -1 }).lean().exec();
    return {
      escalaId,
      auditoria: eventos.map((evento) => ({
        id: String(evento._id),
        revisao: evento.revisao,
        acao: evento.acao,
        usuarioId: String(evento.usuarioId),
        ocorridoEm: evento.ocorridoEm,
        detalhes: evento.detalhes ?? null,
      })),
    };
  }
}
