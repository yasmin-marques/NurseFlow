import { Formacao } from '../profissionais/profissionais.enums';
import type { Profissional } from '../profissionais/schemas/profissional.schema';

type VinculoFixo = Pick<Profissional, 'formacao' | 'setorId' | 'subsetorId'>;

export function chaveCompatibilidade(profissional: VinculoFixo): string | null {
  if (!profissional.setorId) return null;
  const subsetor = profissional.formacao === Formacao.TECNICO ? String(profissional.subsetorId ?? '') : '';
  return `${profissional.formacao}|${String(profissional.setorId)}|${subsetor}`;
}

export function impedimentoCompatibilidade(a: VinculoFixo, b: VinculoFixo): { codigo: string; mensagem: string } | null {
  if (a.formacao !== b.formacao) {
    return { codigo: 'CATEGORIA_DIFERENTE', mensagem: 'Só é possível trocar com profissionais da mesma formação.' };
  }
  if (!a.setorId || !b.setorId) {
    return { codigo: 'SETOR_AUSENTE', mensagem: 'Os dois profissionais precisam ter setor fixo cadastrado.' };
  }
  if (chaveCompatibilidade(a) !== chaveCompatibilidade(b)) {
    return a.formacao === Formacao.TECNICO
      ? { codigo: 'SETOR_SUBSETOR_DIFERENTE', mensagem: 'Técnicos só trocam com quem está no mesmo setor e sub-setor.' }
      : { codigo: 'SETOR_DIFERENTE', mensagem: 'Só é possível trocar com profissionais do mesmo setor.' };
  }
  return null;
}
