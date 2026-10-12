import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { Perfil } from '../common/enums/perfil.enum';
import { Formacao } from '../profissionais/profissionais.enums';
import { Profissional, type ProfissionalDocument } from '../profissionais/schemas/profissional.schema';
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
  ) {}

  buscarPorEmail(email: string, comSenha = false): Promise<UsuarioDocument | null> {
    const query = this.usuarioModel.findOne({ email: email.trim().toLowerCase() });
    return (comSenha ? query.select('+senha') : query).exec();
  }

  buscarPorId(id: string | Types.ObjectId): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findById(id).exec();
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
