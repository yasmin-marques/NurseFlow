import { cpfValido, formatarCpf, somenteDigitos } from './cpf';

describe('cpf', () => {
  it('remove a máscara', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
  });

  it('aceita CPFs com dígitos verificadores corretos', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('11144477735')).toBe(true);
  });

  it('rejeita dígitos verificadores incorretos, sequências repetidas e tamanho inválido', () => {
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });

  it('formata no padrão 000.000.000-00', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });
});
