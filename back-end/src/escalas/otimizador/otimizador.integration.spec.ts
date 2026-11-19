import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import type { AppConfig } from '../../config/configuration';
import { OtimizadorHttp, type ProblemaOtimizacao } from './otimizador';

describe('integração HTTP NestJS → otimizador', () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        versao_contrato: 1,
        capacidades: [],
        alocacoes: [],
        descobertos: [],
        estatisticas: {},
      }));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('bloqueia resposta de solver antigo antes de qualquer persistência', async () => {
    const config = {
      get: () => ({ url, timeoutMs: 1000 }),
    } as unknown as ConfigService<AppConfig, true>;
    const otimizador = new OtimizadorHttp(config);
    const problema = {
      versao_contrato: 2,
      capacidades: ['alocacoes_fixas'],
      ano: 2031,
      mes: 1,
      dias_mes: 31,
      profissionais: [],
      setores: [],
      parametros: { tempo_limite_segundos: 1 },
      alocacoes_fixas: [],
    } as ProblemaOtimizacao;

    await expect(otimizador.resolver(problema)).rejects.toBeInstanceOf(BadGatewayException);
    await expect(otimizador.resolver(problema)).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'O otimizador usa uma versão de contrato incompatível.' }),
    });
  });
});
