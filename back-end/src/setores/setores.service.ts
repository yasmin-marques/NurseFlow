import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type QueryFilter, type Model, type Types } from 'mongoose';
import { COLLATION_PT, regexSemAcentos, semAcentos } from '../common/utils/text';
import { Formacao } from '../profissionais/profissionais.enums';
import { Profissional } from '../profissionais/schemas/profissional.schema';
import type {
  CreateSetorDto,
  CreateSubsetorDto,
  ListSetoresQueryDto,
  SetorResponseDto,
  SubsetorResponseDto,
  UpdateSetorDto,
  UpdateSubsetorDto,
} from './dto/setor.dto';
import { Setor, type SetorDocument } from './schemas/setor.schema';
import { Subsetor, type SubsetorDocument } from './schemas/subsetor.schema';

@Injectable()
export class SetoresService {
  constructor(
    @InjectModel(Setor.name) private readonly setorModel: Model<Setor>,
    @InjectModel(Subsetor.name) private readonly subsetorModel: Model<Subsetor>,
    @InjectModel(Profissional.name) private readonly profissionalModel: Model<Profissional>,
  ) {}

  /**
   * DA07: cadastro com quantitativo mínimo inicial por plantão de 24h.
   * Sem `subsetores`: o setor define enfermeiros e técnicos. Com `subsetores`: o setor define só os enfermeiros e
   * cada subsetor define seus técnicos.
   */
  async criar(dto: CreateSetorDto): Promise<SetorResponseDto> {
    const subsetores = dto.subsetores ?? [];
    const possuiSubsetores = subsetores.length > 0;
    this.validarQuantitativoDoSetor(dto.plantao24h.tecnicos, possuiSubsetores);
    this.exigirNomesDistintos(subsetores.map((subsetor) => subsetor.nome));
    await this.garantirNomeLivre(dto.nome);

    const setor = await this.setorModel.create({
      nome: dto.nome,
      descricao: dto.descricao,
      plantao24h: {
        enfermeiros: dto.plantao24h.enfermeiros,
        tecnicos: possuiSubsetores ? this.somarTecnicos(subsetores) : (dto.plantao24h.tecnicos as number),
      },
      possuiSubsetores,
      ativo: true,
    });

    if (possuiSubsetores) {
      try {
        await this.subsetorModel.insertMany(
          subsetores.map((subsetor) => ({
            setorId: setor._id,
            nome: subsetor.nome,
            descricao: subsetor.descricao,
            plantao24h: { tecnicos: subsetor.plantao24h.tecnicos },
            ativo: true,
          })),
        );
      } catch (erro) {
        // Mongo standalone não tem transações: desfaz o setor criado na primeira etapa.
        await this.subsetorModel.deleteMany({ setorId: setor._id });
        await this.setorModel.deleteOne({ _id: setor._id });
        throw erro;
      }
    }
    return this.paraRespostaPorId(setor);
  }

  async listar(query: ListSetoresQueryDto): Promise<SetorResponseDto[]> {
    const filtro: QueryFilter<Setor> = {};
    if (query.ativo !== undefined) filtro.ativo = query.ativo;
    if (query.busca) filtro.nome = { $regex: regexSemAcentos(query.busca), $options: 'i' };

    const setores = await this.setorModel.find(filtro).sort({ nome: 1 }).collation(COLLATION_PT).exec();
    const ids = setores.map((setor) => setor._id);
    const [subsetores, semSubsetor] = await Promise.all([
      this.subsetorModel.find({ setorId: { $in: ids } }).sort({ nome: 1 }).collation(COLLATION_PT).exec(),
      this.contarTecnicosSemSubsetor(setores),
    ]);
    return setores.map((setor) =>
      this.paraResposta(
        setor,
        subsetores.filter((subsetor) => subsetor.setorId.equals(setor._id)),
        semSubsetor.get(String(setor._id)) ?? 0,
      ),
    );
  }

  async obter(id: string): Promise<SetorResponseDto> {
    return this.paraRespostaPorId(await this.carregar(id));
  }

  /** DA07/DA08: edita dados do setor e/ou o quantitativo mínimo por plantão de 24h. */
  async atualizar(id: string, dto: UpdateSetorDto): Promise<SetorResponseDto> {
    const setor = await this.carregar(id);
    if (dto.nome !== undefined) await this.garantirNomeLivre(dto.nome, setor);
    if (dto.plantao24h?.tecnicos !== undefined && setor.possuiSubsetores) {
      throw new BadRequestException(
        'Este setor possui subsetores: o mínimo de técnicos é definido em cada subsetor, não no setor.',
      );
    }

    // Mínimos por subsetor: valida tudo antes de gravar qualquer coisa (todos precisam ser deste setor).
    const minimos = dto.subsetores ?? [];
    let alvos: SubsetorDocument[] = [];
    if (minimos.length > 0) {
      if (!setor.possuiSubsetores) throw new BadRequestException('Este setor não possui subsetores.');
      const ids = minimos.map((minimo) => minimo.id);
      if (new Set(ids).size !== ids.length) throw new BadRequestException('Subsetor repetido na edição dos mínimos.');
      alvos = await this.subsetorModel.find({ _id: { $in: ids }, setorId: setor._id }).exec();
      if (alvos.length !== ids.length) throw new NotFoundException('Subsetor não encontrado neste setor.');
    }

    if (dto.nome !== undefined) setor.nome = dto.nome;
    if (dto.descricao !== undefined) setor.descricao = dto.descricao;
    if (dto.plantao24h?.enfermeiros !== undefined) setor.plantao24h.enfermeiros = dto.plantao24h.enfermeiros;
    if (dto.plantao24h?.tecnicos !== undefined) setor.plantao24h.tecnicos = dto.plantao24h.tecnicos;
    for (const alvo of alvos) {
      const minimo = minimos.find((item) => item.id === alvo._id.toString());
      if (minimo) {
        alvo.plantao24h.tecnicos = minimo.plantao24h.tecnicos;
        await alvo.save();
      }
    }
    await this.sincronizarMinimoDerivado(setor);
    return this.paraRespostaPorId(setor);
  }

  /**
   * Inativa o setor (sem exclusão). Quando o módulo de Escalas existir, esta é a operação que
   * deverá consultar plantões futuros do setor antes de inativar.
   */
  inativar(id: string): Promise<SetorResponseDto> {
    return this.definirAtivo(id, false);
  }

  ativar(id: string): Promise<SetorResponseDto> {
    return this.definirAtivo(id, true);
  }

  /**
   * Cria um subsetor. Se o setor ainda não tinha subsetores, passa a tê-los: o mínimo próprio de técnicos do setor
   * deixa de existir (vira a soma dos subsetores) e técnicos já vinculados diretamente ao setor ficam pendentes de
   * escolha de subsetor (ver `tecnicosSemSubsetor`) — nenhum subsetor é atribuído automaticamente.
   */
  async criarSubsetor(setorId: string, dto: CreateSubsetorDto): Promise<SetorResponseDto> {
    const setor = await this.carregar(setorId);
    await this.garantirNomeDeSubsetorLivre(setor._id, dto.nome);
    await this.subsetorModel.create({
      setorId: setor._id,
      nome: dto.nome,
      descricao: dto.descricao,
      plantao24h: { tecnicos: dto.plantao24h.tecnicos },
      ativo: true,
    });
    setor.possuiSubsetores = true;
    await this.sincronizarMinimoDerivado(setor);
    return this.paraRespostaPorId(setor);
  }

  async atualizarSubsetor(setorId: string, subsetorId: string, dto: UpdateSubsetorDto): Promise<SetorResponseDto> {
    const setor = await this.carregar(setorId);
    const subsetor = await this.carregarSubsetor(setor._id, subsetorId);
    if (dto.nome !== undefined) await this.garantirNomeDeSubsetorLivre(setor._id, dto.nome, subsetor);

    if (dto.nome !== undefined) subsetor.nome = dto.nome;
    if (dto.descricao !== undefined) subsetor.descricao = dto.descricao;
    if (dto.plantao24h?.tecnicos !== undefined) subsetor.plantao24h.tecnicos = dto.plantao24h.tecnicos;
    await subsetor.save();
    await this.sincronizarMinimoDerivado(setor);
    return this.paraRespostaPorId(setor);
  }

  /**
   * Inativa o subsetor (sem exclusão). Não é permitido se houver profissionais vinculados a ele (precisam ser
   * remanejados antes) nem se for o último subsetor ativo do setor (o setor ficaria sem mínimo de técnicos definido).
   */
  async inativarSubsetor(setorId: string, subsetorId: string): Promise<SetorResponseDto> {
    const setor = await this.carregar(setorId);
    const subsetor = await this.carregarSubsetor(setor._id, subsetorId);
    if (subsetor.ativo) {
      const vinculados = await this.profissionalModel.countDocuments({ subsetorId: subsetor._id });
      if (vinculados > 0) {
        throw new ConflictException(
          `Não é possível inativar o subsetor: há ${vinculados} profissional(is) vinculado(s). Remaneje-os para outro subsetor antes.`,
        );
      }
      const outrosAtivos = await this.subsetorModel.countDocuments({ setorId: setor._id, ativo: true, _id: { $ne: subsetor._id } });
      if (outrosAtivos === 0) {
        throw new ConflictException('Não é possível inativar o único subsetor ativo do setor.');
      }
      subsetor.ativo = false;
      await subsetor.save();
      await this.sincronizarMinimoDerivado(setor);
    }
    return this.paraRespostaPorId(setor);
  }

  async ativarSubsetor(setorId: string, subsetorId: string): Promise<SetorResponseDto> {
    const setor = await this.carregar(setorId);
    const subsetor = await this.carregarSubsetor(setor._id, subsetorId);
    if (!subsetor.ativo) {
      subsetor.ativo = true;
      await subsetor.save();
      await this.sincronizarMinimoDerivado(setor);
    }
    return this.paraRespostaPorId(setor);
  }

  private async definirAtivo(id: string, ativo: boolean): Promise<SetorResponseDto> {
    const setor = await this.carregar(id);
    if (setor.ativo !== ativo) {
      setor.ativo = ativo;
      await setor.save();
    }
    return this.paraRespostaPorId(setor);
  }

  /** Setor sem subsetores exige o mínimo de técnicos; setor com subsetores não admite mínimo próprio de técnicos. */
  private validarQuantitativoDoSetor(tecnicos: number | undefined, possuiSubsetores: boolean): void {
    if (possuiSubsetores && tecnicos !== undefined) {
      throw new BadRequestException(
        'Setor com subsetores não possui mínimo próprio de técnicos: informe o mínimo de técnicos em cada subsetor.',
      );
    }
    if (!possuiSubsetores && tecnicos === undefined) {
      throw new BadRequestException('Informe o mínimo de técnicos do setor (setor sem subsetores).');
    }
  }

  private exigirNomesDistintos(nomes: string[]): void {
    const vistos = new Set(nomes.map((nome) => semAcentos(nome).toLowerCase()));
    if (vistos.size !== nomes.length) throw new ConflictException('Há subsetores com o mesmo nome no setor.');
  }

  private somarTecnicos(subsetores: { plantao24h: { tecnicos: number }; ativo?: boolean }[]): number {
    return subsetores.filter((subsetor) => subsetor.ativo !== false).reduce((soma, subsetor) => soma + subsetor.plantao24h.tecnicos, 0);
  }

  /** Recalcula `plantao24h.tecnicos` (soma dos subsetores ativos) para o módulo de escalas; só em setor com subsetores. */
  private async sincronizarMinimoDerivado(setor: SetorDocument): Promise<void> {
    if (setor.possuiSubsetores) {
      const ativos = await this.subsetorModel.find({ setorId: setor._id, ativo: true }).lean().exec();
      setor.plantao24h.tecnicos = this.somarTecnicos(ativos);
    }
    await setor.save();
  }

  private async carregar(id: string): Promise<SetorDocument> {
    const setor = await this.setorModel.findById(id).exec();
    if (!setor) throw new NotFoundException('Setor não encontrado.');
    return setor;
  }

  /** O subsetor precisa pertencer ao setor da rota (nunca é possível operar subsetor de outro setor). */
  private async carregarSubsetor(setorId: Types.ObjectId, subsetorId: string): Promise<SubsetorDocument> {
    const subsetor = await this.subsetorModel.findOne({ _id: subsetorId, setorId }).exec();
    if (!subsetor) throw new NotFoundException('Subsetor não encontrado neste setor.');
    return subsetor;
  }

  /** Nome duplicado (ignora maiúsculas/acentos), desconsiderando o próprio setor na edição. */
  private async garantirNomeLivre(nome: string, proprio?: SetorDocument): Promise<void> {
    const existente = await this.setorModel.findOne({ nome }).collation(COLLATION_PT).exec();
    if (existente && !existente._id.equals(proprio?._id)) {
      throw new ConflictException('Já existe um setor com este nome.');
    }
  }

  private async garantirNomeDeSubsetorLivre(setorId: Types.ObjectId, nome: string, proprio?: SubsetorDocument): Promise<void> {
    const existente = await this.subsetorModel.findOne({ setorId, nome }).collation(COLLATION_PT).exec();
    if (existente && !existente._id.equals(proprio?._id)) {
      throw new ConflictException('Já existe um subsetor com este nome neste setor.');
    }
  }

  /** Técnicos ligados ao setor sem subsetor, por setor — só conta em setores com subsetores (pendências de adequação). */
  private async contarTecnicosSemSubsetor(setores: SetorDocument[]): Promise<Map<string, number>> {
    const ids = setores.filter((setor) => setor.possuiSubsetores).map((setor) => setor._id);
    if (ids.length === 0) return new Map();
    const grupos = await this.profissionalModel
      .aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { setorId: { $in: ids }, formacao: Formacao.TECNICO, subsetorId: null } },
        { $group: { _id: '$setorId', total: { $sum: 1 } } },
      ])
      .exec();
    return new Map(grupos.map((grupo) => [String(grupo._id), grupo.total]));
  }

  private async paraRespostaPorId(setor: SetorDocument): Promise<SetorResponseDto> {
    const [subsetores, semSubsetor] = await Promise.all([
      this.subsetorModel.find({ setorId: setor._id }).sort({ nome: 1 }).collation(COLLATION_PT).exec(),
      this.contarTecnicosSemSubsetor([setor]),
    ]);
    return this.paraResposta(setor, subsetores, semSubsetor.get(String(setor._id)) ?? 0);
  }

  private paraResposta(setor: SetorDocument, subsetores: SubsetorDocument[], tecnicosSemSubsetor: number): SetorResponseDto {
    return {
      id: setor._id.toString(),
      nome: setor.nome,
      descricao: setor.descricao,
      ativo: setor.ativo,
      possuiSubsetores: setor.possuiSubsetores,
      plantao24h: {
        enfermeiros: setor.plantao24h.enfermeiros,
        // Em setor com subsetores o valor armazenado é derivado (uso do módulo de escalas): não é exposto como mínimo do setor.
        tecnicos: setor.possuiSubsetores ? null : setor.plantao24h.tecnicos,
      },
      subsetores: subsetores.map((subsetor) => this.subsetorParaResposta(subsetor)),
      tecnicosSemSubsetor,
      createdAt: setor.createdAt,
      updatedAt: setor.updatedAt,
    };
  }

  private subsetorParaResposta(subsetor: SubsetorDocument): SubsetorResponseDto {
    return {
      id: subsetor._id.toString(),
      setorId: subsetor.setorId.toString(),
      nome: subsetor.nome,
      descricao: subsetor.descricao,
      ativo: subsetor.ativo,
      plantao24h: { tecnicos: subsetor.plantao24h.tecnicos },
      createdAt: subsetor.createdAt,
      updatedAt: subsetor.updatedAt,
    };
  }
}
