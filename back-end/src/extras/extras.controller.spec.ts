import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ExtrasController } from './extras.controller';
import { ExtrasService } from './extras.service';
import { ExtraOpcao, ExtraProgramadoSituacao } from './extras.schema';
import { Perfil } from '../common/enums/perfil.enum';
import type { UsuarioAutenticado } from '../common/auth/usuario-autenticado';
import { CriarExtraHttpDto, AtualizarExtraHttpDto, CancelarExtraHttpDto, ListarExtrasDto, ResumoExtrasDto } from './dto';

describe('ExtrasController', () => {
  let controller: ExtrasController;
  let service: jest.Mocked<ExtrasService>;

  const usuarioCoord: UsuarioAutenticado = {
    id: '64b7f0f0f0f0f0f0f0f0f001',
    nome: 'Coordenação Teste',
    email: 'coord@nurseflow.com',
    perfil: Perfil.COORDENACAO,
  };

  beforeEach(async () => {
    const mockService = {
      listar: jest.fn(),
      resumo: jest.fn(),
      detalhe: jest.fn(),
      criar: jest.fn(),
      editar: jest.fn(),
      cancelar: jest.fn(),
      conciliar: jest.fn(),
      desconciliar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExtrasController],
      providers: [
        {
          provide: ExtrasService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ExtrasController>(ExtrasController);
    service = module.get(ExtrasService);
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('listar', () => {
    it('deve delegar a busca para o service com os parâmetros recebidos', async () => {
      const query: ListarExtrasDto = {
        ano: 2027,
        mes: 3,
        pagina: 1,
        limite: 10,
      };
      const resultadoMock = {
        itens: [],
        total: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      };
      service.listar.mockResolvedValue(resultadoMock as never);

      const resultado = await controller.listar(query);

      expect(service.listar).toHaveBeenCalledWith(query);
      expect(resultado).toBe(resultadoMock);
    });
  });

  describe('resumo', () => {
    it('deve delegar para o service passando ano e mês', async () => {
      const query: ResumoExtrasDto = { ano: 2027, mes: 3 };
      const resumoMock = {
        ano: 2027,
        mes: 3,
        totalExtrasAtivos: 2,
        totalHoras: 24,
        totalRpaAtivos: 1,
      };
      service.resumo.mockResolvedValue(resumoMock);

      const resultado = await controller.resumo(query);

      expect(service.resumo).toHaveBeenCalledWith(2027, 3);
      expect(resultado).toBe(resumoMock);
    });
  });

  describe('detalhe', () => {
    it('deve delegar para o service passando o id do extra', async () => {
      const id = '64b7f0f0f0f0f0f0f0f0f010';
      const detalheMock = { id, data: '2027-03-20', historico: [] };
      service.detalhe.mockResolvedValue(detalheMock as never);

      const resultado = await controller.detalhe(id);

      expect(service.detalhe).toHaveBeenCalledWith(id);
      expect(resultado).toBe(detalheMock);
    });
  });

  describe('criar', () => {
    it('deve associar criadoPor a partir do usuário autenticado e delegar com validação ativa', async () => {
      const dto: CriarExtraHttpDto = {
        data: '2027-03-25',
        opcao: ExtraOpcao.DOZE_DIA,
        setorId: '64b7f0f0f0f0f0f0f0f0f020',
        funcao: 'enfermeiro',
        substitutoId: '64b7f0f0f0f0f0f0f0f0f030',
        motivo: 'reforco',
        observacao: 'Observação teste',
      };
      const criadoMock = { _id: '64b7f0f0f0f0f0f0f0f0f040', ...dto, revisao: 1 };
      service.criar.mockResolvedValue(criadoMock as never);

      const resultado = await controller.criar(dto, usuarioCoord);

      expect(service.criar).toHaveBeenCalledWith(
        {
          ...dto,
          criadoPor: usuarioCoord.id,
        },
        { validar: true },
      );
      expect(resultado).toBe(criadoMock);
    });
  });

  describe('atualizar', () => {
    it('deve associar atualizadoPor a partir do usuário autenticado e delegar com validação ativa', async () => {
      const id = '64b7f0f0f0f0f0f0f0f0f040';
      const dto: AtualizarExtraHttpDto = {
        revisaoEsperada: 1,
        observacao: 'Atualizado',
      };
      const atualizadoMock = { _id: id, revisao: 2 };
      service.editar.mockResolvedValue(atualizadoMock as never);

      const resultado = await controller.atualizar(id, dto, usuarioCoord);

      expect(service.editar).toHaveBeenCalledWith(
        id,
        {
          ...dto,
          atualizadoPor: usuarioCoord.id,
        },
        { validar: true },
      );
      expect(resultado).toBe(atualizadoMock);
    });
  });

  describe('cancelar', () => {
    it('deve associar canceladoPor a partir do usuário autenticado e delegar para o service', async () => {
      const id = '64b7f0f0f0f0f0f0f0f0f040';
      const dto: CancelarExtraHttpDto = {
        revisaoEsperada: 1,
        justificativa: 'Substituto adoeceu',
      };
      const canceladoMock = { _id: id, situacao: ExtraProgramadoSituacao.CANCELADO, revisao: 2 };
      service.cancelar.mockResolvedValue(canceladoMock as never);

      const resultado = await controller.cancelar(id, dto, usuarioCoord);

      expect(service.cancelar).toHaveBeenCalledWith(id, {
        ...dto,
        canceladoPor: usuarioCoord.id,
      });
      expect(resultado).toBe(canceladoMock);
    });
  });

  describe('conciliar', () => {
    it('deve delegar a conciliação passando o id do extra, o dto e o usuarioId autenticado', async () => {
      const id = '64b7f0f0f0f0f0f0f0f0f040';
      const dto = { escalaId: '64b7f0f0f0f0f0f0f0f0f050' };
      const conciliadoMock = { _id: id, escalaId: dto.escalaId, revisao: 2 };
      service.conciliar.mockResolvedValue(conciliadoMock as never);

      const resultado = await controller.conciliar(id, dto, usuarioCoord);

      expect(service.conciliar).toHaveBeenCalledWith(id, dto, usuarioCoord.id);
      expect(resultado).toBe(conciliadoMock);
    });
  });

  describe('desconciliar', () => {
    it('deve delegar a desconciliação passando o id do extra e o usuarioId autenticado', async () => {
      const id = '64b7f0f0f0f0f0f0f0f0f040';
      const desconciliadoMock = { _id: id, escalaId: null, plantaoProfissionalId: null, revisao: 3 };
      service.desconciliar.mockResolvedValue(desconciliadoMock as never);

      const resultado = await controller.desconciliar(id, usuarioCoord);

      expect(service.desconciliar).toHaveBeenCalledWith(id, usuarioCoord.id);
      expect(resultado).toBe(desconciliadoMock);
    });
  });
});
