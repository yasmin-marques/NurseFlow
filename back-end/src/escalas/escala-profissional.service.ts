import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { OrigemCobertura, Escala, Plantao, PlantaoProfissional, VersaoEscala } from './schemas';

/** Os horários dos plantões são locais (Fortaleza, UTC-3, sem horário de verão). */
const OFFSET_LOCAL_MS = 3 * 3_600_000;
const HORA_MS = 3_600_000;
const JANELA_PROXIMOS_MESES = 12;
const JANELA_ANTERIORES_MESES = 24;

type PlantaoSnapshot = Partial<Plantao> & { _id: Types.ObjectId; data: Date };
type VinculoSnapshot = Partial<PlantaoProfissional> & { _id: Types.ObjectId; plantaoId: Types.ObjectId };

interface MesPublicado {
  ano: number;
  mes: number;
  numero: number;
  publicadoEm: Date;
  plantoes: PlantaoSnapshot[];
  vinculos: VinculoSnapshot[];
}

type Turno = 'diurno' | 'noturno' | '24h';

const isoDia = (data: Date) => new Date(data).toISOString().slice(0, 10);
const hhmm = (valor: string) => `${valor.slice(0, 2)}h`;
const faixa = (inicio: string, fim: string) => `${hhmm(inicio)}—${hhmm(fim)}`;

function turnoDe(plantao: Pick<Plantao, 'horarioInicio' | 'duracaoHoras'>): Turno {
  if (plantao.duracaoHoras >= 24) return '24h';
  return plantao.horarioInicio >= '12:00' ? 'noturno' : 'diurno';
}

function inicioEFim(plantao: PlantaoSnapshot): { inicio: number; fim: number } {
  const [h, m] = (plantao.horarioInicio ?? '00:00').split(':').map(Number);
  const dia = new Date(plantao.data);
  const inicio = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), h, m) + OFFSET_LOCAL_MS;
  return { inicio, fim: inicio + (plantao.duracaoHoras ?? 0) * HORA_MS };
}

function rotuloRegime(plantao: PlantaoSnapshot, origem: OrigemCobertura | undefined): string {
  const turno = turnoDe(plantao as Plantao);
  const horario = faixa(plantao.horarioInicio ?? '00:00', plantao.horarioFim ?? '00:00');
  const base =
    turno === '24h' ? `${plantao.duracaoHoras} horas · ${horario}` : `${turno === 'diurno' ? 'Diurno' : 'Noturno'} · ${horario}`;
  if (origem === OrigemCobertura.RESTRICAO) return `${base} · restrição`;
  if (origem === OrigemCobertura.COMPLEMENTAR) return `${base} · cobertura`;
  return base;
}

/** Consultas somente leitura da escala oficial publicada, para Enfermeiro e Técnico. */
@Injectable()
export class EscalaProfissionalService {
  constructor(
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
  ) {}

  exigirProfissional(usuario: UsuarioAutenticado): string {
    if (!usuario.profissionalId) {
      throw new ForbiddenException('Esta consulta está disponível apenas para profissionais da escala.');
    }
    return usuario.profissionalId;
  }

  async meusPlantoes(
    profissionalId: string,
    situacao: 'proximos' | 'anteriores' = 'proximos',
    pagina = 1,
    limite = 20,
    agora = new Date(),
  ) {
    const meses: { ano: number; mes: number }[] = [];
    const base = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
    const [de, ate] = situacao === 'proximos' ? [0, JANELA_PROXIMOS_MESES] : [-JANELA_ANTERIORES_MESES, 0];
    // O plantão noturno do último dia do mês anterior ainda pode estar em andamento.
    for (let delta = de - 1; delta <= ate; delta++) {
      const indice = base + delta;
      meses.push({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });
    }
    const publicados = await this.carregarMeses(meses);
    const meuId = String(profissionalId);

    const proprios: { plantao: PlantaoSnapshot; vinculo: VinculoSnapshot; mes: MesPublicado; inicio: number; fim: number }[] = [];
    for (const mes of publicados) {
      const plantaoPorId = new Map(mes.plantoes.map((p) => [String(p._id), p]));
      for (const vinculo of mes.vinculos) {
        if (String(vinculo.profissionalId) !== meuId) continue;
        const plantao = plantaoPorId.get(String(vinculo.plantaoId));
        if (!plantao) continue;
        const { inicio, fim } = inicioEFim(plantao);
        const encerrado = fim <= agora.getTime();
        if ((situacao === 'anteriores') !== encerrado) continue;
        proprios.push({ plantao, vinculo, mes, inicio, fim });
      }
    }
    proprios.sort((a, b) => (situacao === 'proximos' ? a.inicio - b.inicio : b.inicio - a.inicio));

    const total = proprios.length;
    const recorte = proprios.slice((pagina - 1) * limite, pagina * limite);
    const nomes = await this.resolverNomes(recorte.map((item) => item.mes));
    const itens = recorte.map(({ plantao, vinculo, mes, fim }) => {
      const equipe = mes.vinculos.filter((v) => String(v.plantaoId) === String(plantao._id));
      const pessoa = (v: VinculoSnapshot) => ({ nome: nomes.profissionais.get(String(v.profissionalId)) ?? '', lideranca: v.lideranca ?? false });
      const enfermeiros = equipe.filter((v) => v.funcao === 'enfermeiro' && String(v.profissionalId) !== meuId).map(pessoa);
      const tecnicos = equipe.filter((v) => v.funcao === 'tecnico' && String(v.profissionalId) !== meuId).map(pessoa);
      const chefe = equipe.find((v) => v.lideranca && v.funcao === 'enfermeiro') ?? equipe.find((v) => v.lideranca);
      return {
        plantaoId: String(plantao._id),
        data: isoDia(plantao.data),
        horarioInicio: plantao.horarioInicio,
        horarioFim: plantao.horarioFim,
        duracaoHoras: plantao.duracaoHoras,
        tipo: plantao.tipo,
        setor: { id: String(plantao.setorId), nome: nomes.setores.get(String(plantao.setorId)) ?? '' },
        funcao: vinculo.funcao,
        lideranca: vinculo.lideranca ?? false,
        status: fim <= agora.getTime() ? ('trabalhado' as const) : ('trabalhando' as const),
        chefe: chefe ? { nome: nomes.profissionais.get(String(chefe.profissionalId)) ?? '' } : null,
        enfermeiros: enfermeiros.map((p) => ({ nome: p.nome, lideranca: p.lideranca })),
        tecnicos: tecnicos.map((p) => ({ nome: p.nome })),
      };
    });
    return { itens, pagina, limite, total, totalPaginas: Math.max(1, Math.ceil(total / limite)) };
  }

  async escalaGeral(ano: number, mes: number) {
    const [publicado] = await this.carregarMeses([{ ano, mes }]);
    if (!publicado) return { ano, mes, publicada: false, versao: null, dias: [] };
    const nomes = await this.resolverNomes([publicado]);
    const porDia = new Map<string, PlantaoSnapshot[]>();
    for (const plantao of [...publicado.plantoes].sort((a, b) => isoDia(a.data).localeCompare(isoDia(b.data)) || (a.horarioInicio ?? '').localeCompare(b.horarioInicio ?? ''))) {
      const dia = isoDia(plantao.data);
      porDia.set(dia, [...(porDia.get(dia) ?? []), plantao]);
    }
    const dias = [...porDia.entries()].map(([data, plantoes]) => {
      const turnos = new Map<string, { turno: Turno; horarioInicio: string; horarioFim: string }>();
      const setores = new Set<string>();
      let chefe: string | null = null;
      for (const plantao of plantoes) {
        const turno = turnoDe(plantao as Plantao);
        turnos.set(`${turno}`, { turno, horarioInicio: plantao.horarioInicio ?? '', horarioFim: plantao.horarioFim ?? '' });
        const setor = nomes.setores.get(String(plantao.setorId));
        if (setor) setores.add(setor);
        if (!chefe) {
          const lider = publicado.vinculos.find((v) => String(v.plantaoId) === String(plantao._id) && v.lideranca && v.funcao === 'enfermeiro');
          if (lider) chefe = nomes.profissionais.get(String(lider.profissionalId)) ?? null;
        }
      }
      return { data, turnos: [...turnos.values()], chefe: chefe ? { nome: chefe } : null, setores: [...setores] };
    });
    return { ano, mes, publicada: true, versao: { numero: publicado.numero, publicadoEm: publicado.publicadoEm }, dias };
  }

  async escalaGeralDia(data: string) {
    const [ano, mes, dia] = data.split('-').map(Number);
    const normalizada = new Date(Date.UTC(ano, mes - 1, dia));
    if (isoDia(normalizada) !== data) throw new BadRequestException('data inválida.');
    const [publicado] = await this.carregarMeses([{ ano, mes }]);
    if (!publicado) return { data, publicada: false, chefe: null, enfermeiros: [], tecnicos: [], contagens: { enfermeiros: 0, tecnicos: 0 } };

    const nomes = await this.resolverNomes([publicado]);
    const plantoesDoDia = publicado.plantoes.filter((p) => isoDia(p.data) === data);
    const idsDoDia = new Set(plantoesDoDia.map((p) => String(p._id)));
    const plantaoPorId = new Map(plantoesDoDia.map((p) => [String(p._id), p]));
    const vinculos = publicado.vinculos.filter((v) => idsDoDia.has(String(v.plantaoId)));

    const nome = (v: VinculoSnapshot) => nomes.profissionais.get(String(v.profissionalId)) ?? '';
    const setorDe = (v: VinculoSnapshot) => nomes.setores.get(String(plantaoPorId.get(String(v.plantaoId))?.setorId)) ?? '';
    const agrupar = (funcao: 'enfermeiro' | 'tecnico') => {
      const grupos = new Map<string, { nome: string; cargo: string; setores: string[]; regime: string }>();
      for (const v of vinculos.filter((item) => item.funcao === funcao)) {
        const plantao = plantaoPorId.get(String(v.plantaoId))!;
        const regime = rotuloRegime(plantao, v.origemCobertura);
        const chave = `${v.profissionalId}|${regime}`;
        const atual = grupos.get(chave) ?? {
          nome: nome(v),
          cargo: funcao === 'tecnico' ? 'Técnico de enfermagem' : v.lideranca ? 'Enfermeiro chefe' : 'Enfermeiro',
          setores: [],
          regime,
        };
        const setor = setorDe(v);
        if (setor && !atual.setores.includes(setor)) atual.setores.push(setor);
        if (funcao === 'enfermeiro' && v.lideranca) atual.cargo = 'Enfermeiro chefe';
        grupos.set(chave, atual);
      }
      return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    };

    const enfermeiros = agrupar('enfermeiro');
    const tecnicos = agrupar('tecnico');
    const lider = vinculos.find((v) => v.lideranca && v.funcao === 'enfermeiro');
    const chefe = lider
      ? {
          nome: nome(lider),
          setores: [...new Set(vinculos.filter((v) => String(v.profissionalId) === String(lider.profissionalId) && v.lideranca).map(setorDe).filter(Boolean))],
          regime: rotuloRegime(plantaoPorId.get(String(lider.plantaoId))!, lider.origemCobertura),
        }
      : null;
    const distintos = (funcao: string) => new Set(vinculos.filter((v) => v.funcao === funcao).map((v) => String(v.profissionalId))).size;
    return {
      data,
      publicada: true,
      chefe,
      enfermeiros,
      tecnicos,
      contagens: { enfermeiros: distintos('enfermeiro'), tecnicos: distintos('tecnico') },
    };
  }

  /** Última versão oficial publicada de cada mês informado; meses sem versão são omitidos. */
  private async carregarMeses(periodos: { ano: number; mes: number }[]): Promise<MesPublicado[]> {
    if (periodos.length === 0) return [];
    const escalas = await this.escalas
      .find({ $or: periodos.map(({ ano, mes }) => ({ ano, mes })) }, { _id: 1, ano: 1, mes: 1 })
      .lean()
      .exec();
    if (escalas.length === 0) return [];
    const escalaPorId = new Map(escalas.map((e) => [String(e._id), e]));
    const ultimas = await this.versoes
      .aggregate<VersaoEscala & { _id: Types.ObjectId }>([
        { $match: { escalaId: { $in: escalas.map((e) => e._id) } } },
        { $sort: { numero: -1 } },
        { $group: { _id: '$escalaId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
      ])
      .exec();
    const resultado: MesPublicado[] = [];
    for (const versao of ultimas) {
      const escala = escalaPorId.get(String(versao.escalaId));
      const snapshot = versao.snapshot as { plantoes?: PlantaoSnapshot[]; profissionaisRelacionados?: VinculoSnapshot[] };
      if (!escala || !Array.isArray(snapshot.plantoes) || !Array.isArray(snapshot.profissionaisRelacionados)) continue;
      resultado.push({
        ano: escala.ano,
        mes: escala.mes,
        numero: versao.numero,
        publicadoEm: versao.publicadoEm,
        plantoes: snapshot.plantoes,
        vinculos: snapshot.profissionaisRelacionados,
      });
    }
    return resultado;
  }

  /** Resolve somente nomes de profissionais e de setores dos meses informados. */
  private async resolverNomes(meses: MesPublicado[]) {
    const unicos = [...new Set(meses)];
    const profissionalIds = [...new Set(unicos.flatMap((m) => m.vinculos.map((v) => String(v.profissionalId))))];
    const setorIds = [...new Set(unicos.flatMap((m) => m.plantoes.map((p) => String(p.setorId))))];
    const [profissionais, setores] = await Promise.all([
      this.profissionais.find({ _id: { $in: profissionalIds.map((id) => new Types.ObjectId(id)) } }, { usuarioId: 1 }).lean().exec(),
      this.setores.find({ _id: { $in: setorIds.map((id) => new Types.ObjectId(id)) } }, { nome: 1 }).lean().exec(),
    ]);
    const usuarios = await this.usuarios.find({ _id: { $in: profissionais.map((p) => p.usuarioId) } }, { nome: 1 }).lean().exec();
    const nomePorUsuario = new Map(usuarios.map((u) => [String(u._id), u.nome]));
    return {
      profissionais: new Map(profissionais.map((p) => [String(p._id), nomePorUsuario.get(String(p.usuarioId)) ?? ''])),
      setores: new Map(setores.map((s) => [String(s._id), s.nome])),
    };
  }
}
