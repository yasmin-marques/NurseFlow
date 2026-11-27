import { idEventoGoogle, intervaloDoPlantao, montarEvento, type PlantaoParaEvento } from './plantao-evento';

const base: PlantaoParaEvento = {
  profissionalId: '64b7f0f0f0f0f0f0f0f0f0a1',
  plantaoId: '64b7f0f0f0f0f0f0f0f0f0b1',
  data: new Date('2026-12-05T00:00:00.000Z'),
  horarioInicio: '07:00',
  duracaoHoras: 12,
  setorNome: 'UTI',
  funcao: 'enfermeiro',
  lideranca: false,
  tipo: 'regular',
};

describe('montarEvento', () => {
  it('usa data, horário local (UTC-3), setor e função oficiais', () => {
    const evento = montarEvento(base);
    expect(evento.corpo.start).toEqual({ dateTime: '2026-12-05T07:00:00-03:00', timeZone: 'America/Fortaleza' });
    expect(evento.corpo.end).toEqual({ dateTime: '2026-12-05T19:00:00-03:00', timeZone: 'America/Fortaleza' });
    expect(evento.corpo.summary).toBe('Plantão — UTI');
    expect(evento.corpo.description).toContain('Setor: UTI');
    expect(evento.corpo.description).toContain('Função: Enfermeiro');
  });

  it('termina no dia seguinte quando o plantão atravessa a meia-noite (12h noturno)', () => {
    const evento = montarEvento({ ...base, horarioInicio: '19:00' });
    expect(evento.corpo.start.dateTime).toBe('2026-12-05T19:00:00-03:00');
    expect(evento.corpo.end.dateTime).toBe('2026-12-06T07:00:00-03:00');
    expect(evento.fim.getTime() - evento.inicio.getTime()).toBe(12 * 3_600_000);
  });

  it('plantão de 24h termina no mesmo horário do dia seguinte, inclusive na virada do mês e do ano', () => {
    const evento = montarEvento({ ...base, data: new Date('2026-12-31T00:00:00.000Z'), duracaoHoras: 24 });
    expect(evento.corpo.start.dateTime).toBe('2026-12-31T07:00:00-03:00');
    expect(evento.corpo.end.dateTime).toBe('2027-01-01T07:00:00-03:00');
  });

  it('calcula o instante absoluto considerando o fuso de Fortaleza', () => {
    const { inicio } = intervaloDoPlantao({ ...base, horarioInicio: '19:00' });
    expect(inicio.toISOString()).toBe('2026-12-05T22:00:00.000Z');
  });

  it('não inclui colegas, pacientes nem observações internas', () => {
    const evento = montarEvento({ ...base, lideranca: true, tipo: 'extra', observacao: 'segredo' } as PlantaoParaEvento);
    const texto = JSON.stringify(evento.corpo);
    expect(texto).not.toContain('segredo');
    expect(texto).toContain('(chefia)');
    expect(texto).toContain('Tipo de plantão: Extra');
  });

  it('descreve setor, subsetor, tipo e função, nessa ordem', () => {
    const evento = montarEvento({ ...base, subsetorNome: 'Isolamento', funcao: 'tecnico' });
    expect(evento.corpo.description).toBe(
      'Setor: UTI\nSubsetor: Isolamento\nTipo de plantão: Regular\nFunção: Técnico\n\nCriado pelo NurseFlow. Alterações devem ser feitas no NurseFlow.',
    );
  });

  it('omite subsetor e tipo quando ausentes', () => {
    const { description } = montarEvento({ ...base, tipo: undefined }).corpo;
    expect(description).not.toContain('Subsetor');
    expect(description).not.toContain('Tipo de plantão');
  });

  it('muda o hash quando algo relevante muda e mantém quando nada muda', () => {
    expect(montarEvento(base).hash).toBe(montarEvento({ ...base }).hash);
    expect(montarEvento(base).hash).not.toBe(montarEvento({ ...base, setorNome: 'Pediatria' }).hash);
    expect(montarEvento(base).hash).not.toBe(montarEvento({ ...base, horarioInicio: '19:00' }).hash);
  });
});

describe('idEventoGoogle', () => {
  it('é determinístico por profissional+plantão e válido para o Google (a-v, 0-9, 5 a 1024 caracteres)', () => {
    const id = idEventoGoogle('p1', 'plantao1');
    expect(id).toBe(idEventoGoogle('p1', 'plantao1'));
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(idEventoGoogle('p2', 'plantao1')).not.toBe(id);
    expect(idEventoGoogle('p1', 'plantao2')).not.toBe(id);
  });
});
