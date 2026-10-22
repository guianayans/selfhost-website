// Servidor da divisão de funções: entrega a página e grava as escolhas NA PASTA DO HTML, em tempo real.
//   node divisao/servidor.mjs            → http://<ip-da-máquina>:8091
//   PORTA=9000 node divisao/servidor.mjs
// Sem dependências (Node 18+). Grava divisao.json (estado) e divisao.md (legível).
// Todos que abrirem o link veem as escolhas dos outros na hora (Server-Sent Events).
// Também entrega os documentos de cada frente (documentos/*.docx) e recebe as ENTREGAS (upload),
// gravadas em entregas/frente-<x>/ com o índice em entregas/entregas.json.
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 8091);
const LIMITE = 8 * 1024;
const LIMITE_ENTREGA = 25 * 1024 * 1024; // 25 MB por arquivo
const EXTENSOES = new Set(['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'txt', 'md']);
const PASTA_ENTREGAS = join(PASTA, 'entregas');
const INDICE_ENTREGAS = join(PASTA_ENTREGAS, 'entregas.json');

// As 12 vagas (mesmos ids da página).
const FRENTES = [
  { letra: 'A', nome: 'Organização do Projeto', vagas: [['a1', 'Coordenação'], ['a2', 'Documentação'], ['a-dev', 'Dev de apoio']] },
  { letra: 'B', nome: 'Produto e Tarefas', vagas: [['b-po', 'Product Owner'], ['b-sm', 'Scrum Master'], ['b-dev', 'Dev de apoio']] },
  { letra: 'C', nome: 'Metas e Indicadores', vagas: [['c1', 'Metas'], ['c2', 'Painel'], ['c-dev', 'Dev de apoio']] },
  { letra: 'D', nome: 'Pessoas e Treinamento', vagas: [['d1', 'Relação com a cliente'], ['d2', 'Treinamento'], ['d-dev', 'Dev de apoio']] },
];
const VAGAS = new Set(FRENTES.flatMap((f) => f.vagas.map((v) => v[0])));

let estado = { vagas: {}, atualizado: null };
let entregas = []; // { id, frente, arquivo (nome original), salvo, nome, dono, em, tamanho }
const clientes = new Set();
let fila = Promise.resolve();

try {
  const salvo = JSON.parse(await readFile(join(PASTA, 'divisao.json'), 'utf8'));
  if (salvo && typeof salvo.vagas === 'object') estado = salvo;
} catch {}

try {
  const salvas = JSON.parse(await readFile(INDICE_ENTREGAS, 'utf8'));
  if (Array.isArray(salvas)) entregas = salvas;
} catch {}

async function gravar(nome, conteudo) {
  const destino = join(PASTA, nome);
  await writeFile(`${destino}.tmp`, conteudo, 'utf8');
  await rename(`${destino}.tmp`, destino);
}

function markdown() {
  const linhas = ['# Divisão de funções · Projeto Estadia', ''];
  for (const f of FRENTES) {
    linhas.push(`## Frente ${f.letra} · ${f.nome}`);
    for (const [id, papel] of f.vagas) linhas.push(`- **${papel}:** ${estado.vagas[id]?.nome ?? '—'}`);
    linhas.push('');
  }
  const total = Object.keys(estado.vagas).length;
  linhas.push(`_${total} de ${VAGAS.size} vagas preenchidas · atualizado em ${new Date().toLocaleString('pt-BR')}_`, '');
  return linhas.join('\n');
}

function publico() {
  // "dono" é só um id aleatório do aparelho, para a página marcar "você"; não dá nenhum poder extra.
  const vagas = {};
  for (const [id, v] of Object.entries(estado.vagas)) vagas[id] = { nome: v.nome, dono: v.dono, em: v.em };
  const lista = entregas.map(({ id, frente, arquivo, nome, dono, em, tamanho }) => ({ id, frente, arquivo, nome, dono, em, tamanho }));
  return { vagas, atualizado: estado.atualizado, online: clientes.size, entregas: lista };
}

function transmitir() {
  const dados = `data: ${JSON.stringify(publico())}\n\n`;
  for (const res of clientes) res.write(dados);
}

function salvar() {
  estado.atualizado = new Date().toISOString();
  const json = JSON.stringify(estado, null, 2);
  const md = markdown();
  fila = fila.then(() => Promise.all([gravar('divisao.json', json), gravar('divisao.md', md)])).catch((e) => console.error('erro ao gravar:', e.message));
  transmitir();
}

function responder(res, status, corpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': tipo, 'cache-control': 'no-store' });
  res.end(corpo);
}

/** Nome de arquivo seguro para exibir (sem caminho, sem caracteres de controle). */
const limparArquivo = (n) =>
  String(n ?? '')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f"<>|]/g, '')
    .trim()
    .slice(0, 120);

async function salvarIndiceEntregas() {
  await mkdir(PASTA_ENTREGAS, { recursive: true });
  const destino = INDICE_ENTREGAS;
  await writeFile(`${destino}.tmp`, JSON.stringify(entregas, null, 2), 'utf8');
  await rename(`${destino}.tmp`, destino);
}

async function receberEntrega(req, res, params) {
  const frente = params.get('frente');
  const dono = params.get('dono') ?? '';
  const nome = (params.get('nome') ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const arquivo = limparArquivo(params.get('arquivo'));
  const ext = extname(arquivo).slice(1).toLowerCase();
  if (!FRENTES.some((f) => f.letra.toLowerCase() === frente)) return responder(res, 400, '{"erro":"Frente inválida"}');
  if (dono.length < 8 || dono.length > 64) return responder(res, 400, '{"erro":"Aparelho inválido"}');
  if (nome.length < 2) return responder(res, 400, '{"erro":"Digite seu nome lá em cima antes de enviar"}');
  if (!arquivo || !EXTENSOES.has(ext))
    return responder(res, 400, JSON.stringify({ erro: `Tipo de arquivo não aceito. Use: ${[...EXTENSOES].join(', ')}` }));
  if (Number(req.headers['content-length'] ?? 0) > LIMITE_ENTREGA)
    return responder(res, 413, '{"erro":"Arquivo maior que 25 MB"}');

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const pasta = join(PASTA_ENTREGAS, `frente-${frente}`);
  await mkdir(pasta, { recursive: true });
  const salvo = `${id}.${ext}`;
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE_ENTREGA) return responder(res, 413, '{"erro":"Arquivo maior que 25 MB"}');
    partes.push(parte);
  }
  if (!tamanho) return responder(res, 400, '{"erro":"Arquivo vazio"}');
  await writeFile(join(pasta, salvo), Buffer.concat(partes));
  entregas.unshift({ id, frente, arquivo, salvo, nome, dono, em: new Date().toISOString(), tamanho });
  await salvarIndiceEntregas();
  console.log(`${new Date().toLocaleTimeString('pt-BR')} entrega ${frente.toUpperCase()} ${arquivo} (${nome})`);
  transmitir();
  return responder(res, 200, JSON.stringify(publico()));
}

async function baixarEntrega(res, id) {
  const e = entregas.find((x) => x.id === id);
  if (!e) return responder(res, 404, 'Entrega não encontrada', 'text/plain; charset=utf-8');
  const caminho = join(PASTA_ENTREGAS, `frente-${e.frente}`, e.salvo);
  const info = await stat(caminho).catch(() => null);
  if (!info) return responder(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': info.size,
    'content-disposition': `attachment; filename="${e.arquivo.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(e.arquivo)}`,
    'cache-control': 'no-store',
  });
  createReadStream(caminho).pipe(res);
}

async function removerEntrega(res, id, dono) {
  const e = entregas.find((x) => x.id === id);
  if (!e) return responder(res, 404, '{"erro":"Entrega não encontrada"}');
  if (e.dono !== dono) return responder(res, 403, '{"erro":"Só quem enviou pode remover"}');
  entregas = entregas.filter((x) => x.id !== id);
  await unlink(join(PASTA_ENTREGAS, `frente-${e.frente}`, e.salvo)).catch(() => {});
  await salvarIndiceEntregas();
  transmitir();
  return responder(res, 200, JSON.stringify(publico()));
}

const mesmoNome = (a, b) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

function aplicar({ acao, vaga, nome, dono }) {
  if (!VAGAS.has(vaga)) return [400, 'Vaga inválida'];
  if (typeof dono !== 'string' || dono.length < 8 || dono.length > 64) return [400, 'Aparelho inválido'];
  if (acao === 'sair') {
    if (!estado.vagas[vaga]) return [200];
    delete estado.vagas[vaga];
    return [200];
  }
  if (acao !== 'entrar') return [400, 'Ação inválida'];
  nome = typeof nome === 'string' ? nome.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  if (nome.length < 2) return [400, 'Digite seu nome'];
  const atual = estado.vagas[vaga];
  if (atual && atual.dono !== dono && !mesmoNome(atual.nome, nome)) return [409, `Essa vaga já é de ${atual.nome}`];
  // Uma pessoa, uma vaga: sai de onde estava (mesmo aparelho ou mesmo nome).
  for (const [id, v] of Object.entries(estado.vagas))
    if (id !== vaga && (v.dono === dono || mesmoNome(v.nome, nome))) delete estado.vagas[id];
  estado.vagas[vaga] = { nome, dono, em: new Date().toISOString() };
  return [200];
}

const servidor = createServer(async (req, res) => {
  const [caminho, consulta = ''] = (req.url ?? '/').split('?');
  const params = new URLSearchParams(consulta);
  try {
    if (caminho === '/api/entregas' && req.method === 'POST') return await receberEntrega(req, res, params);
    const entrega = /^\/api\/entregas\/([a-z0-9]{6,20})$/.exec(caminho);
    if (entrega && req.method === 'GET') return await baixarEntrega(res, entrega[1]);
    if (entrega && req.method === 'DELETE') return await removerEntrega(res, entrega[1], params.get('dono') ?? '');

    // Documentos de cada frente: Word (documentos/gerar.mjs) e PDF (gerar-latex.mjs + compilar-pdf.sh).
    const doc = /^\/documentos\/(frente-[a-d]-(?:passo-a-passo|guia-do-projeto)\.(docx|pdf))$/.exec(caminho);
    if (doc && req.method === 'GET') {
      const conteudo = await readFile(join(PASTA, 'documentos', doc[1])).catch(() => null);
      if (!conteudo) return responder(res, 404, 'Documento não encontrado', 'text/plain; charset=utf-8');
      res.writeHead(200, {
        'content-type': doc[2] === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'content-disposition': `attachment; filename="${doc[1]}"`,
        'cache-control': 'no-store',
      });
      return res.end(conteudo);
    }

    // Prévia do link (WhatsApp etc.) e ícone da aba. Ficam em documentos/, que o container já enxerga.
    const imagem = { '/capa.jpg': 'image/jpeg', '/icone.png': 'image/png', '/demo.jpg': 'image/jpeg' }[caminho];
    if (imagem && req.method === 'GET') {
      const conteudo = await readFile(join(PASTA, 'documentos', caminho.slice(1))).catch(() => null);
      if (!conteudo) return responder(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
      return responder(res, 200, conteudo, imagem);
    }

    if (caminho === '/api/estado' && req.method === 'GET') return responder(res, 200, JSON.stringify(publico()));

    if (caminho === '/api/eventos' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      clientes.add(res);
      transmitir(); // avisa a todos o novo número de pessoas online
      const pulso = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => {
        clearInterval(pulso);
        clientes.delete(res);
        transmitir();
      });
      return;
    }

    if (caminho === '/api/vaga' && req.method === 'POST') {
      let tamanho = 0;
      const partes = [];
      for await (const parte of req) {
        tamanho += parte.length;
        if (tamanho > LIMITE) return responder(res, 413, '{"erro":"grande demais"}');
        partes.push(parte);
      }
      const pedido = JSON.parse(Buffer.concat(partes).toString('utf8'));
      const [status, erro] = aplicar(pedido ?? {});
      if (status === 200) {
        salvar();
        console.log(`${new Date().toLocaleTimeString('pt-BR')} ${pedido.acao} ${pedido.vaga} ${pedido.nome ?? ''}`.trim());
      }
      return responder(res, status, JSON.stringify({ erro, ...publico() }));
    }

    const ARQUIVOS = {
      '/': ['divisao.html', 'text/html; charset=utf-8'],
      '/divisao.html': ['divisao.html', 'text/html; charset=utf-8'],
      '/divisao.md': ['divisao.md', 'text/markdown; charset=utf-8'],
    };
    const arquivo = req.method === 'GET' ? ARQUIVOS[caminho] : undefined;
    if (!arquivo) return responder(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    const conteudo = await readFile(join(PASTA, arquivo[0])).catch(() => null);
    if (!conteudo) return responder(res, 404, 'Ainda não há escolhas', 'text/plain; charset=utf-8');
    return responder(res, 200, conteudo, arquivo[1]);
  } catch (e) {
    console.error('erro:', e.message);
    return responder(res, 500, '{"erro":"falha no servidor"}');
  }
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`Divisão de funções em http://0.0.0.0:${PORTA}  (escolhas em ${PASTA}/divisao.md)`);
});
