import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { EscalaSnapshotService, isSnapshotEscala, type SnapshotEscala } from '../escalas/escala-snapshot.service';
import {
  Escala,
  NotificacaoEscala,
  VersaoEscala,
} from '../escalas/schemas';

@Injectable()
export class NotificacoesEscalaService {
  constructor(
    @InjectModel(NotificacaoEscala.name) private readonly notificacoes: Model<NotificacaoEscala>,
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    private readonly snapshots: EscalaSnapshotService,
  ) {}

  async listar(usuarioId: string) {
    const destinatarioId = new Types.ObjectId(usuarioId);
    const [notificacoes, naoLidas] = await Promise.all([
      this.notificacoes
        .find({ destinatarioId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      this.notificacoes.countDocuments({ destinatarioId, lidaEm: null }).exec(),
    ]);
    return {
      notificacoes: notificacoes.map((item) => ({
        id: String(item._id),
        escalaId: String(item.escalaId),
        versao: item.versao,
        eventKey: item.eventKey,
        titulo: item.titulo,
        mensagem: item.mensagem,
        criadoEm: item.createdAt,
        lidaEm: item.lidaEm ?? null,
      })),
      naoLidas,
    };
  }

  async marcarLida(id: string, usuarioId: string) {
    const filtro = { _id: new Types.ObjectId(id), destinatarioId: new Types.ObjectId(usuarioId) };
    const atualizada = await this.notificacoes
      .findOneAndUpdate({ ...filtro, lidaEm: null }, { $set: { lidaEm: new Date() } }, { returnDocument: 'after' })
      .lean()
      .exec();
    const notificacao = atualizada ?? (await this.notificacoes.findOne(filtro).lean().exec());
    if (!notificacao) throw new NotFoundException('Notificação não encontrada.');
    return { id: String(notificacao._id), lidaEm: notificacao.lidaEm ?? null };
  }

  async obterVersaoNotificada(escalaId: string, numero: number, usuarioId: string) {
    const escala = await this.escalas.findById(escalaId).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const escalaObjectId = new Types.ObjectId(escalaId);
    const destinatarioId = new Types.ObjectId(usuarioId);
    const notificacao = await this.notificacoes
      .findOne({ escalaId: escalaObjectId, versao: numero, destinatarioId })
      .lean()
      .exec();
    if (!notificacao) throw new NotFoundException('Versão de escala não encontrada para o usuário autenticado.');

    const versao = await this.versoes.findOne({ escalaId: escalaObjectId, numero }).lean().exec();
    if (!versao) throw new NotFoundException('Versão oficial não encontrada.');
    return {
      versao: {
        numero: versao.numero,
        ano: versao.ano,
        mes: versao.mes,
        publicadoPor: String(versao.publicadoPor),
        publicadoEm: versao.publicadoEm,
        pendenciasConfirmadas: versao.pendenciasConfirmadas,
      },
      snapshot: await this.snapshots.snapshotComVisualizacao(escala, versao.snapshot),
    };
  }

  async registrarPublicacao(
    escalaId: Types.ObjectId,
    numero: number,
    ano: number,
    mes: number,
    snapshotAtual: SnapshotEscala,
    snapshotAnterior: Record<string, unknown> | undefined,
    session: ClientSession,
  ): Promise<void> {
    const atuais = this.alocacoesPorProfissional(snapshotAtual);
    const anteriores = snapshotAnterior && isSnapshotEscala(snapshotAnterior)
      ? this.alocacoesPorProfissional(snapshotAnterior)
      : new Map<string, string[]>();
    const profissionaisAfetados = snapshotAnterior
      ? [...new Set([...atuais.keys(), ...anteriores.keys()])].filter(
          (id) => JSON.stringify(atuais.get(id) ?? []) !== JSON.stringify(anteriores.get(id) ?? []),
        )
      : [...atuais.keys()];
    if (profissionaisAfetados.length === 0) return;

    const profissionais = await this.profissionais
      .find({ _id: { $in: profissionaisAfetados.map((id) => new Types.ObjectId(id)) } }, { usuarioId: 1 })
      .session(session)
      .lean()
      .exec();
    const idsDestinatarios = [...new Set(profissionais.map((item) => String(item.usuarioId)))];
    const usuariosNotificados = idsDestinatarios.length
      ? await this.usuarios
          .find({
            _id: { $in: idsDestinatarios.map((id) => new Types.ObjectId(id)) },
            $or: [{ recebeNotificacoesEscala: { $exists: false } }, { recebeNotificacoesEscala: true }],
          }, { _id: 1 })
          .session(session)
          .lean()
          .exec()
      : [];
    const destinatarios = usuariosNotificados.map((item) => String(item._id));
    if (destinatarios.length === 0) return;

    const eventKey = `escala:${String(escalaId)}:versao:${numero}`;
    await this.notificacoes.insertMany(
      destinatarios.map((destinatarioId) => ({
        escalaId,
        versao: numero,
        destinatarioId: new Types.ObjectId(destinatarioId),
        eventKey,
        titulo: `Escala ${String(mes).padStart(2, '0')}/${ano} publicada`,
        mensagem: `A escala de ${String(mes).padStart(2, '0')}/${ano} foi publicada na versão ${numero}.`,
        lidaEm: null,
      })),
      { session },
    );
  }

  private alocacoesPorProfissional(snapshot: SnapshotEscala): Map<string, string[]> {
    const plantoes = new Map(snapshot.plantoes.map((item) => [String(item._id), item]));
    const alocacoes = new Map<string, Set<string>>();
    for (const vinculo of snapshot.profissionaisRelacionados) {
      if (!vinculo.profissionalId) continue;
      const plantao = plantoes.get(String(vinculo.plantaoId));
      if (!plantao?.data) continue;
      const profissionalId = String(vinculo.profissionalId);
      const assinaturas = alocacoes.get(profissionalId) ?? new Set<string>();
      assinaturas.add(
        JSON.stringify([
          new Date(plantao.data).toISOString(),
          String(plantao.setorId),
          plantao.horarioInicio,
          plantao.horarioFim,
          plantao.duracaoHoras,
          plantao.tipo,
          vinculo.funcao,
        ]),
      );
      alocacoes.set(profissionalId, assinaturas);
    }
    return new Map([...alocacoes].map(([id, assinaturas]) => [id, [...assinaturas].sort()]));
  }
}
