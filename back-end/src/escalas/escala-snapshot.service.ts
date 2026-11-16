import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import type { Mensagem } from './montar-problema';
import { isVisualizacaoEscalaPdf } from './escala-pdf.types';
import type { ResumoCobertura } from './regras-plantao';
import {
  Escala,
  OrigemCobertura,
  Plantao,
  PlantaoProfissional,
} from './schemas';

const isoDia = (data: Date) => data.toISOString().slice(0, 10);

export interface SnapshotEscala {
  escala?: { geracao?: Record<string, unknown> };
  geracao?: Record<string, unknown>;
  plantoes: (Partial<Plantao> & { _id: Types.ObjectId; escalaId?: Types.ObjectId })[];
  profissionaisRelacionados: (Partial<PlantaoProfissional> & { _id: Types.ObjectId; plantaoId: Types.ObjectId })[];
  pendencias?: unknown[];
  conflitos?: Mensagem[];
  avisos?: Mensagem[];
  cargas?: unknown[];
}

export function isSnapshotEscala(snapshot: Record<string, unknown>): snapshot is Record<string, unknown> & SnapshotEscala {
  return Array.isArray(snapshot.plantoes) && Array.isArray(snapshot.profissionaisRelacionados);
}

@Injectable()
export class EscalaSnapshotService {
  constructor(
    @InjectModel(Plantao.name) private readonly plantoes: Model<Plantao>,
    @InjectModel(PlantaoProfissional.name) private readonly relacionados: Model<PlantaoProfissional>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
  ) {}

  async snapshotComVisualizacao(
    escala: Escala & { _id: Types.ObjectId },
    snapshot: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (isVisualizacaoEscalaPdf(snapshot.visualizacao)) return snapshot;
    if (!isSnapshotEscala(snapshot)) return snapshot;
    const dadosEscala =
      typeof snapshot.escala === 'object' && snapshot.escala !== null
        ? (snapshot.escala as Partial<Escala>)
        : {};
    const escalaSnapshot = { ...escala, ...dadosEscala, _id: escala._id } as Escala & { _id: Types.ObjectId };
    const visualizacao = await this.montarResposta(escalaSnapshot, undefined, snapshot);
    if (!isVisualizacaoEscalaPdf(visualizacao)) {
      throw new ConflictException('O snapshot oficial não pôde ser preparado para consulta.');
    }
    return { ...snapshot, visualizacao };
  }

  async montarResposta(
    escala: Escala & { _id: Types.ObjectId },
    session?: ClientSession,
    snapshot?: SnapshotEscala,
  ) {
    let plantoes: (Plantao & { _id: Types.ObjectId })[];
    let vinculos: (PlantaoProfissional & { _id: Types.ObjectId })[];
    if (snapshot) {
      plantoes = snapshot.plantoes as (Plantao & { _id: Types.ObjectId })[];
      vinculos = snapshot.profissionaisRelacionados as (PlantaoProfissional & { _id: Types.ObjectId })[];
    } else {
      const consultaPlantoes = this.plantoes.find({ escalaId: escala._id }).sort({ data: 1, horarioInicio: 1 });
      if (session) consultaPlantoes.session(session);
      plantoes = await consultaPlantoes.lean().exec();
      const consultaVinculos = this.relacionados.find({ plantaoId: { $in: plantoes.map((plantao) => plantao._id) } });
      if (session) consultaVinculos.session(session);
      vinculos = await consultaVinculos.lean().exec();
    }
    const consultaProfissionais = this.profissionais.find({ _id: { $in: vinculos.map((vinculo) => vinculo.profissionalId) } });
    if (session) consultaProfissionais.session(session);
    const profissionaisDocs = await consultaProfissionais.lean().exec();
    const consultaNomes = this.usuarios.find({ _id: { $in: profissionaisDocs.map((profissional) => profissional.usuarioId) } }, { nome: 1 });
    if (session) consultaNomes.session(session);
    const nomes = new Map((await consultaNomes.lean().exec()).map((usuario) => [String(usuario._id), usuario.nome]));
    const profissionalPorId = new Map(
      profissionaisDocs.map((profissional) => [
        String(profissional._id),
        {
          id: String(profissional._id),
          nome: nomes.get(String(profissional.usuarioId)) ?? '',
          formacao: profissional.formacao,
          vinculo: profissional.tipoVinculo,
        },
      ]),
    );
    const consultaSetores = this.setores.find({ _id: { $in: plantoes.map((plantao) => plantao.setorId) } }, { nome: 1 });
    if (session) consultaSetores.session(session);
    const setoresDocs = await consultaSetores.lean().exec();
    const nomeSetor = new Map(setoresDocs.map((setor) => [String(setor._id), setor.nome]));

    const geracao = (escala.geracao ?? {}) as {
      resumo?: unknown;
      configuracao?: unknown;
      pendencias?: unknown[];
      conflitos?: Mensagem[];
      avisos?: Mensagem[];
      cargas?: unknown[];
      escopo?: unknown;
    };

    return {
      escala: {
        id: String(escala._id),
        ano: escala.ano,
        mes: escala.mes,
        status: escala.status,
        revisao: escala.revisao,
        versaoPublicada: escala.versaoPublicada,
        validacao: escala.validacao ?? null,
        administradorId: String(escala.administradorId),
        dataCriacao: escala.dataCriacao,
      },
      resumo: { plantoes: plantoes.length, ...(geracao.resumo as object) },
      cobertura: (geracao.resumo as { cobertura?: ResumoCobertura } | undefined)?.cobertura ?? null,
      configuracaoUtilizada: geracao.configuracao ?? null,
      escopo: geracao.escopo ?? null,
      plantoes: plantoes.map((plantao) => ({
        id: String(plantao._id),
        data: isoDia(plantao.data),
        setor: { id: String(plantao.setorId), nome: nomeSetor.get(String(plantao.setorId)) ?? '' },
        horarioInicio: plantao.horarioInicio,
        horarioFim: plantao.horarioFim,
        duracaoHoras: plantao.duracaoHoras,
        tipo: plantao.tipo,
        ...(plantao.motivo ? { motivo: plantao.motivo } : {}),
        ...(plantao.observacao ? { observacao: plantao.observacao } : {}),
        profissionais: vinculos
          .filter((vinculo) => String(vinculo.plantaoId) === String(plantao._id))
          .map((vinculo) => {
            const profissional = profissionalPorId.get(String(vinculo.profissionalId));
            if (!profissional) return undefined;
            return {
              ...profissional,
              lideranca: vinculo.lideranca ?? false,
              origemCobertura: vinculo.origemCobertura ?? OrigemCobertura.REGULAR,
            };
          })
          .filter(Boolean),
      })),
      pendencias: geracao.pendencias ?? [],
      conflitos: geracao.conflitos ?? [],
      avisos: geracao.avisos ?? [],
      cargas: geracao.cargas ?? [],
    };
  }
}
