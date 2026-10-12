import type { Request } from 'express';
import type { Perfil } from '../enums/perfil.enum';

/** Usuário resolvido a partir do JWT e anexado a `request.user`. */
export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  /** Presente apenas para Enfermeiro/Técnico. */
  profissionalId?: string;
}

export type RequestAutenticada = Request & { user?: UsuarioAutenticado };
