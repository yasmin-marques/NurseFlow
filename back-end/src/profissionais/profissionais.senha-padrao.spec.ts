import { InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ProfissionaisService } from './profissionais.service';

function servico(senhaPadrao: string | null) {
  const config = { get: () => ({ senhaPadrao }) };
  return new ProfissionaisService(null as never, null as never, null as never, null as never, null as never, config as never) as unknown as {
    hashSenhaPadrao(): Promise<string>;
  };
}

describe('senha padrão de profissionais', () => {
  it('gera o hash bcrypt da senha configurada', async () => {
    const hash = await servico('senha-padrao-123').hashSenhaPadrao();
    expect(hash).not.toContain('senha-padrao-123');
    expect(await bcrypt.compare('senha-padrao-123', hash)).toBe(true);
  });

  it('falha com erro apropriado (sem vazar detalhes) quando não configurada', async () => {
    await expect(servico(null).hashSenhaPadrao()).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
