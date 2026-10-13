import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../common/decorators';
import { Perfil } from '../common/enums/perfil.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CriarRestricaoDto } from './restricoes.dto';
import { RestricoesService } from './restricoes.service';
@ApiTags('Restrições') @ApiBearerAuth() @Perfis(Perfil.COORDENACAO)
@Controller('profissionais/:profissionalId/restricoes')
export class RestricoesController {
  constructor(private readonly service: RestricoesService) {}
  @Post() criar(@Param('profissionalId', ParseObjectIdPipe) id: string, @Body() dto: CriarRestricaoDto) { return this.service.criar(id, dto); }
  @Get() listar(@Param('profissionalId', ParseObjectIdPipe) id: string) { return this.service.listar(id); }
  @Get('conflitos') conflitos(@Param('profissionalId', ParseObjectIdPipe) id: string, @Query('inicio') inicio: string, @Query('fim') fim: string) {
    return this.service.conflitos(id, inicio, fim);
  }
  @Delete(':restricaoId') excluir(@Param('profissionalId', ParseObjectIdPipe) id: string, @Param('restricaoId', ParseObjectIdPipe) restricaoId: string) {
    return this.service.excluir(id, restricaoId);
  }
}
