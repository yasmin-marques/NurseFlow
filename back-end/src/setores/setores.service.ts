import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { QueryFilter, Model } from 'mongoose';
import { COLLATION_PT, regexSemAcentos } from '../common/utils/text';
import type { CreateSetorDto, ListSetoresQueryDto, SetorResponseDto, UpdateSetorDto } from './dto/setor.dto';
import { Setor, type SetorDocument } from './schemas/setor.schema';

const TURNOS = ['diurno', 'noturno'] as const;
const FUNCOES = ['enfermeiros', 'tecnicos'] as const;

@Injectable()
export class SetoresService {
  constructor(@InjectModel(Setor.name) private readonly setorModel: Model<Setor>) {}

  /** DA07: cadastro com quantitativo mínimo inicial por turno. */
  async criar(dto: CreateSetorDto): Promise<SetorResponseDto> {
    await this.garantirNomeLivre(dto.nome);
    const setor = await this.setorModel.create({
      nome: dto.nome,
      descricao: dto.descricao,
      turnos: dto.turnos,
      ativo: true,
    });
    return this.paraResposta(setor);
  }

  async listar(query: ListSetoresQueryDto): Promise<SetorResponseDto[]> {
    const filtro: QueryFilter<Setor> = {};
    if (query.ativo !== undefined) filtro.ativo = query.ativo;
    if (query.busca) filtro.nome = { $regex: regexSemAcentos(query.busca), $options: 'i' };

    const setores = await this.setorModel.find(filtro).sort({ nome: 1 }).collation(COLLATION_PT).exec();
    return setores.map((setor) => this.paraResposta(setor));
  }

  async obter(id: string): Promise<SetorResponseDto> {
    return this.paraResposta(await this.carregar(id));
  }

  /** DA07/DA08: edita dados do setor e/ou o quantitativo mínimo de um ou mais turnos/funções. */
  async atualizar(id: string, dto: UpdateSetorDto): Promise<SetorResponseDto> {
    const setor = await this.carregar(id);
    if (dto.nome !== undefined) await this.garantirNomeLivre(dto.nome, setor);

    if (dto.nome !== undefined) setor.nome = dto.nome;
    if (dto.descricao !== undefined) setor.descricao = dto.descricao;
    for (const turno of TURNOS) {
      for (const funcao of FUNCOES) {
        const valor = dto.turnos?.[turno]?.[funcao];
        if (valor !== undefined) setor.turnos[turno][funcao] = valor;
      }
    }
    await setor.save();
    return this.paraResposta(setor);
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

  private async definirAtivo(id: string, ativo: boolean): Promise<SetorResponseDto> {
    const setor = await this.carregar(id);
    if (setor.ativo !== ativo) {
      setor.ativo = ativo;
      await setor.save();
    }
    return this.paraResposta(setor);
  }

  private async carregar(id: string): Promise<SetorDocument> {
    const setor = await this.setorModel.findById(id).exec();
    if (!setor) throw new NotFoundException('Setor não encontrado.');
    return setor;
  }

  /** Nome duplicado (ignora maiúsculas/acentos), desconsiderando o próprio setor na edição. */
  private async garantirNomeLivre(nome: string, proprio?: SetorDocument): Promise<void> {
    const existente = await this.setorModel.findOne({ nome }).collation(COLLATION_PT).exec();
    if (existente && !existente._id.equals(proprio?._id)) {
      throw new ConflictException('Já existe um setor com este nome.');
    }
  }

  private paraResposta(setor: SetorDocument): SetorResponseDto {
    const { diurno, noturno } = setor.turnos;
    return {
      id: setor._id.toString(),
      nome: setor.nome,
      descricao: setor.descricao,
      ativo: setor.ativo,
      turnos: {
        diurno: { enfermeiros: diurno.enfermeiros, tecnicos: diurno.tecnicos },
        noturno: { enfermeiros: noturno.enfermeiros, tecnicos: noturno.tecnicos },
      },
      createdAt: setor.createdAt,
      updatedAt: setor.updatedAt,
    };
  }
}
