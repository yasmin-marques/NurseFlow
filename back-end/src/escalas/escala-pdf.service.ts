import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import { EscalaSnapshotService } from './escala-snapshot.service';
import { isVisualizacaoEscalaPdf, type DadosEscalaPdf } from './escala-pdf.types';
import { Escala, VersaoEscala } from './schemas';

interface SetorPdf {
  id: string;
  nome: string;
}

@Injectable()
export class EscalaPdfService {
  constructor(
    @InjectModel(Escala.name) private readonly escalas: Model<Escala>,
    @InjectModel(VersaoEscala.name) private readonly versoes: Model<VersaoEscala>,
    private readonly snapshots: EscalaSnapshotService,
  ) {}

  async obterDados(escalaId: string): Promise<DadosEscalaPdf> {
    const escala = await this.escalas.findById(escalaId).lean().exec();
    if (!escala) throw new NotFoundException('Escala não encontrada.');
    const versao = await this.versoes.findOne({ escalaId: escala._id }).sort({ numero: -1 }).lean().exec();
    if (!versao) throw new NotFoundException('A escala ainda não possui uma versão oficial publicada.');
    const snapshot = await this.snapshots.snapshotComVisualizacao(escala, versao.snapshot);
    const visualizacao = snapshot.visualizacao;
    if (!isVisualizacaoEscalaPdf(visualizacao)) {
      throw new ConflictException('A versão oficial não contém dados suficientes para exportação.');
    }
    return {
      ...visualizacao,
      numero: versao.numero,
      publicadoEm: new Date(versao.publicadoEm),
    };
  }

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
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, compress: false, info: { Author: 'NurseFlow', Subject: 'Calendário mensal de escala' } });
    const partes: Buffer[] = [];
    const buffer = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (parte: Buffer) => partes.push(parte));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
    });
    const setores = this.setores(dados).filter((setor) => !setorId || setor.id === setorId);
    const primeiroDia = new Date(Date.UTC(dados.escala.ano, dados.escala.mes - 1, 1)).getUTCDay();
    const totalDias = new Date(Date.UTC(dados.escala.ano, dados.escala.mes, 0)).getUTCDate();
    const linhas = Math.ceil((primeiroDia + totalDias) / 7);
    const larguraCalendario = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const larguraCelula = larguraCalendario / 7;
    const alturaCelula = 59;

    setores.forEach((setor, setorIndex) => {
      if (setorIndex > 0) doc.addPage();
      const plantoes = dados.plantoes.filter((plantao) => plantao.setor.id === setor.id);
      doc.font('Helvetica-Bold').fontSize(17).fillColor('#000000')
        .text(`ESCALA ${String(dados.escala.mes).padStart(2, '0')}/${dados.escala.ano}`, doc.page.margins.left, 27, { width: larguraCalendario, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#222222')
        .text(setor.nome, doc.page.margins.left, 49, { width: larguraCalendario, align: 'center' });

      const calendarioTop = 70;
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#333333');
      ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].forEach((dia, index) => {
        doc.text(dia, doc.page.margins.left + index * larguraCelula + 3, calendarioTop, { width: larguraCelula - 6, align: 'left' });
      });
      for (let slot = 0; slot < linhas * 7; slot++) {
        const dia = slot - primeiroDia + 1;
        const coluna = slot % 7;
        const linha = Math.floor(slot / 7);
        const x = doc.page.margins.left + coluna * larguraCelula;
        const y = calendarioTop + 14 + linha * alturaCelula;
        doc.rect(x, y, larguraCelula, alturaCelula).lineWidth(0.4).strokeColor('#b8c2b5').stroke();
        if (dia < 1 || dia > totalDias) continue;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#175b32').text(String(dia), x + 3, y + 3);
        const data = `${dados.escala.ano}-${String(dados.escala.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const doDia = plantoes.filter((plantao) => plantao.data === data).sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));
        const linhasEquipe = doDia.map((plantao) => `${plantao.horarioInicio}–${plantao.horarioFim}\n${plantao.profissionais.map((profissional) => profissional.nome).join(', ') || 'Sem equipe'}`).join('\n');
        doc.font('Helvetica').fontSize(5.5).fillColor('#222222')
          .text(linhasEquipe || 'Sem plantão', x + 3, y + 14, { width: larguraCelula - 6, height: alturaCelula - 16, ellipsis: true });
      }

      const esquerda = doc.page.margins.left;
      const larguraAssinatura = (larguraCalendario - 50) / 2;
      const yAssinatura = calendarioTop + 14 + linhas * alturaCelula + 22;
      doc.moveTo(esquerda, yAssinatura).lineTo(esquerda + larguraAssinatura, yAssinatura).lineWidth(0.7).strokeColor('#000000').stroke();
      doc.moveTo(esquerda + larguraAssinatura + 50, yAssinatura).lineTo(esquerda + larguraCalendario, yAssinatura).stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#000000');
      doc.text('Coordenação', esquerda, yAssinatura + 6, { width: larguraAssinatura, align: 'center' });
      doc.text('Diretoria', esquerda + larguraAssinatura + 50, yAssinatura + 6, { width: larguraAssinatura, align: 'center' });
    });

    doc.end();
    return buffer;
  }

  private nomeArquivo(nome: string): string {
    const seguro = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return seguro || 'setor';
  }
}
