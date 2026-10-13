import { BadRequestException, Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { TipoVinculo } from '../profissionais/profissionais.enums';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { AtualizarLimitesDto, DefinirCargaDto, PeriodoDto } from './configuracoes.dto';
import { ConfiguracoesService } from './configuracoes.service';

@ApiTags('Configurações') @ApiBearerAuth() @Perfis(Perfil.COORDENACAO)
@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracoesService) {}
  @Get() consultar(@Query() p: PeriodoDto) { return this.service.consultar(p.ano, p.mes); }
  @Patch('limites') limites(@Query() p: PeriodoDto, @Body() dto: AtualizarLimitesDto) {
    return this.service.limites(p.ano, p.mes, dto);
  }
  @Put('cargas') carga(@Query() p: PeriodoDto, @Body() dto: DefinirCargaDto) {
    return this.service.carga(p.ano, p.mes, dto);
  }
  @Get('cargas/:vinculo') cargaEsperada(@Query() p: PeriodoDto, @Param('vinculo') vinculo: string) {
    if (!Object.values(TipoVinculo).includes(vinculo as TipoVinculo)) {
      throw new BadRequestException('Vínculo inválido');
    }
    return this.service.cargaEsperada(p.ano, p.mes, vinculo as TipoVinculo);
  }
}
