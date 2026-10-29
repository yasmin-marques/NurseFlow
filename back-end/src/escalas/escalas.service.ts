import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import type { AppConfig } from '../config/configuration';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Restricao } from '../restricoes/restricao.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { Administrador } from '../usuarios/schemas/administrador.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import type { GerarEscalaDto } from './dto/gerar-escala.dto';
import {
  type ConfiguracaoVigente,
  diasDoMes,
  type Mensagem,
  montarProblema,
  type PlantaoAnterior,
  type ProfissionalEntrada,
  validarEntrada,
} from './montar-problema';
import { OtimizadorEscala, type OpcaoPlantao } from './otimizador/otimizador';
import { Escala, Plantao, PlantaoProfissional, StatusEscala, TipoPlantao } from './schemas';

const MS_DIA = 86_400_000;

const HORARIOS: Record<OpcaoPlantao, { inicio: string; fim: string; horas: number }> = {
  '24h': { inicio: '07:00', fim: '07:00', horas: 24 },
  '12d': { inicio: '07:00', fim: '19:00', horas: 12 },
  '12n': { inicio: '19:00', fim: '07:00', horas: 12 },
};

const rotuloPeriodo = (ano: number, mes: number) => `${String(mes).padStart(2, '0')}/${ano}`;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class EscalasService {
  private readonly logger = new Logger(EscalasService.name);
  /** Impede duas gerações simultâneas do mesmo período nesta instância (o índice único cobre o resto). */
  private readonly emAndamento = new Set<string>();

  constructor(
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(Plantao.name) private readonly plantoes: Model<Plantao>,
    @InjectModel(PlantaoProfissional.name) private readonly relacionados: Model<PlantaoProfissional>,
    @InjectModel(Profissional.name) private readonly profissionais: Model<Profissional>,
    @InjectModel(Usuario.name) private readonly usuarios: Model<Usuario>,
    @InjectModel(Administrador.name) private readonly administradores: Model<Administrador>,
    @InjectModel(Setor.name) private readonly setores: Model<Setor>,
    @InjectModel(Restricao.name) private readonly restricoes: Model<Restricao>,
    private readonly configuracoes: ConfiguracoesService,
    private readonly otimizador: OtimizadorEscala,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** RF005/US07: gera a escala do mês como RASCUNHO. */
  async gerar(dto: GerarEscalaDto, usuario: UsuarioAutenticado) {
    const periodo = `${dto.ano}-${dto.mes}`;
    if (this.emAndamento.has(periodo)) {
      throw new ConflictException(`Já existe uma geração em andamento para ${rotuloPeriodo(dto.ano, dto.mes)}.`);
    }
    this.emAndamento.add(periodo);
    try {
      return await this.gerarPeriodo(dto, usuario);
    } finally {
      this.emAndamento.delete(periodo);
    }
  }

  async obter(id: string) {
    const escala = await this.escalas.findById(id).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    return this.montarResposta(escala);
  }

  private async gerarPeriodo(dto: GerarEscalaDto, usuario: UsuarioAutenticado) {
    const { ano, mes } = dto;
    const rotulo = rotuloPeriodo(ano, mes);

    const existente = await this.escalas.findOne({ ano, mes }).lean().exec();
    if (existente && existente.status !== StatusEscala.RASCUNHO) {
      throw new ConflictException(`Já existe uma escala ${existente.status} para ${rotulo} (id ${existente._id}). Ela não pode ser substituída.`);
    }
    if (existente && !dto.substituirRascunho) {
      throw new ConflictException(
        `Já existe um rascunho de escala para ${rotulo} (id ${existente._id}). Envie "substituirRascunho": true para gerar novamente.`,
      );
    }

    // Configuração vigente NO MOMENTO da geração (nunca valores fixos nem reaproveitados de escalas antigas).
    const configuracao = (await this.configuracoes.consultar(ano, mes)) as ConfiguracaoVigente;
    const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
    const fimMes = new Date(Date.UTC(ano, mes - 1, diasDoMes(ano, mes), 23, 59, 59, 999));

    const profissionaisDocs = await this.profissionais.find().lean().exec();
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((p) => p.usuarioId));
    const profissionais: ProfissionalEntrada[] = profissionaisDocs.map((p) => ({
      id: String(p._id),
      nome: nomes.get(String(p.usuarioId)) ?? String(p._id),
      formacao: p.formacao,
      tipoVinculo: p.tipoVinculo,
      status: p.status,
    }));

    const setoresDocs = await this.setores.find({ ativo: true }).sort({ nome: 1 }).lean().exec();
    const setores = setoresDocs.map((s) => ({
      id: String(s._id),
      nome: s.nome,
      turnos: {
        diurno: { enfermeiros: s.turnos.diurno.enfermeiros, tecnicos: s.turnos.diurno.tecnicos },
        noturno: { enfermeiros: s.turnos.noturno.enfermeiros, tecnicos: s.turnos.noturno.tecnicos },
      },
    }));

    const erros = validarEntrada({ ano, mes, profissionais, setores, configuracao });
    if (erros.length > 0) {
      throw new UnprocessableEntityException({ message: 'Dados insuficientes para gerar a escala.', erros });
    }

    const restricoes = (
      await this.restricoes
        .find({ profissionalId: { $in: profissionaisDocs.map((p) => p._id) }, inicio: { $lte: fimMes }, fim: { $gte: inicioMes } })
        .lean()
        .exec()
    ).map((r) => ({
      profissionalId: String(r.profissionalId),
      tipo: r.tipo,
      inicio: r.inicio,
      fim: r.fim,
      diaSemana: r.diaSemana,
    }));

    const { problema, conflitos, avisos } = montarProblema({
      ano,
      mes,
      profissionais,
      setores,
      restricoes,
      configuracao,
      plantoesAnteriores: await this.plantoesDoMesAnterior(ano, mes, inicioMes),
      tempoLimiteSegundos: this.config.get('otimizador', { infer: true }).tempoLimiteSegundos,
    });

    const solucao = await this.otimizador.resolver(problema);

    const porId = new Map(profissionais.map((p) => [p.id, p]));
    const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));

    const pendencias = solucao.descobertos.map((d) => ({
      setorId: d.setor_id,
      setor: nomeSetor.get(d.setor_id) ?? d.setor_id,
      data: isoDia(new Date(Date.UTC(ano, mes - 1, d.dia))),
      turno: d.turno,
      funcao: d.funcao,
      necessario: d.necessario,
      alocado: d.alocado,
      faltam: d.faltam,
      motivo: 'Quantitativo mínimo não atingido sem violar as restrições obrigatórias.',
    }));

    const cargas = solucao.estatisticas.cargas.map((c) => {
      const p = porId.get(c.profissional_id)!;
      const esperada = problema.profissionais.find((x) => x.id === c.profissional_id)!;
      if (c.faltam_24h + c.faltam_12h > 0) {
        conflitos.push({
          tipo: 'CARGA_ABAIXO_DO_ESPERADO',
          profissionalId: p.id,
          profissional: p.nome,
          motivo: `Faltam ${c.faltam_24h} plantão(ões) de 24h e ${c.faltam_12h} de 12h para a carga esperada do vínculo ${p.tipoVinculo}.`,
        });
      }
      if (c.extras > 0) {
        avisos.push({
          tipo: 'EXTRAS_ALOCADOS',
          profissionalId: p.id,
          profissional: p.nome,
          motivo: `${c.extras} plantão(ões) extra(s) além da carga regular.`,
        });
      }
      return {
        profissionalId: p.id,
        profissional: p.nome,
        vinculo: p.tipoVinculo,
        esperada: { plantoes24h: esperada.carga_24h, plantoes12h: esperada.carga_12h },
        atribuida: { plantoes24h: c.plantoes_24h, plantoes12h: c.plantoes_12h },
        extras: c.extras,
      };
    });

    const geracao = {
      geradaEm: new Date(),
      geradaPor: usuario.id,
      // Retrato da configuração usada: mudanças posteriores não alteram esta escala.
      configuracao,
      resumo: {
        alocacoes: solucao.estatisticas.total_alocacoes,
        vagasDescobertas: solucao.estatisticas.total_descobertos,
        extras: cargas.reduce((total, c) => total + c.extras, 0),
        solver: {
          status: solucao.estatisticas.status,
          otimo: solucao.estatisticas.otimo,
          objetivo: solucao.estatisticas.objetivo,
          melhorLimite: solucao.estatisticas.melhor_limite,
          tempoSegundos: solucao.estatisticas.tempo_segundos,
        },
      },
      pendencias,
      conflitos,
      avisos,
      cargas,
    };

    const administradorId = await this.administradorDe(usuario.id);
    const escalaId = await this.gravar(existente?._id, { ano, mes, administradorId, geracao }, solucao.alocacoes, porId);
    return this.obter(String(escalaId));
  }

  /** Grava (ou regrava o rascunho) escala, plantões e vínculos profissional-plantão. */
  private async gravar(
    existenteId: Types.ObjectId | undefined,
    base: { ano: number; mes: number; administradorId: Types.ObjectId; geracao: Record<string, unknown> },
    alocacoes: { profissional_id: string; setor_id: string; dia: number; opcao: OpcaoPlantao; extra: boolean }[],
    porId: Map<string, ProfissionalEntrada>,
  ): Promise<Types.ObjectId> {
    let escalaId: Types.ObjectId;
    if (existenteId) {
      escalaId = existenteId;
      await this.removerConteudo(escalaId);
      await this.escalas.updateOne(
        { _id: escalaId },
        { $set: { administradorId: base.administradorId, dataCriacao: new Date(), geracao: base.geracao } },
      );
    } else {
      try {
        const criada = await this.escalas.create({ ...base, status: StatusEscala.RASCUNHO });
        escalaId = criada._id;
      } catch (erro) {
        if ((erro as { code?: number }).code === 11000) {
          throw new ConflictException(`Já existe uma escala para ${rotuloPeriodo(base.ano, base.mes)}.`);
        }
        throw erro;
      }
    }

    try {
      const agrupados = new Map<string, { doc: Partial<Plantao> & { _id: Types.ObjectId }; profissionais: string[] }>();
      for (const a of alocacoes) {
        const chave = `${a.setor_id}|${a.dia}|${a.opcao}|${a.extra}`;
        let grupo = agrupados.get(chave);
        if (!grupo) {
          const h = HORARIOS[a.opcao];
          grupo = {
            doc: {
              _id: new Types.ObjectId(),
              escalaId,
              setorId: new Types.ObjectId(a.setor_id),
              data: new Date(Date.UTC(base.ano, base.mes - 1, a.dia)),
              horarioInicio: h.inicio,
              horarioFim: h.fim,
              duracaoHoras: h.horas,
              tipo: a.extra ? TipoPlantao.EXTRA : TipoPlantao.REGULAR,
            },
            profissionais: [],
          };
          agrupados.set(chave, grupo);
        }
        grupo.profissionais.push(a.profissional_id);
      }
      const docs = [...agrupados.values()];
      if (docs.length > 0) {
        await this.plantoes.insertMany(docs.map((g) => g.doc));
        await this.relacionados.insertMany(
          docs.flatMap((g) =>
            g.profissionais.map((pid) => ({
              plantaoId: g.doc._id,
              profissionalId: new Types.ObjectId(pid),
              funcao: porId.get(pid)!.formacao,
            })),
          ),
        );
      }
    } catch (erro) {
      this.logger.error(`Falha ao gravar a escala ${rotuloPeriodo(base.ano, base.mes)}: ${(erro as Error).message}`);
      await this.removerConteudo(escalaId);
      if (!existenteId) await this.escalas.deleteOne({ _id: escalaId });
      throw erro;
    }
    return escalaId;
  }

  private async removerConteudo(escalaId: Types.ObjectId) {
    const ids = (await this.plantoes.find({ escalaId }, { _id: 1 }).lean().exec()).map((p) => p._id);
    if (ids.length > 0) await this.relacionados.deleteMany({ plantaoId: { $in: ids } });
    await this.plantoes.deleteMany({ escalaId });
  }

  private async administradorDe(usuarioId: string): Promise<Types.ObjectId> {
    const admin = await this.administradores.findOne({ usuarioId }).lean().exec();
    return admin?._id ?? new Types.ObjectId(usuarioId);
  }

  private async nomesDosUsuarios(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const lista = await this.usuarios.find({ _id: { $in: ids } }, { nome: 1 }).lean().exec();
    return new Map(lista.map((u) => [String(u._id), u.nome]));
  }

  /** Plantões dos últimos dias da escala do mês anterior (qualquer status), para herdar o descanso. */
  private async plantoesDoMesAnterior(ano: number, mes: number, inicioMes: Date): Promise<PlantaoAnterior[]> {
    const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
    const escala = await this.escalas.findOne(anterior, { _id: 1 }).lean().exec();
    if (!escala) return [];
    const plantoes = await this.plantoes
      .find({ escalaId: escala._id, data: { $gte: new Date(inicioMes.getTime() - 5 * MS_DIA), $lt: inicioMes } })
      .lean()
      .exec();
    if (plantoes.length === 0) return [];
    const vinculos = await this.relacionados.find({ plantaoId: { $in: plantoes.map((p) => p._id) } }).lean().exec();
    const porPlantao = new Map(plantoes.map((p) => [String(p._id), p]));
    return vinculos.map((v) => {
      const p = porPlantao.get(String(v.plantaoId))!;
      return { profissionalId: String(v.profissionalId), data: p.data, horarioInicio: p.horarioInicio, duracaoHoras: p.duracaoHoras };
    });
  }

  private async montarResposta(escala: Escala & { _id: Types.ObjectId }) {
    const plantoes = await this.plantoes.find({ escalaId: escala._id }).sort({ data: 1, horarioInicio: 1 }).lean().exec();
    const vinculos = await this.relacionados.find({ plantaoId: { $in: plantoes.map((p) => p._id) } }).lean().exec();
    const profissionaisDocs = await this.profissionais.find({ _id: { $in: vinculos.map((v) => v.profissionalId) } }).lean().exec();
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((p) => p.usuarioId));
    const profissionalPorId = new Map(
      profissionaisDocs.map((p) => [String(p._id), { id: String(p._id), nome: nomes.get(String(p.usuarioId)) ?? '', formacao: p.formacao, vinculo: p.tipoVinculo }]),
    );
    const setoresDocs = await this.setores.find({ _id: { $in: plantoes.map((p) => p.setorId) } }, { nome: 1 }).lean().exec();
    const nomeSetor = new Map(setoresDocs.map((s) => [String(s._id), s.nome]));

    const geracao = (escala.geracao ?? {}) as {
      resumo?: unknown;
      configuracao?: unknown;
      pendencias?: unknown[];
      conflitos?: Mensagem[];
      avisos?: Mensagem[];
      cargas?: unknown[];
    };

    return {
      escala: {
        id: String(escala._id),
        ano: escala.ano,
        mes: escala.mes,
        status: escala.status,
        administradorId: String(escala.administradorId),
        dataCriacao: escala.dataCriacao,
      },
      resumo: { plantoes: plantoes.length, ...(geracao.resumo as object) },
      configuracaoUtilizada: geracao.configuracao ?? null,
      plantoes: plantoes.map((p) => ({
        id: String(p._id),
        data: isoDia(p.data),
        setor: { id: String(p.setorId), nome: nomeSetor.get(String(p.setorId)) ?? '' },
        horarioInicio: p.horarioInicio,
        horarioFim: p.horarioFim,
        duracaoHoras: p.duracaoHoras,
        tipo: p.tipo,
        profissionais: vinculos
          .filter((v) => String(v.plantaoId) === String(p._id))
          .map((v) => profissionalPorId.get(String(v.profissionalId)))
          .filter(Boolean),
      })),
      pendencias: geracao.pendencias ?? [],
      conflitos: geracao.conflitos ?? [],
      avisos: geracao.avisos ?? [],
      cargas: geracao.cargas ?? [],
    };
  }
}
