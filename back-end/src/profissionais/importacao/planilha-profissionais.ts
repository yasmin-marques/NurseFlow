import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { semAcentos } from '../../common/utils/text';
import { Formacao, StatusProfissional, TipoVinculo } from '../profissionais.enums';

export const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024;
/** Limite de linhas por importação: a validação roda numa transação única e o cadastro gera hash de senha por linha. */
export const LINHAS_MAXIMAS = 200;
export const NOME_ABA = 'Profissionais';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ChaveColuna = 'nome' | 'cpf' | 'coren' | 'email' | 'formacao' | 'tipoVinculo' | 'setor' | 'subsetor' | 'status';

export interface ColunaPlanilha {
  chave: ChaveColuna;
  /** Rótulo exibido no modelo e nas mensagens de erro. */
  rotulo: string;
  obrigatoria: boolean;
  /** Cabeçalhos aceitos na leitura, já normalizados (sem acento, minúsculos, sem "*"). Inclui os da exportação. */
  apelidos: string[];
  largura: number;
  ajuda: string;
}

export const COLUNAS: ColunaPlanilha[] = [
  {
    chave: 'nome',
    rotulo: 'Nome completo',
    obrigatoria: true,
    apelidos: ['nome completo', 'nome'],
    largura: 32,
    ajuda: 'Obrigatório no cadastro. De 3 a 120 caracteres. Não é alterado em profissionais já cadastrados.',
  },
  {
    chave: 'cpf',
    rotulo: 'CPF',
    obrigatoria: true,
    apelidos: ['cpf'],
    largura: 18,
    ajuda: 'Obrigatório. Identifica o profissional: se já existir, ele é atualizado; senão, é cadastrado. Aceita com ou sem pontuação.',
  },
  {
    chave: 'coren',
    rotulo: 'COREN',
    obrigatoria: true,
    apelidos: ['coren'],
    largura: 20,
    ajuda: 'Obrigatório no cadastro. De 3 a 30 caracteres, único. Não é alterado em profissionais já cadastrados.',
  },
  {
    chave: 'email',
    rotulo: 'E-mail',
    obrigatoria: true,
    apelidos: ['e-mail', 'email'],
    largura: 30,
    ajuda: 'Obrigatório no cadastro. E-mail de acesso, único no sistema.',
  },
  {
    chave: 'formacao',
    rotulo: 'Formação',
    obrigatoria: true,
    apelidos: ['formacao'],
    largura: 24,
    ajuda: 'Obrigatório no cadastro. Enfermeiro ou Técnico de enfermagem.',
  },
  {
    chave: 'tipoVinculo',
    rotulo: 'Tipo de vínculo',
    obrigatoria: true,
    apelidos: ['tipo de vinculo', 'vinculo'],
    largura: 18,
    ajuda: 'Obrigatório no cadastro. Concursado, CLT ou RPA.',
  },
  {
    chave: 'setor',
    rotulo: 'Setor',
    obrigatoria: true,
    apelidos: ['setor'],
    largura: 24,
    ajuda: 'Obrigatório no cadastro. Nome de um setor ativo (veja a aba "Listas").',
  },
  {
    chave: 'subsetor',
    rotulo: 'Subsetor',
    obrigatoria: false,
    apelidos: ['subsetor'],
    largura: 24,
    ajuda: 'Opcional, somente para técnicos de setores com subsetores. Escolha na lista: só aparecem os subsetores do setor selecionado. Enfermeiros nunca têm subsetor.',
  },
  {
    chave: 'status',
    rotulo: 'Situação',
    obrigatoria: false,
    apelidos: ['situacao', 'status'],
    largura: 16,
    ajuda: 'Opcional. Ativo, Desativado, Afastado ou Férias. Em branco: novos ficam Ativos e os existentes não mudam.',
  },
];

export const ROTULO: Record<ChaveColuna, string> = Object.fromEntries(COLUNAS.map((c) => [c.chave, c.rotulo])) as Record<ChaveColuna, string>;

export const FORMACAO_ROTULO: Record<Formacao, string> = {
  [Formacao.ENFERMEIRO]: 'Enfermeiro',
  [Formacao.TECNICO]: 'Técnico de enfermagem',
};
export const VINCULO_ROTULO: Record<TipoVinculo, string> = {
  [TipoVinculo.CONCURSADO]: 'Concursado',
  [TipoVinculo.CLT]: 'CLT',
  [TipoVinculo.RPA]: 'RPA',
};
export const STATUS_ROTULO: Record<StatusProfissional, string> = {
  [StatusProfissional.ATIVO]: 'Ativo',
  [StatusProfissional.DESATIVADO]: 'Desativado',
  [StatusProfissional.AFASTADO]: 'Afastado',
  [StatusProfissional.FERIAS]: 'Férias',
};

export const normalizarChave = (texto: string): string => semAcentos(texto).toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();

function mapaDeRotulos<T extends string>(rotulos: Record<T, string>, extras: Record<string, T> = {}): Map<string, T> {
  const mapa = new Map<string, T>(Object.entries(extras) as [string, T][]);
  for (const [valor, rotulo] of Object.entries(rotulos) as [T, string][]) {
    mapa.set(normalizarChave(rotulo), valor);
    mapa.set(normalizarChave(valor), valor);
  }
  return mapa;
}
const FORMACOES = mapaDeRotulos(FORMACAO_ROTULO, { 'tecnico de enfermagem': Formacao.TECNICO });
const VINCULOS = mapaDeRotulos(VINCULO_ROTULO);
const SITUACOES = mapaDeRotulos(STATUS_ROTULO);

export const interpretarFormacao = (texto: string): Formacao | undefined => FORMACOES.get(normalizarChave(texto));
export const interpretarVinculo = (texto: string): TipoVinculo | undefined => VINCULOS.get(normalizarChave(texto));
export const interpretarSituacao = (texto: string): StatusProfissional | undefined => SITUACOES.get(normalizarChave(texto));

export interface LinhaPlanilha {
  /** Número da linha na planilha (1 = cabeçalho). */
  linha: number;
  valores: Record<ChaveColuna, string>;
}

type ValorCelula = ExcelJS.CellValue;

function textoDaCelula(valor: ValorCelula, preencherCpf = false): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  // O Excel guarda CPF digitado sem formatação como número e perde os zeros à esquerda.
  if (typeof valor === 'number') return preencherCpf ? String(Math.trunc(valor)).padStart(11, '0') : String(valor);
  if (typeof valor === 'boolean') return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  if ('richText' in valor) return valor.richText.map((trecho) => trecho.text).join('').trim();
  if ('result' in valor) return textoDaCelula(valor.result as ValorCelula, preencherCpf);
  if ('text' in valor) return textoDaCelula(valor.text as ValorCelula, preencherCpf);
  return '';
}

/** Valida tipo, tamanho e conteúdo básico do arquivo antes de tentar interpretá-lo. */
export function validarArquivo(arquivo: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer } | undefined): Buffer {
  if (!arquivo?.buffer) throw new BadRequestException('Envie a planilha no campo "arquivo".');
  if (!arquivo.originalname?.toLowerCase().endsWith('.xlsx')) {
    throw new UnsupportedMediaTypeException('Formato não suportado: envie um arquivo .xlsx.');
  }
  if (arquivo.buffer.length === 0) throw new BadRequestException('O arquivo está vazio.');
  if (arquivo.buffer.length > TAMANHO_MAXIMO_BYTES) {
    throw new PayloadTooLargeException(`O arquivo excede o limite de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB.`);
  }
  const mimesAceitos = [XLSX_MIME, 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'];
  if (arquivo.mimetype && !mimesAceitos.includes(arquivo.mimetype)) {
    throw new UnsupportedMediaTypeException('Formato não suportado: envie um arquivo .xlsx.');
  }
  // .xlsx é um pacote ZIP: assinatura "PK\x03\x04".
  if (arquivo.buffer.subarray(0, 4).toString('hex') !== '504b0304') {
    throw new UnsupportedMediaTypeException('O conteúdo do arquivo não é uma planilha .xlsx válida.');
  }
  return arquivo.buffer;
}

/** Lê a aba de profissionais. Linhas totalmente vazias são ignoradas; as demais mantêm o número original. */
export async function lerPlanilha(buffer: Buffer): Promise<LinhaPlanilha[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('Não foi possível ler a planilha: o arquivo está corrompido ou não é um .xlsx válido.');
  }
  const aba = workbook.worksheets.find((item) => normalizarChave(item.name) === normalizarChave(NOME_ABA)) ?? workbook.worksheets[0];
  if (!aba) throw new BadRequestException('A planilha não possui nenhuma aba.');

  // Cabeçalho: primeira linha (entre as 5 primeiras) com a coluna CPF.
  let linhaCabecalho = 0;
  const colunas = new Map<ChaveColuna, number>();
  for (let numero = 1; numero <= Math.min(5, aba.rowCount) && !linhaCabecalho; numero++) {
    const encontrados = new Map<ChaveColuna, number>();
    aba.getRow(numero).eachCell((celula, indice) => {
      const texto = normalizarChave(textoDaCelula(celula.value));
      const coluna = COLUNAS.find((item) => item.apelidos.includes(texto));
      if (coluna && !encontrados.has(coluna.chave)) encontrados.set(coluna.chave, indice);
    });
    if (encontrados.has('cpf')) {
      linhaCabecalho = numero;
      for (const [chave, indice] of encontrados) colunas.set(chave, indice);
    }
  }
  if (!linhaCabecalho) {
    throw new BadRequestException('Cabeçalho não encontrado: a planilha precisa ter a coluna "CPF". Baixe o modelo para conferir o formato.');
  }

  const linhas: LinhaPlanilha[] = [];
  for (let numero = linhaCabecalho + 1; numero <= aba.rowCount; numero++) {
    const row = aba.getRow(numero);
    const valores = {} as Record<ChaveColuna, string>;
    for (const coluna of COLUNAS) {
      const indice = colunas.get(coluna.chave);
      valores[coluna.chave] = indice ? textoDaCelula(row.getCell(indice).value, coluna.chave === 'cpf') : '';
    }
    if (Object.values(valores).every((valor) => valor === '')) continue;
    linhas.push({ linha: numero, valores });
    if (linhas.length > LINHAS_MAXIMAS) {
      throw new BadRequestException(`A planilha excede o limite de ${LINHAS_MAXIMAS} profissionais por importação. Divida o arquivo.`);
    }
  }
  if (linhas.length === 0) throw new BadRequestException('A planilha não possui nenhum profissional preenchido.');
  return linhas;
}

export interface SetorParaModelo {
  nome: string;
  subsetores: string[];
}

const VERDE = 'FF285F34';
const VERDE_CLARO = 'FF6B8F71';

/** Gera o modelo de importação: aba de dados (cabeçalho + validações), aba de instruções com exemplos e aba de listas. */
export async function gerarModelo(setores: SetorParaModelo[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NurseFlow';

  const dados = workbook.addWorksheet(NOME_ABA, { views: [{ state: 'frozen', ySplit: 1 }] });
  dados.columns = COLUNAS.map((coluna) => ({
    header: coluna.obrigatoria ? `${coluna.rotulo} *` : coluna.rotulo,
    key: coluna.chave,
    width: coluna.largura,
    // CPF e COREN como texto: preserva zeros à esquerda e a formatação digitada.
    style: coluna.chave === 'cpf' || coluna.chave === 'coren' ? { numFmt: '@' } : {},
  }));
  const cabecalho = dados.getRow(1);
  cabecalho.height = 22;
  cabecalho.eachCell((celula, indice) => {
    const coluna = COLUNAS[indice - 1];
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.alignment = { vertical: 'middle' };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: coluna.obrigatoria ? VERDE : VERDE_CLARO } };
    celula.note = coluna.ajuda;
  });

  const listas = workbook.addWorksheet('Listas');
  listas.columns = [
    { header: 'Setores ativos', key: 'setor', width: 30 },
    { header: 'Subsetores ativos', key: 'subsetor', width: 30 },
    { header: 'Setor do subsetor', key: 'pai', width: 30 },
  ];
  listas.getRow(1).font = { bold: true };
  const nomesSetores = setores.map((setor) => setor.nome);
  const subsetores = setores.flatMap((setor) => setor.subsetores.map((nome) => ({ nome, setor: setor.nome })));
  // Matriz para a lista dependente: uma coluna por setor com subsetores (cabeçalho = nome do setor), a partir da coluna E.
  const comSubsetores = setores.filter((setor) => setor.subsetores.length > 0);
  // Cada setor ganha um intervalo nomeado (SUBSETORES_n) e uma linha na tabela de consulta (colunas AD:AE).
  listas.getCell('AD1').value = 'Setor';
  listas.getCell('AE1').value = 'Intervalo de subsetores';
  comSubsetores.forEach((setor, coluna) => {
    const letraColuna = listas.getColumn(5 + coluna).letter;
    listas.getCell(1, 5 + coluna).value = setor.nome;
    setor.subsetores.forEach((nome, linha) => (listas.getCell(linha + 2, 5 + coluna).value = nome));
    const nomeIntervalo = `SUBSETORES_${coluna + 1}`;
    workbook.definedNames.add(`Listas!$${letraColuna}$2:$${letraColuna}$${setor.subsetores.length + 1}`, nomeIntervalo);
    listas.getCell(coluna + 2, 30).value = setor.nome;
    listas.getCell(coluna + 2, 31).value = nomeIntervalo;
  });
  workbook.definedNames.add('Listas!$D$2:$D$2', 'SUBSETORES_VAZIO');
  nomesSetores.forEach((nome, indice) => (listas.getCell(indice + 2, 1).value = nome));
  subsetores.forEach((item, indice) => {
    listas.getCell(indice + 2, 2).value = item.nome;
    listas.getCell(indice + 2, 3).value = item.setor;
  });

  const lista = (valores: string[]) => ({ type: 'list' as const, allowBlank: true, formulae: [`"${valores.join(',')}"`], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Escolha um valor da lista.' });
  const intervalo = (coluna: string, total: number) => ({ type: 'list' as const, allowBlank: true, formulae: [`Listas!$${coluna}$2:$${coluna}$${total + 1}`], showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Escolha um valor da lista.' });
  const letra = (indice: number) => String.fromCharCode(64 + indice);
  const colunaDe = (chave: ChaveColuna) => letra(COLUNAS.findIndex((coluna) => coluna.chave === chave) + 1);
  // Lista dependente clássica: INDIRECT sobre o intervalo nomeado do setor da linha. Sem setor (ou setor sem
  // subsetores) a lista fica vazia; enfermeiros nunca têm subsetor (a importação também rejeita).
  const subsetorDependente = (linha: number) => ({
    type: 'list' as const,
    allowBlank: true,
    formulae: [`IFERROR(INDIRECT(VLOOKUP($${colunaDe('setor')}${linha},Listas!$AD$2:$AE$200,2,FALSE)),INDIRECT("SUBSETORES_VAZIO"))`],
    showErrorMessage: true,
    errorTitle: 'Subsetor inválido',
    error: 'Escolha um subsetor do setor selecionado. Enfermeiros não têm subsetor.',
  });
  const indiceDe = (chave: ChaveColuna) => COLUNAS.findIndex((coluna) => coluna.chave === chave) + 1;
  for (let linha = 2; linha <= LINHAS_MAXIMAS + 1; linha++) {
    dados.getCell(linha, indiceDe('formacao')).dataValidation = lista(Object.values(FORMACAO_ROTULO));
    dados.getCell(linha, indiceDe('tipoVinculo')).dataValidation = lista(Object.values(VINCULO_ROTULO));
    dados.getCell(linha, indiceDe('status')).dataValidation = lista(Object.values(STATUS_ROTULO));
    if (nomesSetores.length) dados.getCell(linha, indiceDe('setor')).dataValidation = intervalo('A', nomesSetores.length);
    if (comSubsetores.length) dados.getCell(linha, indiceDe('subsetor')).dataValidation = subsetorDependente(linha);
  }

  const exemploSetor = setores[0]?.nome ?? 'UTI Adulto';
  const setorComSubsetores = setores.find((setor) => setor.subsetores.length > 0);
  const exemploSubsetor = setorComSubsetores?.subsetores[0] ?? '';
  const instrucoes = workbook.addWorksheet('Instruções');
  instrucoes.getColumn(1).width = 22;
  instrucoes.getColumn(2).width = 100;
  const texto: [string, string][] = [
    ['Como importar', ''],
    ['1.', `Preencha a aba "${NOME_ABA}" a partir da linha 2, um profissional por linha (máximo de ${LINHAS_MAXIMAS} por arquivo).`],
    ['2.', 'Colunas com * são obrigatórias para cadastrar um profissional novo. Para atualizar um existente, só o CPF é obrigatório.'],
    ['3.', 'O CPF identifica o profissional: se já houver cadastro com o CPF, os dados da linha atualizam o cadastro; senão, ele é criado.'],
    ['4.', 'Células vazias nunca apagam informações já cadastradas. Profissionais que não estão na planilha não são alterados.'],
    ['5.', 'Antes de gravar, o sistema mostra uma pré-visualização com o que será cadastrado, atualizado ou ignorado, e os erros por linha.'],
    ['6.', 'Nome e COREN não são alterados em profissionais já cadastrados. Enfermeiros são vinculados só ao setor e nunca têm subsetor. Técnicos podem ter subsetor, que deve pertencer ao setor informado (a lista de Subsetor mostra só os do setor escolhido).'],
    ['7.', 'Não há senha na planilha: novos profissionais recebem a senha padrão definida pela instituição e devem trocá-la.'],
    ['', ''],
    ['Campos', 'Regras'],
    ...COLUNAS.map((coluna): [string, string] => [`${coluna.rotulo}${coluna.obrigatoria ? ' *' : ''}`, coluna.ajuda]),
    ['', ''],
    ['Exemplo válido', 'Os valores abaixo são fictícios; apague-os ou não os copie para a aba de dados.'],
  ];
  texto.forEach(([a, b]) => instrucoes.addRow([a, b]));
  const exemplo = instrucoes.addRow(COLUNAS.map((coluna) => coluna.rotulo));
  exemplo.font = { bold: true };
  instrucoes.addRow(['Ana Clara Souza', '529.982.247-25', 'COREN-CE 123456', 'ana.souza@exemplo.com', 'Enfermeiro', 'CLT', exemploSetor, '', 'Ativo']);
  instrucoes.addRow(['Bruno Lima', '111.444.777-35', 'COREN-CE 654321', 'bruno.lima@exemplo.com', 'Técnico de enfermagem', 'Concursado', setorComSubsetores?.nome ?? exemploSetor, exemploSubsetor, '']);
  [1, 10, 11 + COLUNAS.length + 1].forEach((linha) => (instrucoes.getRow(linha).font = { bold: true }));
  instrucoes.eachRow((row) => (row.alignment = { vertical: 'top', wrapText: true }));

  // O Excel/LibreOffice abre na primeira aba: a de dados.
  workbook.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: 'visible' }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
