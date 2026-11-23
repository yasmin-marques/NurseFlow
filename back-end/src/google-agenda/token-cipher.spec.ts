import { randomBytes } from 'node:crypto';
import { cifrarSegredo, decifrarSegredo } from './token-cipher';

describe('token-cipher', () => {
  const chave = randomBytes(32);

  it('cifra e decifra sem expor o segredo no texto cifrado', () => {
    const cifrado = cifrarSegredo('1//refresh-token-secreto', chave);
    expect(cifrado).not.toContain('refresh-token-secreto');
    expect(cifrado.startsWith('v1.')).toBe(true);
    expect(decifrarSegredo(cifrado, chave)).toBe('1//refresh-token-secreto');
  });

  it('usa IV aleatório: o mesmo segredo gera textos cifrados diferentes', () => {
    expect(cifrarSegredo('x', chave)).not.toBe(cifrarSegredo('x', chave));
  });

  it('rejeita chave errada, conteúdo adulterado e formato inválido', () => {
    const cifrado = cifrarSegredo('segredo', chave);
    expect(() => decifrarSegredo(cifrado, randomBytes(32))).toThrow();
    const partes = cifrado.split('.');
    partes[3] = Buffer.from('adulterado').toString('base64url');
    expect(() => decifrarSegredo(partes.join('.'), chave)).toThrow();
    expect(() => decifrarSegredo('texto-solto', chave)).toThrow();
  });
});
