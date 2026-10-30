import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { Perfil } from '../common/enums/perfil.enum';
import { Formacao } from '../profissionais/profissionais.enums';
import { Profissional, type ProfissionalDocument } from '../profissionais/schemas/profissional.schema';
import { Escala, Plantao, PlantaoProfissional, StatusEscala } from '../escalas/schemas';
import { Setor } from '../setores/schemas/setor.schema';
import { Administrador } from './schemas/administrador.schema';
import { TipoUsuario, Usuario, type UsuarioDocument } from './schemas/usuario.schema';

export interface PerfilResolvido {
  perfil: Perfil;
  profissional: ProfissionalDocument | null;
}

/** Operações sobre a identidade (usuário + papel) compartilhadas por Auth e Profissionais. */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<Usuario>,
    @InjectModel(Administrador.name) private readonly administradorModel: Model<Administrador>,
    @InjectModel(Profissional.name) private readonly profissionalModel: Model<Profissional>,
    @InjectModel(PlantaoProfissional.name) private readonly plantaoProfissionalModel: Model<PlantaoProfissional>,
    @InjectModel(Plantao.name) private readonly plantaoModel: Model<Plantao>,
    @InjectModel(Escala.name) private readonly escalaModel: Model<Escala>,
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
  ) {}

  buscarPorEmail(email: string, comSenha = false): Promise<UsuarioDocument | null> {
    const query = this.usuarioModel.findOne({ email: email.trim().toLowerCase() });
    return (comSenha ? query.select('+senha') : query).exec();
  }

  buscarPorId(id: string | Types.ObjectId): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findById(id).exec();
  }

  buscarProfissionalDoUsuario(usuarioId: string | Types.ObjectId) {
    return this.profissionalModel
      .findOne({ usuarioId })
      .select('coren formacao tipoVinculo')
      .lean()
      .exec();
  }

  async buscarProximoSetor(profissionalId: string): Promise<string | null> {
    const alocacoes = await this.plantaoProfissionalModel
      .find({ profissionalId })
      .select('plantaoId')
      .lean()
      .exec();
    if (alocacoes.length === 0) return null;

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const plantoes = await this.plantaoModel
      .find({
        _id: { $in: alocacoes.map((item) => item.plantaoId) },
        data: { $gte: hoje },
      })
      .select('escalaId setorId data horarioInicio')
      .sort({ data: 1, horarioInicio: 1 })
      .lean()
      .exec();
    if (plantoes.length === 0) return null;

    const escalasPublicadas = await this.escalaModel
      .find({
        _id: { $in: plantoes.map((item) => item.escalaId) },
        status: StatusEscala.PUBLICADA,
        versaoPublicada: { $gt: 0 },
      })
      .select('_id')
      .lean()
      .exec();
    const idsEscalasPublicadas = new Set(escalasPublicadas.map((item) => String(item._id)));
    const agora = Date.now();
    const proximoPlantao = plantoes.find((item) => {
      if (!idsEscalasPublicadas.has(String(item.escalaId))) return false;
      const inicio = new Date(item.data);
      const [hora, minuto] = item.horarioInicio.split(':').map(Number);
      inicio.setUTCHours(hora, minuto, 0, 0);
      return inicio.getTime() >= agora;
    });
    if (!proximoPlantao) return null;

    const setor = await this.setorModel.findById(proximoPlantao.setorId).select('nome').lean().exec();
    return setor?.nome ?? null;
  }

  buscarPorCpf(cpf: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findOne({ cpf }).exec();
  }

  criar(dados: Pick<Usuario, 'nome' | 'email' | 'senha' | 'cpf' | 'tipoUsuario'> & Partial<Pick<Usuario, 'senhaTemporaria'>>): Promise<UsuarioDocument> {
    return this.usuarioModel.create(dados);
  }

  async criarAdministrador(usuarioId: Types.ObjectId): Promise<void> {
    await this.administradorModel.create({ usuarioId });
  }

  /** Usado apenas para desfazer um cadastro que falhou na segunda etapa (sem transações em Mongo standalone). */
  async removerCriacaoParcial(id: Types.ObjectId): Promise<void> {
    await this.usuarioModel.deleteOne({ _id: id }).exec();
  }

  /** Deriva o perfil de acesso: administrador = Coordenação; profissional = conforme a formação. */
  async resolverPerfil(usuario: UsuarioDocument): Promise<PerfilResolvido | null> {
    if (usuario.tipoUsuario === TipoUsuario.ADMINISTRADOR) {
      const admin = await this.administradorModel.exists({ usuarioId: usuario._id }).exec();
      return admin ? { perfil: Perfil.COORDENACAO, profissional: null } : null;
    }
    const profissional = await this.profissionalModel.findOne({ usuarioId: usuario._id }).exec();
    if (!profissional) return null;
    return {
      perfil: profissional.formacao === Formacao.ENFERMEIRO ? Perfil.ENFERMEIRO : Perfil.TECNICO,
      profissional,
    };
  }
}
