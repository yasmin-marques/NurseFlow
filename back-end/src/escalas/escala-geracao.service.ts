import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { type ClientSession, type Connection, Model, Types } from 'mongoose';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { executarTransacao } from '../common/utils/mongo-transaction';
import { utcDate } from '../common/utils/date';
import type { AppConfig } from '../config/configuration';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import { Formacao } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import { Restricao } from '../restricoes/restricao.schema';
import { Setor } from '../setores/schemas/setor.schema';
import { Administrador } from '../usuarios/schemas/administrador.schema';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import type { GerarEscalaDto } from './dto/gerar-escala.dto';
import {
  type ConfiguracaoVigente,
  diasDoMes,
  montarProblema,
  type PlantaoAnterior,
  type ProfissionalEntrada,
  validarEntrada,
} from './montar-problema';
import { OtimizadorEscala, type OpcaoPlantao } from './otimizador/otimizador';
import { resumirCobertura } from './regras-plantao';
import {
  Escala,
  Plantao,
  PlantaoProfissional,
  StatusEscala,
  TipoPlantao,
} from './schemas';
import { EscalaSnapshotService } from './escala-snapshot.service';
import { errosSetorFixo } from './setor-fixo';

const MS_DIA = 86_400_000;
const HORARIOS: Record<OpcaoPlantao, { inicio: string; fim: string; horas: number }> = {
  '24h': { inicio: '07:00', fim: '07:00', horas: 24 },
  '12d': { inicio: '07:00', fim: '19:00', horas: 12 },
  '12n': { inicio: '19:00', fim: '07:00', horas: 12 },
};
const rotuloPeriodo = (ano: number, mes: number) => `${String(mes).padStart(2, '0')}/${String(ano).padStart(4, '0')}`;
const isoDia = (data: Date) => data.toISOString().slice(0, 10);

interface GeracaoEmAndamento {
  controller: AbortController;
  estado: 'otimizando' | 'cancelando' | 'salvando';
}

@Injectable()
export class EscalaGeracaoService {
  private readonly logger = new Logger(EscalaGeracaoService.name);
  private readonly emAndamento = new Set<string>();
  private readonly geracoes = new Map<string, GeracaoEmAndamento>();

  constructor(
    @InjectConnection() private readonly connection: Connection,
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
    private readonly snapshots: EscalaSnapshotService,
  ) {}

  async gerar(dto: GerarEscalaDto, usuario: UsuarioAutenticado) {
    const periodo = `${dto.ano}-${dto.mes}`;
    if (this.emAndamento.has(periodo)) {
      throw new ConflictException(`Já existe uma geração em andamento para ${rotuloPeriodo(dto.ano, dto.mes)}.`);
    }
    const operacaoId = dto.operacaoId ?? randomUUID();
    if (this.geracoes.has(operacaoId)) {
      throw new ConflictException('Já existe uma geração em andamento com esse identificador.');
    }
    const geracao: GeracaoEmAndamento = { controller: new AbortController(), estado: 'otimizando' };
    this.emAndamento.add(periodo);
    this.geracoes.set(operacaoId, geracao);
    try {
      return await this.gerarPeriodo({ ...dto, operacaoId }, usuario, geracao);
    } catch (erro) {
      if (geracao.estado === 'cancelando' || geracao.controller.signal.aborted) {
        throw new ConflictException('Geração cancelada. Nenhuma escala foi salva.');
      }
      throw erro;
    } finally {
      this.emAndamento.delete(periodo);
      this.geracoes.delete(operacaoId);
    }
  }

  async cancelar(operacaoId: string) {
    const geracao = this.geracoes.get(operacaoId);
    if (!geracao) throw new NotFoundException('Não há geração em andamento com esse identificador.');
    if (geracao.estado !== 'otimizando') {
      throw new ConflictException('A geração já está finalizando e não pode mais ser cancelada.');
    }

    geracao.estado = 'cancelando';
    try {
      await this.otimizador.cancelar(operacaoId);
    } finally {
      geracao.controller.abort();
    }
    return { operacaoId, cancelamentoSolicitado: true };
  }

  private async gerarPeriodo(
    dto: GerarEscalaDto & { operacaoId: string },
    usuario: UsuarioAutenticado,
    operacao: GeracaoEmAndamento,
  ) {
    const { ano, mes } = dto;
    const rotulo = rotuloPeriodo(ano, mes);

    const existente = await this.escalas.findOne({ ano, mes }).lean().exec();
    const substituivel =
      existente?.status === StatusEscala.RASCUNHO ||
      existente?.status === StatusEscala.EM_REVISAO ||
      existente?.status === StatusEscala.VALIDADA;
    if (existente && !substituivel) {
      throw new ConflictException(`Já existe uma escala ${existente.status} para ${rotulo} (id ${existente._id}). Ela não pode ser substituída.`);
    }
    if (existente && !dto.substituirRascunho) {
      throw new ConflictException(
        `Já existe uma escala em ${existente.status} para ${rotulo} (id ${existente._id}). Envie "substituirRascunho": true para gerar novamente.`,
      );
    }

    const configuracao = (await this.configuracoes.consultar(ano, mes)) as ConfiguracaoVigente;
    const inicioMes = utcDate(ano, mes - 1, 1);
    const fimMes = utcDate(ano, mes - 1, diasDoMes(ano, mes), 23, 59, 59, 999);

    const profissionaisDocs = await this.profissionais.find().lean().exec();
    const nomes = await this.nomesDosUsuarios(profissionaisDocs.map((profissional) => profissional.usuarioId));
    const profissionais: ProfissionalEntrada[] = profissionaisDocs.map((profissional) => ({
      id: String(profissional._id),
      nome: nomes.get(String(profissional.usuarioId)) ?? String(profissional._id),
      formacao: profissional.formacao,
      tipoVinculo: profissional.tipoVinculo,
      status: profissional.status,
      setorId: profissional.setorId ? String(profissional.setorId) : null,
    }));

    const setoresAtivos = await this.setores.find({ ativo: true }).sort({ nome: 1 }).lean().exec();
    const idsSetoresSolicitados = dto.setorIds ? new Set(dto.setorIds) : undefined;
    const setoresDocs = idsSetoresSolicitados
      ? setoresAtivos.filter((setor) => idsSetoresSolicitados.has(String(setor._id)))
      : setoresAtivos;
    if (dto.setorIds && setoresDocs.length !== dto.setorIds.length) {
      throw new UnprocessableEntityException({
        message: 'Um ou mais setores selecionados não estão ativos.',
        erros: ['Selecione somente setores ativos cadastrados.'],
      });
    }
    const setores = setoresDocs.map((setor) => ({
      id: String(setor._id),
      nome: setor.nome,
      plantao24h: { enfermeiros: setor.plantao24h.enfermeiros, tecnicos: setor.plantao24h.tecnicos },
    }));

    const erros = validarEntrada({ ano, mes, profissionais, setores, configuracao });
    if (erros.length > 0) {
      throw new UnprocessableEntityException({ message: 'Dados insuficientes para gerar a escala.', erros });
    }

    const restricoes = (
      await this.restricoes
        .find({ profissionalId: { $in: profissionaisDocs.map((profissional) => profissional._id) }, inicio: { $lte: fimMes }, fim: { $gte: inicioMes } })
        .lean()
        .exec()
    ).map((restricao) => ({
      profissionalId: String(restricao.profissionalId),
      tipo: restricao.tipo,
      inicio: restricao.inicio,
      fim: restricao.fim,
      diaSemana: restricao.diaSemana,
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

    problema.operacao_id = dto.operacaoId;
    this.exigirGeracaoAtiva(operacao);
    const solucao = await this.otimizador.resolver(problema, operacao.controller.signal);
    this.exigirGeracaoAtiva(operacao);

    const porId = new Map(profissionais.map((profissional) => [profissional.id, profissional]));
    const nomeSetor = new Map(setores.map((setor) => [setor.id, setor.nome]));
    const pendencias = solucao.descobertos.map((descoberto) => ({
      setorId: descoberto.setor_id,
      setor: nomeSetor.get(descoberto.setor_id) ?? descoberto.setor_id,
      data: isoDia(utcDate(ano, mes - 1, descoberto.dia)),
      turno: descoberto.turno,
      funcao: descoberto.funcao,
      necessario: descoberto.necessario,
      alocado: descoberto.alocado,
      faltam: descoberto.faltam,
      motivo: 'Quantitativo mínimo não atingido sem violar as restrições obrigatórias.',
    }));
    const cobertura = resumirCobertura({ ano, mes, setores, pendencias });

    const cargas = solucao.estatisticas.cargas.map((carga) => {
      const profissional = porId.get(carga.profissional_id)!;
      const esperada = problema.profissionais.find((item) => item.id === carga.profissional_id)!;
      if (carga.faltam_24h + carga.faltam_12h > 0) {
        conflitos.push({
          tipo: 'CARGA_ABAIXO_DO_ESPERADO',
          profissionalId: profissional.id,
          profissional: profissional.nome,
          motivo: `Faltam ${carga.faltam_24h} plantão(ões) de 24h e ${carga.faltam_12h} de 12h para a carga esperada do vínculo ${profissional.tipoVinculo}.`,
        });
      }
      if (carga.extras > esperada.max_extras) {
        avisos.push({
          tipo: 'EXTRAS_ALOCADOS',
          profissionalId: profissional.id,
          profissional: profissional.nome,
          motivo: `${carga.extras} plantão(ões) extra(s), acima do limite mensal de ${esperada.max_extras}.`,
        });
      }
      return {
        profissionalId: profissional.id,
        profissional: profissional.nome,
        vinculo: profissional.tipoVinculo,
        esperada: { plantoes24h: esperada.carga_24h, plantoes12h: esperada.carga_12h },
        atribuida: { plantoes24h: carga.plantoes_24h, plantoes12h: carga.plantoes_12h },
        extras: carga.extras,
      };
    });

    const geracao = {
      geradaEm: new Date(),
      geradaPor: usuario.id,
      configuracao,
      escopo: { setorIds: setores.map((setor) => setor.id), turnos: ['diurno', 'noturno'] },
      resumo: {
        alocacoes: solucao.estatisticas.total_alocacoes,
        vagasDescobertas: solucao.estatisticas.total_descobertos,
        extras: cargas.reduce((total, carga) => total + carga.extras, 0),
        cobertura,
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
    this.exigirGeracaoAtiva(operacao);
    operacao.estado = 'salvando';
    const escalaId = await this.gravar(
      existente?._id,
      existente?.revisao,
      { ano, mes, administradorId, geracao },
      solucao.alocacoes,
      porId,
      new Map(setores.map((setor) => [setor.id, setor.nome])),
    );
    const escala = await this.escalas.findById(escalaId).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada após a geração.');
    return this.snapshots.montarResposta(escala);
  }

  private exigirGeracaoAtiva(operacao: GeracaoEmAndamento) {
    if (operacao.estado !== 'otimizando' || operacao.controller.signal.aborted) {
      throw new ConflictException('Geração cancelada. Nenhuma escala foi salva.');
    }
  }

  private async gravar(
    existenteId: Types.ObjectId | undefined,
    revisaoExistente: number | undefined,
    base: { ano: number; mes: number; administradorId: Types.ObjectId; geracao: Record<string, unknown> },
    alocacoes: { profissional_id: string; setor_id: string; dia: number; opcao: OpcaoPlantao; extra: boolean }[],
    porId: Map<string, ProfissionalEntrada>,
    nomesSetor: Map<string, string>,
  ): Promise<Types.ObjectId> {
    // Última barreira antes de gravar: nenhuma alocação pode contrariar o setor fixo do cadastro.
    const errosSetor = errosSetorFixo(
      alocacoes.map((alocacao) => ({
        profissionalId: alocacao.profissional_id,
        profissional: porId.get(alocacao.profissional_id)?.nome,
        setorId: alocacao.setor_id,
      })),
      new Map([...porId].map(([id, profissional]) => [id, profissional.setorId])),
      nomesSetor,
    );
    if (errosSetor.length > 0) {
      throw new UnprocessableEntityException({
        message: 'A escala gerada contém alocações fora do setor fixo dos profissionais. Nada foi salvo.',
        erros: errosSetor,
      });
    }
    try {
      return await executarTransacao(this.connection, async (session) => {
        const escalaId = existenteId ?? new Types.ObjectId();
        if (existenteId) {
          await this.removerConteudo(escalaId, session);
          const atualizada = await this.escalas.updateOne(
            {
              _id: escalaId,
              status: { $in: [StatusEscala.RASCUNHO, StatusEscala.EM_REVISAO, StatusEscala.VALIDADA] },
              revisao: revisaoExistente,
            },
            {
              $set: {
                administradorId: base.administradorId,
                dataCriacao: new Date(),
                geracao: base.geracao,
                status: StatusEscala.RASCUNHO,
              },
              $unset: { validacao: 1 },
              $inc: { revisao: 1 },
            },
            { session },
          );
          if (atualizada.matchedCount !== 1) {
            throw new ConflictException('A escala deixou de ser um rascunho, uma escala em revisão ou uma escala validada não publicada e não pode ser substituída.');
          }
        } else {
          await this.escalas.create([{ _id: escalaId, ...base, status: StatusEscala.RASCUNHO }], { session });
        }

        const agrupados = new Map<string, { doc: Partial<Plantao> & { _id: Types.ObjectId }; opcao: string; profissionais: string[] }>();
        for (const alocacao of alocacoes) {
          const chave = `${alocacao.setor_id}|${alocacao.dia}|${alocacao.opcao}|${alocacao.extra}`;
          let grupo = agrupados.get(chave);
          if (!grupo) {
            const horario = HORARIOS[alocacao.opcao];
            grupo = {
              doc: {
                _id: new Types.ObjectId(),
                escalaId,
                setorId: new Types.ObjectId(alocacao.setor_id),
                data: utcDate(base.ano, base.mes - 1, alocacao.dia),
                horarioInicio: horario.inicio,
                horarioFim: horario.fim,
                duracaoHoras: horario.horas,
                tipo: alocacao.extra ? TipoPlantao.EXTRA : TipoPlantao.REGULAR,
              },
              opcao: alocacao.opcao,
              profissionais: [],
            };
            agrupados.set(chave, grupo);
          }
          grupo.profissionais.push(alocacao.profissional_id);
        }
        const docs = [...agrupados.values()];
        if (docs.length > 0) {
          await this.plantoes.insertMany(docs.map((grupo) => grupo.doc), { session });
          await this.relacionados.insertMany(
            docs.flatMap((grupo) => {
              const chefe = grupo.opcao === '24h'
                ? grupo.profissionais.find((id) => porId.get(id)!.formacao === Formacao.ENFERMEIRO)
                : undefined;
              return grupo.profissionais.map((id) => ({
                plantaoId: grupo.doc._id,
                profissionalId: new Types.ObjectId(id),
                funcao: porId.get(id)!.formacao,
                lideranca: id === chefe,
              }));
            }),
            { session },
          );
        }
        return escalaId;
      });
    } catch (erro) {
      this.logger.error(`Falha ao gravar a escala ${rotuloPeriodo(base.ano, base.mes)}: ${(erro as Error).message}`);
      if ((erro as { code?: number }).code === 11000 && !existenteId) {
        throw new ConflictException(`Já existe uma escala para ${rotuloPeriodo(base.ano, base.mes)}.`);
      }
      throw erro;
    }
  }

  private async removerConteudo(escalaId: Types.ObjectId, session: ClientSession) {
    const ids = (await this.plantoes.find({ escalaId }, { _id: 1 }).session(session).lean().exec()).map((plantao) => plantao._id);
    if (ids.length > 0) await this.relacionados.deleteMany({ plantaoId: { $in: ids } }, { session });
    await this.plantoes.deleteMany({ escalaId }, { session });
  }

  private async administradorDe(usuarioId: string): Promise<Types.ObjectId> {
    const admin = await this.administradores.findOne({ usuarioId }).lean().exec();
    return admin?._id ?? new Types.ObjectId(usuarioId);
  }

  private async nomesDosUsuarios(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const lista = await this.usuarios.find({ _id: { $in: ids } }, { nome: 1 }).lean().exec();
    return new Map(lista.map((usuario) => [String(usuario._id), usuario.nome]));
  }

  private async plantoesDoMesAnterior(ano: number, mes: number, inicioMes: Date): Promise<PlantaoAnterior[]> {
    const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
    const escala = await this.escalas.findOne(anterior, { _id: 1 }).lean().exec();
    if (!escala) return [];
    const plantoes = await this.plantoes
      .find({ escalaId: escala._id, data: { $gte: new Date(inicioMes.getTime() - 5 * MS_DIA), $lt: inicioMes } })
      .lean()
      .exec();
    if (plantoes.length === 0) return [];
    const vinculos = await this.relacionados.find({ plantaoId: { $in: plantoes.map((plantao) => plantao._id) } }).lean().exec();
    const porPlantao = new Map(plantoes.map((plantao) => [String(plantao._id), plantao]));
    return vinculos.map((vinculo) => {
      const plantao = porPlantao.get(String(vinculo.plantaoId))!;
      return {
        profissionalId: String(vinculo.profissionalId),
        data: plantao.data,
        horarioInicio: plantao.horarioInicio,
        duracaoHoras: plantao.duracaoHoras,
      };
    });
  }
}
