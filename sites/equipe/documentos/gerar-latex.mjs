// Gera os .tex dos documentos de cada frente (mesmo conteúdo dos .docx) para virar PDF:
//   node docs/equipe/documentos/gerar-latex.mjs     → documentos/latex/*.tex
//   docs/equipe/documentos/compilar-pdf.sh          → documentos/*.pdf (TeX Live em Docker)
//
// Visual: cada documento inteiro na cor da sua equipe (A azul, B violeta, C dourado, D verde), capa
// ilustrada, mapa da jornada, barra de progresso em cada etapa, ícones (Font Awesome), cartões,
// checklists grandes e selo de entrega.
// Quebras de página: cada etapa começa numa página nova; títulos nunca ficam sozinhos no pé da
// página (\Needspace); tabelas longas repetem o cabeçalho (longtable); cartões, campos e
// checklists não se partem.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_DE_APOIO, FRENTES, GLOSSARIO_HOTEL, PROJETO } from './conteudo.mjs';
import { APOIO_DEV, FUNCOES, KITS, QUEM } from './manuais.mjs';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), 'latex');
const COR = { a: '2563EB', b: '7C3AED', c: 'B07D24', d: '047857' };
const SUAVE = { a: 'EAF0FE', b: 'F1EBFE', c: 'FAF1DF', d: 'E3F5EE' };
const NOME_COR = { a: 'Azul', b: 'Violeta', c: 'Dourado', d: 'Verde' };
const ICONE_FRENTE = { a: '\\faProjectDiagram', b: '\\faRunning', c: '\\faChartLine', d: '\\faUsers' };

/** Ícone de cada etapa, pelo assunto do título. */
function iconeEtapa(t) {
  const regras = [
    [/canvas/i, '\\faThLarge'],
    [/termo de abertura|kick|reunião de início/i, '\\faFlag'],
    [/cronograma|EAP/i, '\\faCalendar'],
    [/PERT/i, '\\faProjectDiagram'],
    [/SPI|acompanhamento/i, '\\faChartLine'],
    [/encerramento|fechamento/i, '\\faFlagCheckered'],
    [/funcionalidades/i, '\\faListUl'],
    [/sprint/i, '\\faRunning'],
    [/reuniões|retrospectiva/i, '\\faComments'],
    [/indicadores \(KPIs\)|fichas de indicadores/i, '\\faStopwatch'],
    [/conversa/i, '\\faHandshake'],
    [/manual/i, '\\faBookOpen'],
    [/quem decide/i, '\\faBalanceScale'],
    [/metas/i, '\\faBullseye'],
    [/backlog/i, '\\faListUl'],
    [/Ready|Done/i, '\\faClipboardCheck'],
    [/Kanban/i, '\\faColumns'],
    [/Sprint Planning/i, '\\faRunning'],
    [/Cerimônias/i, '\\faComments'],
    [/Refinamento/i, '\\faFilter'],
    [/estratégica/i, '\\faChessKnight'],
    [/OKR/i, '\\faBullseye'],
    [/Fichas de KPI/i, '\\faStopwatch'],
    [/Painel/i, '\\faChartBar'],
    [/KPIs do projeto/i, '\\faChartPie'],
    [/Business Partner/i, '\\faHandshake'],
    [/prontidão/i, '\\faUsers'],
    [/implantação|treinamento/i, '\\faChalkboardTeacher'],
    [/adoção/i, '\\faSeedling'],
    [/governança/i, '\\faBalanceScale'],
  ];
  return regras.find(([r]) => r.test(t))?.[1] ?? '\\faStar';
}
const ICONE_PERFIL = {
  Recepção: '\\faConciergeBell',
  Governança: '\\faBroom',
  Gerência: '\\faUserTie',
  Financeiro: '\\faCashRegister',
  Administrador: '\\faCog',
  'Suporte técnico': '\\faHeadset',
};
const ICONE_RESTRICAO = ['\\faWifi', '\\faServer', '\\faUserShield', '\\faDatabase'];

/** Texto do conteúdo → LaTeX: escapa caracteres reservados e converte **negrito**, <b> e "aspas". */
function tex(t) {
  return String(t ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/<\/?b>/g, '**')
    .replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}')
    .replace(/"([^"]*)"/g, "``$1''");
}

// ---------- Preâmbulo e componentes LaTeX ----------
const PREAMBULO = (f, tipo) => String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[brazilian]{babel}
\usepackage[default,type1,semibold]{inter}
\usepackage[a4paper,top=18mm,bottom=24mm,left=18mm,right=18mm,footskip=12mm]{geometry}
\usepackage[table]{xcolor}
\usepackage{amssymb,textcomp,array,longtable,enumitem,fancyhdr,lastpage,needspace,fontawesome5}
\usepackage[skins,breakable,raster]{tcolorbox}
\usepackage[hidelinks]{hyperref}
\usetikzlibrary{positioning,calc,babel}
\DeclareUnicodeCharacter{2192}{\ensuremath{\rightarrow}}
\DeclareUnicodeCharacter{2212}{\ensuremath{-}}
\DeclareUnicodeCharacter{2265}{\ensuremath{\geq}}
\DeclareUnicodeCharacter{2248}{\ensuremath{\approx}}
\DeclareUnicodeCharacter{03C3}{\ensuremath{\sigma}}

\definecolor{cor}{HTML}{${COR[f.id]}}
\definecolor{suave}{HTML}{${SUAVE[f.id]}}
\definecolor{texto}{HTML}{0F172A}
\definecolor{cinza}{HTML}{5B6B84}
\definecolor{linha}{HTML}{D3DAE6}
\color{texto}
\setlength{\parindent}{0pt}
\setlength{\parskip}{4pt}
\linespread{1.1}
\setlength{\LTpre}{6pt}
\setlength{\LTpost}{10pt}
\renewcommand{\arraystretch}{1.45}
\arrayrulecolor{linha}
\setlist{itemsep=4pt,topsep=4pt,parsep=0pt}
\setlist[itemize]{label={\color{cor}\small\faCaretRight},leftmargin=1.4em}
% Passos numerados: número dentro de um círculo da cor da equipe.
\DeclareRobustCommand{\bolinha}[1]{\tikz[baseline=(n.base)]\node[circle,fill=cor,text=white,inner sep=1.6pt,minimum size=17pt,font=\footnotesize\bfseries](n){#1};}
\setlist[enumerate]{label=\bolinha{\arabic*},leftmargin=2.3em,labelsep=0.6em,itemsep=6pt}
% Checklist: quadrado grande para marcar à mão.
\DeclareRobustCommand{\caixinha}{\tikz[baseline=-0.6ex]\draw[cor,line width=1.2pt,rounded corners=2pt](0,-0.16)rectangle(0.42,0.26);}
\newlist{checklist}{itemize}{1}
\setlist[checklist]{label=\caixinha,leftmargin=2em,labelsep=0.6em,itemsep=7pt}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0pt}
\fancyfoot[L]{\footnotesize\color{cor}\textbf{${ICONE_FRENTE[f.id]}\ \ Frente ${f.letra}}\color{cinza}\ \ ·\ \ ${tex(f.titulo)} · ${tipo}}
\fancyfoot[R]{\footnotesize\color{cinza}\textbf{\thepage}\,/\,\pageref{LastPage}}
% Fita da cor da equipe na margem esquerda de todas as páginas.
\fancyhead[L]{\begin{tikzpicture}[remember picture,overlay]\fill[cor](current page.north west)rectangle([xshift=5pt]current page.south west);\end{tikzpicture}}

% Título de seção com ícone: nunca sozinho no pé da página.
\newcommand{\secao}[2]{\Needspace{10\baselineskip}\vspace{12pt}%
  \noindent\tikz[baseline=(i.base)]\node[circle,fill=cor,text=white,minimum size=26pt,inner sep=0pt](i){\small #1};%
  \hspace{8pt}{\Large\bfseries #2}\par\vspace{-4pt}{\color{cor!35}\rule{\linewidth}{1.2pt}}\par\vspace{2pt}}
\newcommand{\subsecao}[1]{\Needspace{8\baselineskip}\vspace{8pt}{\large\bfseries\color{cor}#1}\par}
\newcommand{\rotulo}[2]{\Needspace{6\baselineskip}\vspace{10pt}%
  \noindent{\color{cor}\normalsize #1}\hspace{6pt}{\footnotesize\bfseries\color{cor}\MakeUppercase{#2}}\par\vspace{2pt}}
\newtcolorbox{destaque}[1][]{enhanced,breakable,colback=suave,colframe=suave,borderline west={4pt}{0pt}{cor},arc=4pt,boxrule=0pt,left=12pt,right=12pt,top=8pt,bottom=8pt,before skip=8pt,after skip=10pt,#1}
\newtcolorbox{apostila}{enhanced,breakable,colback=white,colframe=cor,boxrule=1pt,arc=6pt,left=12pt,right=12pt,top=8pt,bottom=8pt,before skip=8pt,after skip=8pt,
  overlay={\node[fill=cor,text=white,rounded corners=3pt,font=\scriptsize\bfseries,inner sep=4pt,anchor=west] at ([xshift=10pt]frame.north west) {\faBookOpen\ DA APOSTILA};}}
\newtcolorbox{selo}{enhanced,left=8pt,right=8pt,top=8pt,bottom=8pt,before skip=0pt,after skip=0pt,
  frame code={\draw[cor,dashed,line width=1.4pt,rounded corners=8pt](frame.south west)rectangle(frame.north east);},
  interior code={\fill[suave,rounded corners=8pt](interior.south west)rectangle(interior.north east);}}
% Anotações: ocupa o resto da página da etapa (só se sobrar espaço útil).
\newcommand{\anotacoes}{\par\ifdim\dimexpr\pagegoal-\pagetotal\relax>3.5cm\ifdim\pagegoal<\maxdimen
\begin{tcolorbox}[enhanced,height fill,colback=white,colframe=cor!35,boxrule=0.8pt,arc=8pt,before skip=10pt,left=10pt,top=6pt,
  borderline={0.8pt}{0pt}{cor!35,dashed},frame hidden,
  underlay={\begin{scope}\clip(interior.south west)rectangle(interior.north east);
    \foreach \y in {1,...,40}{\draw[cor!18,line width=0.6pt]([yshift=-\y*0.75cm-0.5cm]interior.north west)--([yshift=-\y*0.75cm-0.5cm]interior.north east);}\end{scope}}]
{\footnotesize\bfseries\color{cor}\faStickyNote\ \ ANOTAÇÕES}
\end{tcolorbox}\fi\fi}
% Fim da etapa: se o bloco final não cabe, a sobra vira Anotações e o bloco vai para a próxima página.
\newif\ifjaanotou
\newsavebox{\blocofinal}
% Mede o bloco final já montado; se não couber no resto da página, a sobra vira Anotações.
\newcommand{\usarblocofinal}{\par\global\jaanotoufalse
  \ifdim\pagegoal<\maxdimen\ifdim\dimexpr\pagegoal-\pagetotal\relax<\dimexpr\ht\blocofinal+\dp\blocofinal+18pt\relax
    \anotacoes\global\jaanotoutrue\clearpage\fi\fi
  \vspace{10pt}\noindent\usebox{\blocofinal}\par}
\newtcolorbox{faixa}[1][]{enhanced,colback=cor,colframe=cor,coltext=white,arc=8pt,boxrule=0pt,left=14pt,right=14pt,top=10pt,bottom=10pt,#1}
\newtcbox{\chip}[1][]{enhanced,on line,colback=suave,colframe=suave,coltext=cor,arc=7pt,boxrule=0pt,left=5pt,right=5pt,top=2pt,bottom=2pt,fontupper=\footnotesize\bfseries,#1}
\newtcbox{\chipbranco}{enhanced,on line,colback=white,colframe=white,coltext=cor,arc=7pt,boxrule=0pt,left=6pt,right=6pt,top=2pt,bottom=2pt,fontupper=\footnotesize\bfseries}
`;

/** Decoração da capa (círculos translúcidos da cor da equipe) — só na 1ª página. */
const DECORACAO = String.raw`\begin{tikzpicture}[remember picture,overlay]
\fill[cor,opacity=0.10] ([xshift=-1.5cm,yshift=-1cm]current page.north east) circle (5.2cm);
\fill[cor,opacity=0.07] ([xshift=-5.5cm,yshift=-4.5cm]current page.north east) circle (2.4cm);
\fill[cor,opacity=0.06] ([xshift=2cm,yshift=3cm]current page.south west) circle (4cm);
\end{tikzpicture}`;

function capa(f, tipo, iconeTipo) {
  const vagas = FUNCOES[f.id]
    .map(
      (v) => String.raw`\begin{minipage}[t]{0.31\linewidth}\centering
\tikz\node[circle,draw=cor,line width=1.4pt,fill=white,minimum size=34pt,text=cor]{\large ${v.icone}};\par\vspace{4pt}
{\scriptsize\bfseries\color{cor}\MakeUppercase{${tex(v.nome)}}}\par\vspace{14pt}
{\color{cor!60}\rule{0.9\linewidth}{0.8pt}}\par{\scriptsize\color{cinza}nome}
\end{minipage}`,
    )
    .join('\\hfill\n');
  return String.raw`\thispagestyle{fancy}
${DECORACAO}
\vspace*{2mm}
\noindent\begin{tikzpicture}
\node[circle,fill=cor,text=white,minimum size=78pt,font=\fontsize{40}{40}\selectfont\bfseries] (L) {${f.letra}};
\node[right=14pt of L.east,anchor=west,align=left,text width=12.2cm] {
  {\footnotesize\bfseries\color{cor}PROJETO ESTADIA\ \ ·\ \ EQUIPE ${NOME_COR[f.id].toUpperCase()}\ \ ·\ \ FRENTE ${f.letra}}\\[4pt]
  {\fontsize{23}{27}\selectfont\bfseries ${tex(f.titulo)}}\\[6pt]
  \chip{${iconeTipo}\ \ ${tipo}}\ \chip{${ICONE_FRENTE[f.id]}\ \ ${tex(f.modulo)}}
};
\end{tikzpicture}
\vspace{10pt}

\begin{faixa}
{\large\faRocket}\hspace{8pt}{\large\bfseries Nossa missão}\par\vspace{2pt}
{\normalsize ${tex(f.missao)}}
\end{faixa}

\vspace{6pt}
\begin{tcolorbox}[enhanced,colback=white,colframe=cor!40,boxrule=1pt,arc=8pt,left=10pt,right=10pt,top=8pt,bottom=10pt,
  title={\faUserFriends\ \ Nossa equipe},fonttitle=\bfseries\small,coltitle=cor,colbacktitle=suave,attach boxed title to top left={xshift=10pt,yshift=-8pt},boxed title style={arc=4pt,boxrule=0pt}]
\vspace{6pt}
${vagas}
\end{tcolorbox}
`;
}

const lista = (itens, amb = 'itemize') => `\\begin{${amb}}\n${itens.map((i) => `  \\item ${tex(i)}`).join('\n')}\n\\end{${amb}}\n`;

/**
 * Tabela com cabeçalho na cor da equipe, linhas zebradas e cabeçalho repetido em cada página
 * (longtable). Larguras proporcionais ao conteúdo. Linhas a preencher ganham altura para escrever.
 */
function tabela(colunas, linhas, o = {}) {
  const n = colunas.length;
  const peso = colunas.map((c, i) => {
    const maior = Math.max(c.length, ...linhas.map((l) => String(l[i] ?? '').length));
    // Coluna para preencher (maioria das células vazias) ganha espaço para escrever.
    const vazias = linhas.filter((l) => !l[i]).length;
    if (linhas.length && vazias / linhas.length >= 0.5) return Math.max(Math.min(maior, 55), n <= 3 ? 50 : 26);
    return Math.min(Math.max(maior, 7), 55);
  });
  const total = peso.reduce((a, b) => a + b, 0);
  const util = 1 - 0.036 * n;
  const spec = peso.map((p) => `>{\\raggedright\\arraybackslash}p{${((util * p) / total).toFixed(3)}\\linewidth}`).join('');
  const cab = colunas.map((c) => `\\color{white}\\textbf{\\footnotesize ${tex(c)}}`).join(' & ');
  const corpo = linhas
    .map((l, k) => {
      const celulas = l.map((c, i) => (i === 0 && o.primeiraNegrito && c ? `\\textbf{${tex(c)}}` : tex(c)));
      const preencher = l.some((c) => !c);
      const altura = preencher ? `\\rule{0pt}{${o.altura ?? 24}pt}` : '';
      const fundo = k % 2 ? '\\rowcolor{suave!55}' : '\\rowcolor{white}';
      return `${fundo}${altura}${celulas.join(' & ')} \\\\ \\hline`;
    })
    .join('\n');
  return String.raw`\begingroup\small
\begin{longtable}{${spec}}
\rowcolor{cor} ${cab} \\
\endfirsthead
\rowcolor{cor} ${cab} \\
\endhead
${corpo}
\end{longtable}
\endgroup
`;
}

/** Formulário: cada campo é um cartão com linha pontilhada para escrever; não se parte. */
function formulario(campos) {
  const itens = campos
    .map(
      (c) => String.raw`\begin{tcolorbox}[enhanced,colback=white,colframe=cor!30,boxrule=0.8pt,arc=5pt,left=8pt,right=8pt,top=4pt,bottom=6pt,before skip=0pt,after skip=5pt]
{\scriptsize\bfseries\color{cor}\MakeUppercase{${tex(c)}}}\par\vspace{16pt}\noindent\tikz\draw[cor!45,dotted,line width=1.3pt](0,0)--(\linewidth,0);\par
\end{tcolorbox}`,
    )
    .join('\n');
  return `\\Needspace{${Math.min(campos.length * 4 + 2, 46)}\\baselineskip}\n${itens}\n\\vspace{4pt}\n`;
}

function modelo(m) {
  if (!m) return '';
  let s = m.titulo ? `\\subsecao{\\faEdit\\ ${tex(m.titulo)}}\n` : '';
  if (m.campos) return s + formulario(m.campos);
  // 1ª linha preenchida e as outras em branco: é um exemplo.
  const exemplo = m.linhas.length > 1 && m.linhas[0].slice(1).every(Boolean) && m.linhas.slice(1).some((l) => l.slice(1).every((c) => !c));
  if (exemplo) s += '{\\footnotesize\\color{cinza}\\faHandPointDown\\ A 1ª linha é um exemplo. Preencham as outras.}\\par\\vspace{2pt}\n';
  return s + tabela(m.colunas, m.linhas, { primeiraNegrito: true });
}

/** Desafio extra (opcional): para quem quiser ir além. */
const desafio = (t) =>
  t
    ? String.raw`\Needspace{6\baselineskip}
\begin{tcolorbox}[enhanced,colback=white,colframe=cor,boxrule=1pt,arc=8pt,left=12pt,right=12pt,top=12pt,bottom=8pt,before skip=20pt,
  overlay={\node[fill=cor,text=white,rounded corners=3pt,font=\scriptsize\bfseries,inner sep=4pt,anchor=west] at ([xshift=10pt]frame.north west) {\faMedal\ DESAFIO EXTRA · OPCIONAL};}]
${tex(t)}
\end{tcolorbox}
`
    : '';

/** Barra de progresso das etapas: feitas com ✓, atual em destaque, próximas vazadas. */
function progresso(atual, total) {
  const passo = Math.min(1.5, 14 / total);
  let s = '\\begin{tikzpicture}\n';
  for (let i = 1; i <= total; i++) {
    const x = ((i - 1) * passo).toFixed(2);
    if (i < total) s += `\\draw[${i < atual ? 'cor' : 'cor!25'},line width=2.2pt](${x},0)--(${((i - 1) * passo + passo).toFixed(2)},0);\n`;
  }
  for (let i = 1; i <= total; i++) {
    const x = ((i - 1) * passo).toFixed(2);
    if (i < atual) s += `\\node[circle,fill=cor,text=white,minimum size=16pt,inner sep=0pt,font=\\scriptsize] at (${x},0){\\faCheck};\n`;
    else if (i === atual) s += `\\node[circle,fill=cor,text=white,draw=suave,line width=3pt,minimum size=24pt,inner sep=0pt,font=\\small\\bfseries] at (${x},0){${i}};\n`;
    else s += `\\node[circle,fill=white,draw=cor!40,line width=1.2pt,text=cor!70,minimum size=16pt,inner sep=0pt,font=\\scriptsize\\bfseries] at (${x},0){${i}};\n`;
  }
  return s + '\\end{tikzpicture}\n';
}

/** Mapa da jornada (capa do Passo a passo): uma linha por etapa, com ícone, semana e entrega. */
function mapaDaJornada(f) {
  const linhas = f.etapas
    .map(
      (e, i) => String.raw`\begin{tcolorbox}[enhanced,colback=${i % 2 ? 'white' : 'suave!60'},colframe=cor!25,boxrule=0.6pt,arc=6pt,left=6pt,right=8pt,top=4pt,bottom=4pt,before skip=0pt,after skip=4pt]
\begin{tabular}{@{}m{24pt}m{20pt}>{\raggedright\arraybackslash}m{0.52\linewidth}>{\raggedleft\arraybackslash}m{0.27\linewidth}@{}}
\tikz\node[circle,fill=cor,text=white,minimum size=20pt,inner sep=0pt,font=\footnotesize\bfseries]{${i + 1}}; &
{\color{cor}\large ${iconeEtapa(e.titulo)}} &
\textbf{${tex(e.titulo)}}\par{\scriptsize\color{cinza}\faUser\ ${tex(QUEM[codigo(e)] ?? '')}} &
\chip{\faCalendarCheck\ ${tex(e.semana)}}\par\vspace{2pt}\chip{\faClock\ ${tex(e.tempo ?? '')}}
\end{tabular}
\end{tcolorbox}`,
    )
    .join('\n');
  return `${linhas}\n`;
}

const fim = '\\end{document}\n';
/** Código da tarefa (A1, B2…), o mesmo da entrega no site. */
const codigo = (e) => e.entregar.split('-')[0];

// ---------- Passo a passo ----------
function passoAPasso(f) {
  let s = PREAMBULO(f, 'Passo a passo') + '\\begin{document}\n' + capa(f, 'Passo a passo', '\\faShoePrints');
  s += '\\secao{\\faMapSigns}{Mapa da jornada}\n';
  s += `{\\color{cinza}${f.etapas.length} tarefas curtas, uma por página. Marquem a bolinha quando terminarem cada uma.}\\par\\vspace{4pt}\n`;
  s += mapaDaJornada(f);
  s += '\\secao{\\faInfoCircle}{Como usar este documento}\n';
  s += lista(
    [
      'Sigam as etapas na ordem. Cada uma diz **em que semana** fazer, **quanto tempo** leva e qual **aula da apostila** explica o assunto.',
      'Nas tabelas, a **1ª linha é um exemplo**: usem como modelo para preencher as outras.',
      'O **Desafio extra** é opcional: só para quem quiser ir além.',
      'Preencham no computador pela versão **Word**; este PDF é para ler e imprimir (há espaço para escrever à mão).',
      'Só considerem a etapa concluída quando todos os quadradinhos do **Pronto quando** estiverem marcados.',
      `Ao terminar, enviem o arquivo pelo site da divisão de funções, em **Entregas da Frente ${f.letra}**, com o nome do selo **Entregar no site**.`,
    ],
    'enumerate',
  );
  f.etapas.forEach((e, i) => {
    s += '\\clearpage\n';
    s += `\\noindent${progresso(i + 1, f.etapas.length)}\\par\\vspace{8pt}\n`;
    s += String.raw`\begin{faixa}[before skip=0pt]
\begin{tabular}{@{}m{40pt}>{\raggedright\arraybackslash}m{0.78\linewidth}@{}}
\tikz\node[circle,fill=white,text=cor,minimum size=36pt,inner sep=0pt]{\Large ${iconeEtapa(e.titulo)}}; &
{\footnotesize\bfseries ETAPA ${i + 1} DE ${f.etapas.length}}\ \ \chipbranco{\faCalendarCheck\ ${tex(e.semana)}}\ \chipbranco{\faClock\ ${tex(e.tempo ?? '')}}\par\vspace{2pt}
{\fontsize{17}{21}\selectfont\bfseries ${tex(e.titulo)}}\par\vspace{3pt}
{\footnotesize\faUser\ \ Quem faz: \textbf{${tex(QUEM[codigo(e)] ?? '')}}\ \ ·\ \ \faCompass\ \ Ajuda: Guia da Frente ${f.letra}, manual da sua função}
\end{tabular}
\end{faixa}
`;
    s += `\\begin{apostila}\\vspace{4pt}${tex(e.aula)}\\end{apostila}\n`;
    s += `\\rotulo{\\faBullseye}{Objetivo}\n{\\large ${tex(e.objetivo)}}\\par\n`;
    s += `\\rotulo{\\faShoePrints}{Passo a passo}\n${lista(e.passos, 'enumerate')}`;
    s += `\\rotulo{\\faPen}{Para preencher}\n${modelo(e.modelo)}${modelo(e.modeloExtra)}`;
    // Bloco final compacto: checklist e selo de entrega lado a lado, num cartão que não se parte.
    s += String.raw`\begin{lrbox}{\blocofinal}\begin{minipage}{\linewidth}
\begin{tcolorbox}[enhanced,colback=suave!45,colframe=cor!35,boxrule=0.8pt,arc=8pt,left=10pt,right=10pt,top=8pt,bottom=8pt,before skip=0pt,after skip=0pt]
\begin{minipage}[t]{0.56\linewidth}\vspace{0pt}
{\footnotesize\bfseries\color{cor}\faCheckDouble\ \ PRONTO QUANDO}\par\vspace{2pt}
${lista(e.pronto, 'checklist')}\end{minipage}\hfill
\begin{minipage}[t]{0.40\linewidth}\vspace{0pt}
\begin{selo}\centering
{\LARGE\color{cor}\faUpload}\par\vspace{3pt}
{\scriptsize\bfseries\color{cor}ENTREGAR NO SITE COMO}\par\vspace{2pt}
{\bfseries ${tex(e.entregar)}}
\end{selo}
\end{minipage}
\end{tcolorbox}
\end{minipage}\end{lrbox}
\usarblocofinal
${desafio(e.desafio)}\ifjaanotou\else\anotacoes\fi
`;
  });
  s += '\\clearpage\n\\secao{\\faLaptopCode}{O papel do dev de apoio}\n' + lista(DEV_DE_APOIO);
  s += '\\secao{\\faUpload}{Como entregar no site}\n';
  s += lista(
    [
      'Abram o link da divisão de funções que o grupo usa.',
      `Na Frente ${f.letra}, toquem em **Enviar entrega** (ou arrastem o arquivo): Word, PDF, Excel, PowerPoint, imagem ou ZIP, até 25 MB.`,
      'O arquivo aparece na hora para todo o grupo, com o nome de quem enviou e a data. Versões novas podem ser enviadas: a mais recente fica no topo.',
      'Sem o servidor ligado (página aberta como arquivo), o envio não funciona: mandem o arquivo para a Frente A.',
    ],
    'enumerate',
  );
  s += String.raw`\vspace{16pt}
\begin{faixa}
\centering{\Large\faTrophy}\par\vspace{4pt}{\large\bfseries Terminaram tudo? Avisem a Frente A e comemorem!}
\end{faixa}
`;
  return s + fim;
}

// ---------- Guia do projeto ----------
function cartoes(itens, colunas, render) {
  const linhasDeCartoes = Math.ceil(itens.length / colunas);
  return `\\Needspace{${Math.min(linhasDeCartoes * 5 + 2, 30)}\\baselineskip}\n\\begin{tcbraster}[raster columns=${colunas},raster equal height=rows,raster column skip=6pt,raster row skip=6pt,raster before skip=4pt,raster after skip=8pt]\n${itens.map(render).join('\n')}\n\\end{tcbraster}\n`;
}
const cartao = (corpo, o = '') =>
  `\\begin{tcolorbox}[enhanced,colback=white,colframe=cor!25,boxrule=0.8pt,arc=6pt,left=8pt,right=8pt,top=6pt,bottom=6pt${o}]\n${corpo}\n\\end{tcolorbox}`;

function linhaDoTempo(itens) {
  const s = itens
    .map(
      ([data, oque], i) => String.raw`\begin{tabular}{@{}m{18pt}>{\raggedright\arraybackslash}m{0.86\linewidth}@{}}
\tikz{\node[circle,fill=${i === itens.length - 1 ? 'cor' : 'white'},draw=cor,line width=1.6pt,minimum size=14pt,inner sep=0pt]{};${i < itens.length - 1 ? '\\draw[overlay,cor!40,line width=1.6pt](0,-0.26)--(0,-1.55);' : ''}} &
\chip{${tex(data)}}\ \ ${tex(oque)}
\end{tabular}\par\vspace{2pt}`,
    )
    .join('\n');
  return `\\Needspace{${itens.length * 3 + 2}\\baselineskip}\n${s}\n`;
}

/** Um bloco de material pronto do kit: tabela, lista ou texto. */
function material(m) {
  let s = `\\subsecao{\\faBoxOpen\\ ${tex(m.titulo)}}\n`;
  if (m.tabela) s += tabela(m.tabela.colunas, m.tabela.linhas, { primeiraNegrito: true });
  if (m.lista) s += `\\begin{destaque}${lista(m.lista)}\\end{destaque}\n`;
  if (m.passos) s += `\\begin{destaque}${lista(m.passos, 'enumerate')}\\end{destaque}\n`;
  if (m.texto) s += `\\begin{destaque}{\\color{cor}\\faQuoteLeft}\\ \\ ${tex(m.texto)}\\end{destaque}\n`;
  return s;
}

/** Kit de uma tarefa: o que saber, material pronto, dicas e erros comuns. */
function kit(f, cod) {
  const e = f.etapas.find((x) => codigo(x) === cod);
  const k = KITS[cod];
  if (!e || !k) return '';
  let s = String.raw`\Needspace{12\baselineskip}\vspace{10pt}
\begin{tcolorbox}[enhanced,colback=cor,colframe=cor,coltext=white,arc=6pt,boxrule=0pt,left=10pt,right=10pt,top=6pt,bottom=6pt,after skip=6pt]
{\Large ${iconeEtapa(e.titulo)}}\hspace{10pt}{\footnotesize\bfseries TAREFA ${cod}}\hspace{8pt}{\large\bfseries ${tex(e.titulo)}}\hfill{\footnotesize\faClock\ ${tex(e.tempo ?? '')}}
\end{tcolorbox}
`;
  s += `\\rotulo{\\faBrain}{O que você precisa saber}\n${lista(k.saber)}`;
  const dicas = (k.dicas ?? []).map((d) => `{\\color{cor}\\faLightbulb}\\ \\ ${tex(d)}`);
  const erros = (k.erros ?? []).map((d) => `{\\color{cor}\\faExclamationTriangle}\\ \\ ${tex(d)}`);
  if (dicas.length || erros.length)
    s += cartoes([[dicas, 'Dicas'], [erros, 'Cuidado com']].filter(([l]) => l.length), 2, ([l, t]) =>
      cartao(`{\\footnotesize\\bfseries\\color{cor}\\MakeUppercase{${t}}}\\par\\vspace{3pt}{\\small ${l.join('\\par\\vspace{3pt}')}}`, ',colback=suave!50'),
    );
  // Material pronto por último: tabelas podem continuar na página seguinte sem deixar buraco.
  for (const m of k.material ?? []) s += material(m);
  return s;
}

/** Cabeçalho do manual de uma função (página nova, na cor da equipe). */
function cabecalhoFuncao(f, fn) {
  // Manuais começam em página nova; o do dev de apoio (curto) aproveita o espaço que sobrar.
  return String.raw`${fn.dev ? '\\Needspace{22\\baselineskip}\\vspace{14pt}' : '\\clearpage'}
\begin{faixa}[before skip=0pt]
\begin{tabular}{@{}m{46pt}>{\raggedright\arraybackslash}m{0.76\linewidth}@{}}
\tikz\node[circle,fill=white,text=cor,minimum size=42pt,inner sep=0pt]{\LARGE ${fn.icone}}; &
{\footnotesize\bfseries MANUAL DA FUNÇÃO · FRENTE ${f.letra}}\label{manual-${fn.vaga}}\par\vspace{2pt}
{\fontsize{20}{24}\selectfont\bfseries ${tex(fn.nome)}}\par\vspace{3pt}
{\small ${tex(fn.missao)}}
\end{tabular}
\end{faixa}
`;
}

function guia(f) {
  const funcoes = FUNCOES[f.id];
  let s = PREAMBULO(f, 'Guia do projeto') + '\\begin{document}\n' + capa(f, 'Guia do projeto', '\\faCompass');
  s += String.raw`\begin{destaque}[before skip=4pt]
{\color{cor}\Large\faCrosshairs}\hspace{8pt}{\large\bfseries O seu foco}\par\vspace{3pt}
${tex(f.guia.foco)}
\end{destaque}
`;
  // Índice dos manuais
  s += '\\secao{\\faSitemap}{Como usar este guia}\n';
  s += '{\\large Este guia tem uma parte geral e um \\textbf{manual para cada função}. Leia a parte geral e depois vá direto ao manual da sua função: ele tem tudo de que você precisa para fazer as suas tarefas do Passo a passo.}\\par\\vspace{6pt}\n';
  s += cartoes(funcoes, 3, (fn) =>
    cartao(
      `\\centering{\\color{cor}\\LARGE ${fn.icone}}\\par\\vspace{3pt}{\\bfseries ${tex(fn.nome)}}\\par\\vspace{2pt}{\\footnotesize\\color{cinza}${tex(fn.missao)}}\\par\\vspace{4pt}` +
        (fn.dev ? '\\chip{apoio às tarefas}' : fn.tarefas.map((t) => `\\chip{${t}}`).join('\\ ')) +
        `\\par\\vspace{4pt}{\\footnotesize\\bfseries\\color{cor}\\faArrowRight\\ manual na página \\pageref{manual-${fn.vaga}}}`,
      ',colback=suave!40',
    ),
  );
  // Parte geral, curta
  s += `\\secao{\\faHotel}{O projeto em 1 minuto}\n{\\large ${tex(PROJETO.resumo)}}\\par\n`;
  s += cartoes(
    [
      ['\\faExclamationTriangle', 'O problema', PROJETO.problema],
      ['\\faLightbulb', 'A solução', PROJETO.solucao],
    ],
    2,
    ([ic, t, c]) => cartao(`{\\color{cor}\\Large ${ic}}\\hspace{6pt}{\\bfseries ${t}}\\par\\vspace{3pt}{\\small ${tex(c)}}`, ',colback=suave!50'),
  );
  for (const sec of f.guia.secoes) {
    s += `\\subsecao{\\faAngleDoubleRight\\ ${tex(sec.titulo)}}\n`;
    if (sec.texto) s += `${tex(sec.texto)}\\par\n`;
    if (sec.lista) s += `\\begin{destaque}${lista(sec.lista)}\\end{destaque}\n`;
    if (sec.tabela) s += tabela(sec.tabela.colunas, sec.tabela.linhas, { primeiraNegrito: true });
  }
  // Um manual por função
  for (const fn of funcoes) {
    s += cabecalhoFuncao(f, fn);
    if (fn.dev) {
      s += '\\secao{\\faTools}{O que você entrega em cada tarefa}\n';
      s += tabela(['Tarefa', 'O que fazer'], APOIO_DEV[f.id], { primeiraNegrito: true });
      s += '\\rotulo{\\faHandsHelping}{Sempre}\n' + lista(DEV_DE_APOIO);
      s += `\\begin{destaque}{\\color{cor}\\faDesktop}\\ \\ ${tex(PROJETO.demo)}\\end{destaque}\n`;
      continue;
    }
    s += `\\rotulo{\\faTasks}{Suas tarefas}\n${fn.tarefas
      .map((t) => {
        const e = f.etapas.find((x) => codigo(x) === t);
        return `\\chip{${t}}\\ ${tex(e?.titulo ?? '')}`;
      })
      .join('\\hspace{10pt}')}\\par\n`;
    s += `{\\footnotesize\\color{cinza}Você também ajuda nas outras tarefas da frente. Quem faz cada uma está no Passo a passo.}\\par\n`;
    for (const t of fn.tarefas) s += kit(f, t);
  }
  // Final
  s += '\\clearpage\n\\secao{\\faQuestionCircle}{Onde tirar dúvidas}\n';
  s += tabela(['Preciso de…', 'Onde encontrar'], PROJETO.ondeVer, { primeiraNegrito: true });
  s += '\\secao{\\faBook}{Glossário}\n';
  s += cartoes(GLOSSARIO_HOTEL, 2, ([t, d]) => cartao(`{\\bfseries\\color{cor}${tex(t)}}\\par\\vspace{1pt}{\\footnotesize ${tex(d)}}`));
  return s + fim;
}

await mkdir(PASTA, { recursive: true });
for (const f of FRENTES) {
  await writeFile(join(PASTA, `frente-${f.id}-passo-a-passo.tex`), passoAPasso(f));
  await writeFile(join(PASTA, `frente-${f.id}-guia-do-projeto.tex`), guia(f));
  console.log('tex gerado: frente', f.letra);
}
