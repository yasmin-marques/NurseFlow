import { errosSetorFixo } from './setor-fixo';

describe('errosSetorFixo', () => {
  const setores = new Map([['s1', 'UTI'], ['s2', 'Emergência']]);

  it('aceita alocações no setor cadastrado', () => {
    expect(errosSetorFixo([{ profissionalId: 'a', setorId: 's1' }], new Map([['a', 's1']]), setores)).toEqual([]);
  });

  it('rejeita alocação em outro setor, nomeando os dois setores', () => {
    const erros = errosSetorFixo([{ profissionalId: 'a', profissional: 'Ana', setorId: 's2' }], new Map([['a', 's1']]), setores);
    expect(erros).toEqual(['Ana pertence ao setor UTI e não pode ser escalado no setor Emergência.']);
  });

  it('rejeita profissional sem setor fixo ou desconhecido', () => {
    expect(errosSetorFixo([{ profissionalId: 'a', setorId: 's1' }], new Map([['a', null]]))).toHaveLength(1);
    expect(errosSetorFixo([{ profissionalId: 'x', setorId: 's1' }], new Map())).toHaveLength(1);
  });

  it('não repete a mesma mensagem', () => {
    const aloc = [{ profissionalId: 'a', setorId: 's2' }, { profissionalId: 'a', setorId: 's2' }];
    expect(errosSetorFixo(aloc, new Map([['a', 's1']]))).toHaveLength(1);
  });
});
