import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import type { DadosEscalaPdf } from './escala-pdf.types';

interface SetorPdf {
  id: string;
  nome: string;
}

@Injectable()
export class EscalaPdfService {
  async geral(dados: DadosEscalaPdf): Promise<Buffer> {
    return this.gerarPdf(dados);
  }

  async porSetor(dados: DadosEscalaPdf, setorId: string): Promise<{ buffer: Buffer; nomeSetor: string; nomeArquivo: string }> {
    const setor = this.setores(dados).find((item) => item.id === setorId);
    if (!setor) throw new NotFoundException('O setor não possui conteúdo nesta versão publicada.');
    return {
      buffer: await this.gerarPdf(dados, setor.id),
      nomeSetor: setor.nome,
      nomeArquivo: this.nomeArquivo(setor.nome),
    };
  }

  async porTodosSetores(dados: DadosEscalaPdf): Promise<Buffer> {
    const setores = this.setores(dados);
    if (setores.length === 0) {
      throw new UnprocessableEntityException('A escala publicada não contém setores para exportação.');
    }

    const arquivo = new ZipArchive({ zlib: { level: 9 } });
    const fluxo = new PassThrough();
    const partes: Buffer[] = [];
    const finalizado = new Promise<Buffer>((resolve, reject) => {
      fluxo.on('data', (parte: Buffer) => partes.push(parte));
      fluxo.on('end', () => resolve(Buffer.concat(partes)));
      fluxo.on('error', reject);
      arquivo.on('error', reject);
      arquivo.on('warning', reject);
    });
    arquivo.pipe(fluxo);
    for (const setor of setores) {
      arquivo.append(await this.gerarPdf(dados, setor.id), {
        name: `escala-${dados.escala.ano}-${String(dados.escala.mes).padStart(2, '0')}-${this.nomeArquivo(setor.nome)}.pdf`,
      });
    }
    void arquivo.finalize().catch((erro: Error) => fluxo.destroy(erro));
    return finalizado;
  }

  private setores(dados: DadosEscalaPdf): SetorPdf[] {
    const setores = new Map<string, SetorPdf>();
    for (const plantao of dados.plantoes) {
      setores.set(plantao.setor.id, plantao.setor);
    }
    for (const pendencia of dados.pendencias) {
      setores.set(pendencia.setorId, { id: pendencia.setorId, nome: pendencia.setor });
    }
    return [...setores.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private async gerarPdf(dados: DadosEscalaPdf, setorId?: string): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 42, compress: false, info: { Author: 'NurseFlow', Subject: 'Escala oficial' } });
    const partes: Buffer[] = [];
    const buffer = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (parte: Buffer) => partes.push(parte));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
    });
    const setor = setorId ? this.setores(dados).find((item) => item.id === setorId) : undefined;
    const plantoes = dados.plantoes.filter((item) => !setorId || item.setor.id === setorId);
    const pendencias = dados.pendencias.filter((item) => !setorId || item.setorId === setorId);
    const conflitos = dados.conflitos.filter((item) => !setorId || !item.setorId || item.setorId === setorId);
    const avisos = dados.avisos.filter((item) => !setorId || !item.setorId || item.setorId === setorId);

    const escreverCabecalho = () => {
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text('ESCALA MENSAL');
      doc.font('Helvetica-Bold').fontSize(13).text(`${String(dados.escala.mes).padStart(2, '0')}/${dados.escala.ano}`);
      if (setor) doc.font('Helvetica-Bold').fontSize(11).text(`Setor: ${setor.nome}`);
      doc.font('Helvetica').fontSize(9).fillColor('#222222');
      doc.text(`Versão oficial ${dados.numero} · Publicada em ${this.dataHora(dados.publicadoEm)}`);
      const cobertura = dados.cobertura;
      const rotuloCobertura = cobertura?.percentual == null
        ? 'Indisponível (sem quantitativos exigidos)'
        : `${cobertura.percentual}% (${cobertura.posicoesPreenchidas} de ${cobertura.posicoesExigidas} posições)`;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(`Cobertura geral: ${rotuloCobertura}`);
      doc.moveDown(0.8);
    };
    const novaPagina = () => {
      doc.addPage();
      escreverCabecalho();
    };
    const garantirEspaco = (altura: number) => {
      if (doc.y + altura > doc.page.height - doc.page.margins.bottom) novaPagina();
    };

    escreverCabecalho();
    if (pendencias.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('PENDÊNCIAS DE COBERTURA');
      doc.font('Helvetica').fontSize(9);
      for (const pendencia of pendencias) {
        garantirEspaco(30);
        doc.text(
          `${pendencia.setor} · ${this.data(pendencia.data)} · ${pendencia.turno} · ${pendencia.funcao}: necessário ${pendencia.necessario}, alocado ${pendencia.alocado}, faltam ${pendencia.faltam}.`,
          { width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
        );
      }
      doc.moveDown(0.8);
    } else {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Cobertura sem vagas descobertas.');
      doc.moveDown(0.8);
    }

    if (conflitos.length > 0 || avisos.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('ALERTAS REGISTRADOS');
      doc.font('Helvetica').fontSize(9);
      for (const alerta of [...conflitos, ...avisos]) {
        garantirEspaco(28);
        doc.text(`${alerta.tipo}: ${alerta.motivo}`);
      }
      doc.moveDown(0.8);
    }

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('PLANTÕES');
    const ordenados = [...plantoes].sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
    if (ordenados.length === 0) {
      doc.font('Helvetica').fontSize(9).text('Nenhum plantão alocado para este documento.');
    }
    for (const plantao of ordenados) {
      garantirEspaco(42);
      doc.moveDown(0.35);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(
        `${this.data(plantao.data)} · ${plantao.setor.nome} · ${plantao.horarioInicio}–${plantao.horarioFim} · ${plantao.tipo === 'extra' ? 'PLANTÃO EXTRA' : 'Plantão regular'}`,
      );
      doc.font('Helvetica').fontSize(9).text(
        plantao.profissionais.map((profissional) => `${profissional.nome} (${profissional.formacao})`).join(', ') || 'Sem profissionais alocados',
      );
      doc.moveTo(doc.page.margins.left, doc.y + 4)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
        .lineWidth(0.35)
        .strokeColor('#777777')
        .stroke();
      doc.moveDown(0.5);
    }

    garantirEspaco(90);
    doc.moveDown(1.5);
    const esquerda = doc.page.margins.left;
    const largura = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 36) / 2;
    const yAssinatura = doc.y + 24;
    doc.moveTo(esquerda, yAssinatura).lineTo(esquerda + largura, yAssinatura).lineWidth(0.7).strokeColor('#000000').stroke();
    doc.moveTo(esquerda + largura + 36, yAssinatura).lineTo(esquerda + 2 * largura + 36, yAssinatura).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text('Coordenação', esquerda, yAssinatura + 6, { width: largura, align: 'center' });
    doc.text('Diretoria', esquerda + largura + 36, yAssinatura + 6, { width: largura, align: 'center' });

    doc.end();
    return buffer;
  }

  private data(data: string): string {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private dataHora(data: Date): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
  }

  private nomeArquivo(nome: string): string {
    const seguro = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return seguro || 'setor';
  }
}
