// Gera os documentos Word de cada frente a partir de conteudo.mjs:
//   node docs/equipe/documentos/gerar.mjs
// Saída: docs/equipe/documentos/frente-<x>-passo-a-passo.docx e frente-<x>-guia-do-projeto.docx
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_DE_APOIO, FRENTES, GLOSSARIO_HOTEL, PROJETO } from './conteudo.mjs';
import { APOIO_DEV, FUNCOES, KITS, QUEM } from './manuais.mjs';

const PASTA = dirname(fileURLToPath(import.meta.url));
const COR = { a: '2563EB', b: '7C3AED', c: 'A87A2E', d: '047857' };
const SUAVE = { a: 'EAF0FE', b: 'F1EBFE', c: 'F8F0E1', d: 'E3F5EE' };
const CINZA = '55657E';
const LINHA = 'DFE5EF';
const FONTE = 'Calibri';

// ---------- Blocos básicos ----------
const texto = (t, o = {}) => new TextRun({ text: t, font: FONTE, size: o.size ?? 22, bold: o.bold, italics: o.italics, color: o.color });
/** Texto com **negrito** simples e <b>…</b> (do conteúdo das páginas). */
function rico(t, o = {}) {
  const partes = String(t).replace(/<\/?b>/g, '**').split('**');
  return partes.map((p, i) => texto(p, { ...o, bold: o.bold || i % 2 === 1 }));
}
const par = (t, o = {}) =>
  new Paragraph({ children: rico(t, o), spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.align });
const vazio = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [], spacing: { after: 60 } }));

function titulo(t, cor, nivel = 1) {
  const tam = { 0: 44, 1: 30, 2: 25 }[nivel];
  return new Paragraph({
    children: [texto(t, { size: tam, bold: true, color: nivel === 2 ? '0F172A' : cor })],
    spacing: { before: nivel === 0 ? 0 : nivel === 1 ? 360 : 240, after: 120 },
    keepNext: true,
    border: nivel === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: cor, space: 4 } } : undefined,
  });
}
const rotulo = (t, cor = CINZA) =>
  new Paragraph({ children: [texto(t.toUpperCase(), { size: 17, bold: true, color: cor })], spacing: { before: 160, after: 60 }, keepNext: true });

const bullets = (itens, o = {}) =>
  itens.map((t) => new Paragraph({ children: rico(t, { size: o.size }), bullet: { level: 0 }, spacing: { after: 60 } }));
const numerados = (itens) =>
  itens.map(
    (t, i) =>
      new Paragraph({
        children: [texto(`${i + 1}.  `, { bold: true }), ...rico(t)],
        indent: { left: 360, hanging: 360 },
        spacing: { after: 80 },
      }),
  );
const checklist = (itens) =>
  itens.map((t) => new Paragraph({ children: [texto('☐  ', { size: 24 }), ...rico(t)], spacing: { after: 60 }, indent: { left: 120 } }));

const borda = { style: BorderStyle.SINGLE, size: 4, color: LINHA };
const bordas = { top: borda, bottom: borda, left: borda, right: borda, insideHorizontal: borda, insideVertical: borda };
function celula(t, o = {}) {
  return new TableCell({
    children: [new Paragraph({ children: t ? rico(t, { size: o.size ?? 19, bold: o.bold, color: o.color }) : [] })],
    shading: o.fundo ? { fill: o.fundo, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    width: o.largura ? { size: o.largura, type: WidthType.PERCENTAGE } : undefined,
  });
}
function tabela(colunas, linhas, cor, o = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: [
      new TableRow({ tableHeader: true, children: colunas.map((c) => celula(c, { bold: true, fundo: cor, size: 18 })) }),
      ...linhas.map(
        (l) =>
          new TableRow({
            height: { value: o.altura ?? 420, rule: HeightRule.ATLEAST },
            cantSplit: true,
            children: l.map((c, i) => celula(c, { bold: i === 0 && o.primeiraNegrito })),
          }),
      ),
    ],
  });
}
/** Formulário: rótulo à esquerda, espaço em branco à direita. */
function formulario(campos, suave) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bordas,
    rows: campos.map(
      (c) =>
        new TableRow({
          height: { value: 520, rule: HeightRule.ATLEAST },
          cantSplit: true,
          children: [celula(c, { bold: true, fundo: suave, largura: 32, size: 19 }), celula('', { largura: 68 })],
        }),
    ),
  });
}
function caixa(linhas, suave, cor) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: borda, bottom: borda, right: borda, left: { style: BorderStyle.SINGLE, size: 24, color: cor }, insideHorizontal: borda, insideVertical: borda },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: linhas.map((l) => new Paragraph({ children: rico(l, { size: 20 }), spacing: { after: 60 } })),
            shading: { fill: suave, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
          }),
        ],
      }),
    ],
  });
}
function modelo(m, f) {
  if (!m) return [];
  const saida = [];
  if (m.titulo) saida.push(par(m.titulo, { bold: true, before: 120, after: 80 }));
  const exemplo = !m.campos && m.linhas.length > 1 && m.linhas[0].slice(1).every(Boolean);
  if (exemplo) saida.push(par('A 1ª linha é um exemplo. Preencham as outras.', { size: 18, color: CINZA, after: 60 }));
  saida.push(m.campos ? formulario(m.campos, SUAVE[f.id]) : tabela(m.colunas, m.linhas, SUAVE[f.id], { primeiraNegrito: true }));
  saida.push(...vazio());
  return saida;
}
function cabecalhoDoc(f, tipo) {
  return [
    new Paragraph({
      children: [texto(`PROJETO ESTADIA  ·  FRENTE ${f.letra}`, { size: 18, bold: true, color: COR[f.id] })],
      spacing: { after: 80 },
    }),
    titulo(`${f.titulo}`, '0F172A', 0),
    new Paragraph({ children: [texto(tipo, { size: 30, color: COR[f.id], bold: true })], spacing: { after: 160 } }),
    caixa([`**Missão:** ${f.missao}`, `**Quem:** ${f.papeis}`, `**Base na disciplina:** ${f.modulo}`], SUAVE[f.id], COR[f.id]),
    ...vazio(),
  ];
}
const rodape = (f, tipo) =>
  new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          texto(`Estadia · Frente ${f.letra} · ${tipo} · página `, { size: 16, color: CINZA }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 16, color: CINZA }),
        ],
      }),
    ],
  });
const documento = (f, tipo, filhos) =>
  new Document({
    creator: 'Projeto Estadia',
    title: `Frente ${f.letra} · ${tipo}`,
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        footers: { default: rodape(f, tipo) },
        children: filhos,
      },
    ],
  });

// ---------- Passo a passo ----------
function passoAPasso(f) {
  const cor = COR[f.id];
  const c = [...cabecalhoDoc(f, 'Passo a passo')];
  c.push(formulario(['Integrantes', 'Dev de apoio', 'Data final de entrega'], SUAVE[f.id]), ...vazio());
  c.push(titulo('Como usar este documento', cor));
  c.push(
    ...numerados([
      'Façam as etapas na ordem. Cada uma diz em que semana fazer, quanto tempo leva e qual aula da apostila explica o assunto.',
      'Nas tabelas, a 1ª linha é um exemplo: usem como modelo.',
      'O **Desafio extra** é opcional, só para quem quiser ir além.',
      'Preencham as tabelas e campos deste próprio arquivo (ele é editável no Word ou no Google Docs).',
      'Marquem o checklist **Pronto quando** antes de considerar a etapa concluída.',
      'Ao terminar cada etapa, salvem e enviem pelo site da divisão de funções, na área **Entregas** da Frente ' +
        f.letra +
        ', com o nome indicado em "Entregar como".',
    ]),
  );
  f.etapas.forEach((e, i) => {
    c.push(titulo(`Etapa ${i + 1} · ${e.titulo}`, cor));
    c.push(par(`**Quando:** ${e.semana}   ·   **Tempo:** ${e.tempo ?? '—'}   ·   **Quem faz:** ${QUEM[e.entregar.split('-')[0]] ?? '—'}`, { after: 80 }));
    c.push(caixa([`**Conceito da apostila:** ${e.aula}`], SUAVE[f.id], cor));
    c.push(rotulo('Objetivo', cor), par(e.objetivo));
    c.push(rotulo('Passo a passo', cor), ...numerados(e.passos));
    c.push(rotulo('Para preencher', cor), ...modelo(e.modelo, f), ...modelo(e.modeloExtra, f));
    c.push(rotulo('Pronto quando', cor), ...checklist(e.pronto));
    c.push(par(`**Entregar como:** ${e.entregar}`, { before: 120, color: cor }));
    if (e.desafio) c.push(caixa([`**Desafio extra (opcional):** ${e.desafio}`], SUAVE[f.id], cor), ...vazio());
  });
  c.push(titulo('O papel do dev de apoio', cor), ...bullets(DEV_DE_APOIO));
  c.push(titulo('Como entregar no site', cor));
  c.push(
    ...numerados([
      'Abram o link da divisão de funções que o grupo usa.',
      `Na Frente ${f.letra}, toquem em **Enviar entrega** e escolham o arquivo (Word, PDF, Excel, PowerPoint, imagem ou ZIP; até 25 MB).`,
      'O arquivo aparece na hora para todo o grupo, com o nome de quem enviou e a data. Versões novas podem ser enviadas por cima: a mais recente fica no topo.',
      'Sem o servidor ligado (página aberta como arquivo), o envio não funciona: mandem o arquivo para a Frente A.',
    ]),
  );
  return documento(f, 'Passo a passo', c);
}

// ---------- Guia do projeto ----------
function guia(f) {
  const cor = COR[f.id];
  const c = [...cabecalhoDoc(f, 'Guia do projeto')];
  c.push(titulo('O seu foco', cor), caixa([f.guia.foco], SUAVE[f.id], cor));
  c.push(titulo('Como usar este guia', cor));
  c.push(par('Este guia tem uma parte geral e um **manual para cada função**. Leia a parte geral e depois vá direto ao manual da sua função: ele tem tudo de que você precisa para fazer as suas tarefas do Passo a passo.'));
  c.push(
    tabela(
      ['Função', 'O que faz', 'Tarefas'],
      FUNCOES[f.id].map((fn) => [fn.nome, fn.missao, fn.dev ? 'apoio às tarefas' : fn.tarefas.join(', ')]),
      SUAVE[f.id],
      { primeiraNegrito: true, altura: 300 },
    ),
  );
  c.push(titulo('O projeto em 1 minuto', cor), par(PROJETO.resumo));
  c.push(rotulo('O problema', cor), par(PROJETO.problema), rotulo('A solução', cor), par(PROJETO.solucao));
  c.push(rotulo('Quem usa o sistema no hotel', cor), tabela(['Perfil', 'O que faz'], PROJETO.perfis, SUAVE[f.id], { primeiraNegrito: true, altura: 300 }));
  for (const sec of f.guia.secoes) {
    c.push(titulo(sec.titulo, cor, 2));
    if (sec.texto) c.push(par(sec.texto));
    if (sec.lista) c.push(...bullets(sec.lista));
    if (sec.tabela) c.push(tabela(sec.tabela.colunas, sec.tabela.linhas, SUAVE[f.id], { primeiraNegrito: true, altura: 300 }), ...vazio());
  }
  for (const fn of FUNCOES[f.id]) {
    c.push(new Paragraph({ children: [], pageBreakBefore: true }));
    c.push(new Paragraph({ children: [texto(`MANUAL DA FUNÇÃO · FRENTE ${f.letra}`, { size: 18, bold: true, color: cor })], spacing: { after: 40 } }));
    c.push(titulo(fn.nome, '0F172A', 0), caixa([fn.missao], SUAVE[f.id], cor), ...vazio());
    if (fn.dev) {
      c.push(titulo('O que você entrega em cada tarefa', cor), tabela(['Tarefa', 'O que fazer'], APOIO_DEV[f.id], SUAVE[f.id], { primeiraNegrito: true, altura: 300 }));
      c.push(rotulo('Sempre', cor), ...bullets(DEV_DE_APOIO), par(PROJETO.demo, { before: 120 }));
      continue;
    }
    for (const cod of fn.tarefas) {
      const e = f.etapas.find((x) => x.entregar.split('-')[0] === cod);
      const k = KITS[cod];
      if (!e || !k) continue;
      c.push(titulo(`Tarefa ${cod} · ${e.titulo}  (${e.tempo ?? ''})`, cor));
      c.push(rotulo('O que você precisa saber', cor), ...bullets(k.saber));
      for (const m of k.material ?? []) {
        c.push(titulo(m.titulo, cor, 2));
        if (m.tabela) c.push(tabela(m.tabela.colunas, m.tabela.linhas, SUAVE[f.id], { primeiraNegrito: true, altura: 300 }), ...vazio());
        if (m.lista) c.push(...bullets(m.lista));
        if (m.passos) c.push(...numerados(m.passos));
        if (m.texto) c.push(caixa([m.texto], SUAVE[f.id], cor), ...vazio());
      }
      if (k.dicas?.length) c.push(rotulo('Dicas', cor), ...bullets(k.dicas));
      if (k.erros?.length) c.push(rotulo('Cuidado com', cor), ...bullets(k.erros));
    }
  }
  c.push(new Paragraph({ children: [], pageBreakBefore: true }));
  c.push(titulo('Onde tirar dúvidas', cor), tabela(['Preciso de…', 'Onde encontrar'], PROJETO.ondeVer, SUAVE[f.id], { primeiraNegrito: true, altura: 300 }));
  c.push(titulo('Glossário', cor), tabela(['Termo', 'Significado'], GLOSSARIO_HOTEL, SUAVE[f.id], { primeiraNegrito: true, altura: 300 }));
  return documento(f, 'Guia do projeto', c);
}

for (const f of FRENTES) {
  for (const [nome, doc] of [
    [`frente-${f.id}-passo-a-passo.docx`, passoAPasso(f)],
    [`frente-${f.id}-guia-do-projeto.docx`, guia(f)],
  ]) {
    await writeFile(join(PASTA, nome), await Packer.toBuffer(doc));
    console.log('gerado', nome);
  }
}
