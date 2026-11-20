import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSAO = 'v1';

/** Cifra o texto com AES-256-GCM. Formato: `v1.<iv>.<tag>.<texto>` (base64url). */
export function cifrarSegredo(texto: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const conteudo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return [VERSAO, iv.toString('base64url'), cifra.getAuthTag().toString('base64url'), conteudo.toString('base64url')].join('.');
}

/** Decifra um valor produzido por `cifrarSegredo`; lança erro se a chave ou o conteúdo forem inválidos. */
export function decifrarSegredo(payload: string, chave: Buffer): string {
  const [versao, iv, tag, conteudo] = payload.split('.');
  if (versao !== VERSAO || !iv || !tag || !conteudo) throw new Error('Segredo cifrado em formato inválido.');
  const decifra = createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'));
  decifra.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(conteudo, 'base64url')), decifra.final()]).toString('utf8');
}
