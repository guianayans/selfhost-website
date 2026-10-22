// Roteador do site de demonstração do Estadia.
//
// Ninguém altera o banco de demonstração. Ele vira um MODELO (estadia_modelo) em que nenhum usuário
// se conecta. Cada navegador ganha um cookie (estadia_visita) e, na primeira chamada à API, uma
// cópia só dele desse modelo, com um processo da API ligado a ela. Assim tudo funciona e é clicável,
// mas o que a pessoa faz fica só na cópia dela: apagou os cookies, volta tudo como era antes.
// Cópias sem uso há GUARDAR_DIAS dias são apagadas; processos parados há OCIOSO_MIN minutos são
// desligados (e voltam, com os dados, quando a pessoa volta).
//
// Não há tela de login: o roteador entra como admin sozinho e entra de novo se a sessão cair.
// Uma vez por dia o modelo é refeito (seed + uma semana de movimento até hoje), para a demonstração
// não envelhecer; quem já tem cópia continua com a sua (o botão "Recomeçar do zero" pega a nova).
//
// Sem dependências além das da própria API (usa o pg de /app/node_modules). Node 20+.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';

const APP = '/app';
const WEB = join(APP, 'web');
const pg = createRequire(join(APP, 'package.json'))('pg');

const env = process.env;
const PORTA = Number(env.PORTA ?? 8080);
const BANCO_HOST = env.BANCO_HOST ?? 'estadia-db:5432';
const DONO = `postgres://${env.BANCO_DONO}:${encodeURIComponent(env.BANCO_DONO_SENHA)}@${BANCO_HOST}`;
const APP_USER = env.DB_APP_USER ?? 'hotel_app';
const APP_SENHA = env.DB_APP_PASSWORD;
const SENHA_DEMO = env.SEED_DEMO_SENHA;
const LOGIN_DEMO = env.DEMO_LOGIN ?? 'admin';
const MAX_PROCESSOS = Number(env.MAX_PROCESSOS ?? 12);
const OCIOSO_MIN = Number(env.OCIOSO_MIN ?? 15);
const GUARDAR_DIAS = Number(env.GUARDAR_DIAS ?? 7);
const MAX_COPIAS = Number(env.MAX_COPIAS ?? 300);
const DADOS = env.DADOS_DIR ?? '/dados';
const MODELO = 'estadia_modelo';
const VERSAO_MODELO = 'v2-funcionarios'; // mudou ⇒ o modelo é refeito (contas e perfis novos)
const COOKIE = 'estadia_visita';
const PREFIXO = '/estadia'; // caminho público (o Traefik tira antes de chegar aqui)

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[roteador]', ...a);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const nomeBanco = (id) => `demo_${id}`;
const idValido = (id) => typeof id === 'string' && /^[0-9a-f]{20}$/.test(id);

// ---------- banco (como dono, só para criar/apagar cópias e o modelo) ----------
const admin = new pg.Pool({ connectionString: `${DONO}/postgres`, max: 3 });
let fila = Promise.resolve();
/** Operações de banco que não podem rodar juntas (copiar do modelo, trocar o modelo). */
const emFila = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => {}); return p; };
const bancoExiste = async (nome) => (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome])).rowCount > 0;
async function apagarBanco(nome) {
  await admin.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
}

// Env comum dos processos da API e do migrador
const ENV_APP = {
  PATH: env.PATH,
  TZ: 'America/Sao_Paulo',
  APP_ENV: 'development',
  TLS_MODE: 'off',
  WEB_DIST_DIR: WEB,
  HOTEL_NOME: env.HOTEL_NOME ?? 'Pousada Estadia',
  AUTH_LIMITE_POR_MINUTO: '1000',
  LOG_LEVEL: env.LOG_LEVEL_API ?? 'warn',
};

function rodar(cmd, args, extra, rotulo) {
  return new Promise((ok, falhou) => {
    const p = spawn(cmd, args, { cwd: APP, env: { ...ENV_APP, ...extra }, stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? ok() : falhou(new Error(`${rotulo} saiu com código ${c}`))));
  });
}

// ---------- funcionários da demonstração (perfis e contas por cima do seed do app) ----------
// Um perfil por tipo de funcionário, com os menus já configurados pelas permissões. Os do seed do
// app (Recepção, Governança, Financeiro, Gerência, Administrador) ficam; a Governança vira a
// Governanta (supervisão da limpeza) e entram Camareira/Limpeza e Manutenção.
const PERFIS_NOVOS = [
  { codigo: 'LIMPEZA', nome: 'Camareira / Limpeza', permissoes: ['quarto.ver_mapa', 'quarto.governanca', 'folio.lancar'] },
  { codigo: 'MANUTENCAO', nome: 'Manutenção', permissoes: ['quarto.ver_mapa', 'quarto.bloquear'] },
];
const GOVERNANTA_MAIS = ['quarto.bloquear', 'estoque.movimentar'];
const CONTAS_NOVAS = [
  { login: 'limpeza', nome: 'Lia Limpeza', perfil: 'LIMPEZA', pin: '6047' },
  { login: 'manutencao', nome: 'Mário Manutenção', perfil: 'MANUTENCAO', pin: '3918' },
];
const argon2 = createRequire(join(APP, 'package.json'))('@node-rs/argon2');
const hashArgon = (segredo) => argon2.hash(segredo, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });

/** Idempotente: cria o que faltar e não desfaz ajustes já feitos no banco. */
async function garantirFuncionarios(banco) {
  const c = new pg.Client({ connectionString: `${DONO}/${banco}` });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.terminal', 'demo-roteador', true), set_config('app.motivo', 'site de demonstração: funcionários de cada tipo', true)");
    for (const p of PERFIS_NOVOS) {
      await c.query('INSERT INTO perfil (codigo, nome, sistema) VALUES ($1, $2, true) ON CONFLICT (codigo) DO NOTHING', [p.codigo, p.nome]);
      await c.query(
        `INSERT INTO perfil_permissao (perfil_id, permissao_codigo, modo)
         SELECT p.id, x, 'PERMITIDO' FROM perfil p, unnest($2::text[]) AS x WHERE p.codigo = $1
         ON CONFLICT DO NOTHING`,
        [p.codigo, p.permissoes],
      );
    }
    await c.query("UPDATE perfil SET nome = 'Governanta' WHERE codigo = 'GOVERNANCA' AND nome = 'Governança'");
    await c.query(
      `INSERT INTO perfil_permissao (perfil_id, permissao_codigo, modo)
       SELECT p.id, x, 'PERMITIDO' FROM perfil p, unnest($1::text[]) AS x WHERE p.codigo = 'GOVERNANCA'
       ON CONFLICT DO NOTHING`,
      [GOVERNANTA_MAIS],
    );
    await c.query("UPDATE usuario SET nome = 'Gabi Governanta' WHERE login = 'governanca' AND nome = 'Gabi Governança'");
    for (const u of CONTAS_NOVAS) {
      const existe = await c.query('SELECT 1 FROM usuario WHERE lower(login) = $1', [u.login]);
      if (existe.rowCount) continue;
      const [senha, pin] = await Promise.all([hashArgon(SENHA_DEMO), hashArgon(u.pin)]);
      await c.query(
        `INSERT INTO usuario (login, nome, perfil_id, senha_hash, pin_hash, origem, deve_trocar_senha)
         SELECT $1, $2, id, $3, $4, 'DEMO', false FROM perfil WHERE codigo = $5`,
        [u.login, u.nome, senha, pin, u.perfil],
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

/** Funcionários de demonstração da cópia (com perfil e permissões reais do banco dela). */
async function listarFuncionarios(banco) {
  const c = new pg.Client({ connectionString: `${DONO}/${banco}` });
  await c.connect();
  try {
    const r = await c.query(`
      SELECT u.login, u.nome, p.codigo AS perfil, p.nome AS perfil_nome,
             coalesce(array_agg(pp.permissao_codigo ORDER BY pp.permissao_codigo) FILTER (WHERE pp.permissao_codigo IS NOT NULL), '{}') AS permissoes
        FROM usuario u
        JOIN perfil p ON p.id = u.perfil_id
        LEFT JOIN perfil_permissao pp ON pp.perfil_id = p.id
       WHERE u.origem = 'DEMO' AND u.ativo AND p.ativo
       GROUP BY u.login, u.nome, p.codigo, p.nome`);
    return r.rows.map((x) => ({ login: x.login, nome: x.nome, perfil: { codigo: x.perfil, nome: x.perfil_nome }, permissoes: x.permissoes }));
  } finally {
    await c.end();
  }
}

// ---------- processos da API ----------
const portasUsadas = new Set();
const livrePorta = () => { for (let p = 9100; p < 9900; p++) if (!portasUsadas.has(p)) { portasUsadas.add(p); return p; } throw new Error('sem portas'); };

function iniciarApi(banco, rotulo) {
  const porta = livrePorta();
  const dir = `/tmp/api/${rotulo}`;
  const proc = spawn(process.execPath, ['--enable-source-maps', 'dist/server.js'], {
    cwd: APP,
    env: {
      ...ENV_APP,
      HTTP_PORT: String(porta),
      HOST: '127.0.0.1',
      DATABASE_URL: `postgres://${APP_USER}:${encodeURIComponent(APP_SENHA)}@${BANCO_HOST}/${banco}`,
      TRUSTED_PROXIES: '127.0.0.1',
      CERTS_DIR: `${dir}/certs`,
      BACKUPS_DIR: `${dir}/backups`,
      RESTAURACAO_DIR: `${dir}/restauracao`,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const api = { porta, proc, vivo: true };
  proc.on('exit', () => { api.vivo = false; portasUsadas.delete(porta); });
  api.pronto = (async () => {
    for (let i = 0; i < 120; i++) {
      if (!api.vivo) throw new Error(`a API de ${rotulo} não subiu`);
      const ok = await new Promise((r) => {
        const q = http.get({ host: '127.0.0.1', port: porta, path: '/api/health', timeout: 1000 }, (res) => { res.resume(); r(res.statusCode === 200); });
        q.on('error', () => r(false));
        q.on('timeout', () => { q.destroy(); r(false); });
      });
      if (ok) return;
      await esperar(250);
    }
    throw new Error(`a API de ${rotulo} não respondeu`);
  })();
  return api;
}
async function pararApi(api) {
  if (!api?.vivo) return;
  api.proc.kill('SIGTERM');
  for (let i = 0; i < 40 && api.vivo; i++) await esperar(100);
  if (api.vivo) api.proc.kill('SIGKILL');
}

// ---------- o modelo (o "banco de demonstração", que ninguém altera) ----------
let modeloPronto = null;
async function dataDoModelo() {
  const r = await admin.query("SELECT shobj_description(oid, 'pg_database') AS d FROM pg_database WHERE datname = $1", [MODELO]);
  return r.rows[0]?.d ?? null;
}
async function construirModelo() {
  const novo = `${MODELO}_novo`;
  log('montando o modelo da demonstração (seed + uma semana de movimento)…');
  await apagarBanco(novo);
  await admin.query(`CREATE DATABASE "${novo}"`);
  await rodar(process.execPath, ['dist/migrar.js'], {
    DATABASE_OWNER_URL: `${DONO}/${novo}`,
    DB_APP_USER: APP_USER,
    DB_APP_PASSWORD: APP_SENHA,
    SEED_DEMO: 'true',
    SEED_DEMO_MODELO: env.SEED_DEMO_MODELO ?? 'um_andar',
    SEED_DEMO_SENHA: SENHA_DEMO,
  }, 'migrar');
  await garantirFuncionarios(novo);
  const api = iniciarApi(novo, 'modelo');
  try {
    await api.pronto;
    await rodar(process.execPath, ['/site/simulador.mjs'], { ESTADIA_URL: `http://127.0.0.1:${api.porta}`, SEED_DEMO_SENHA: SENHA_DEMO }, 'simulador');
  } finally {
    await pararApi(api);
  }
  // Sessão longa e sem bloqueio por inatividade: na demonstração não há tela de login nem de PIN.
  const c = new pg.Client({ connectionString: `${DONO}/${novo}` });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.terminal', 'demo-roteador', true), set_config('app.motivo', 'site de demonstração: sem bloqueio de tela', true)");
    await c.query(`UPDATE parametro_sistema SET valor = to_jsonb(v.valor) FROM (VALUES
      ('sessao_duracao_horas', 8760), ('sessao_inatividade_minutos', 525600), ('sessao_inatividade_movel_minutos', 525600)) AS v(chave, valor)
      WHERE parametro_sistema.chave = v.chave`);
    await c.query('COMMIT');
  } finally {
    await c.end();
  }
  await emFila(async () => {
    const velho = `${MODELO}_velho`;
    await apagarBanco(velho);
    if (await bancoExiste(MODELO)) {
      await admin.query(`ALTER DATABASE "${MODELO}" WITH IS_TEMPLATE false`);
      await admin.query(`ALTER DATABASE "${MODELO}" RENAME TO "${velho}"`);
    }
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [novo]);
    await admin.query(`ALTER DATABASE "${novo}" RENAME TO "${MODELO}"`);
    // Ninguém se conecta ao modelo: ele só serve de origem para as cópias.
    await admin.query(`ALTER DATABASE "${MODELO}" WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`);
    await admin.query(`COMMENT ON DATABASE "${MODELO}" IS '${hoje()} ${VERSAO_MODELO}'`);
    await apagarBanco(velho);
  });
  log(`modelo pronto (${hoje()} ${VERSAO_MODELO})`);
}
async function conferirModelo() {
  const data = (await bancoExiste(MODELO)) ? await dataDoModelo() : null;
  if (data === `${hoje()} ${VERSAO_MODELO}`) return;
  if (!data) await construirModelo(); // sem modelo: as cópias esperam
  else construirModelo().catch((e) => log('falha ao refazer o modelo (segue o anterior):', e.message));
}

// ---------- visitas (uma por cookie) ----------
const ARQ_VISITAS = join(DADOS, 'visitas.json');
let registro = {}; // id → { criada, uso } (persistido: as cópias continuam depois de reiniciar)
const visitas = new Map(); // id → { api, jar, ativos, uso, preparo }
let salvarT = null;
function salvarRegistro() {
  clearTimeout(salvarT);
  salvarT = setTimeout(async () => {
    await writeFile(`${ARQ_VISITAS}.tmp`, JSON.stringify(registro));
    await rename(`${ARQ_VISITAS}.tmp`, ARQ_VISITAS);
  }, 2000);
}
function marcarUso(id) {
  const agora = Date.now();
  const v = visitas.get(id);
  if (v) v.uso = agora;
  if (registro[id] && agora - registro[id].uso > 60_000) { registro[id].uso = agora; salvarRegistro(); }
}

async function prepararVisita(id) {
  let v = visitas.get(id);
  if (!v) { v = { api: null, jar: {}, ativos: 0, uso: Date.now(), preparo: null }; visitas.set(id, v); }
  if (v.api?.vivo) { await v.api.pronto; return v; }
  v.preparo ??= (async () => {
    await modeloPronto;
    const banco = nomeBanco(id);
    if (!registro[id] || !(await bancoExiste(banco))) {
      await emFila(async () => {
        if (await bancoExiste(banco)) return;
        await admin.query(`CREATE DATABASE "${banco}" TEMPLATE "${MODELO}"`);
        await admin.query(`REVOKE ALL ON DATABASE "${banco}" FROM PUBLIC`);
        await admin.query(`GRANT CONNECT, TEMPORARY ON DATABASE "${banco}" TO "${APP_USER}"`);
      });
      registro[id] = { criada: Date.now(), uso: Date.now() };
      salvarRegistro();
      log(`nova cópia ${id} (${Object.keys(registro).length} no total)`);
    }
    await garantirFuncionarios(banco); // cópias antigas ganham os funcionários novos
    v.login ??= registro[id]?.login ?? LOGIN_DEMO;
    await abrirVaga(id);
    v.api = iniciarApi(banco, id);
    v.jar = {};
    await v.api.pronto;
    await entrar(v);
  })().finally(() => { v.preparo = null; });
  await v.preparo;
  return v;
}
/** Respeita o limite de processos: desliga o que está há mais tempo sem uso. */
async function abrirVaga(id) {
  const vivos = [...visitas.entries()].filter(([k, v]) => k !== id && v.api?.vivo);
  if (vivos.length < MAX_PROCESSOS) return;
  vivos.sort((a, b) => a[1].uso - b[1].uso);
  log(`limite de ${MAX_PROCESSOS} processos: desligando ${vivos[0][0]}`);
  await pararApi(vivos[0][1].api);
}
async function apagarVisita(id) {
  const v = visitas.get(id);
  visitas.delete(id);
  await pararApi(v?.api);
  await emFila(() => apagarBanco(nomeBanco(id)));
  delete registro[id];
  salvarRegistro();
}

// ---------- cookies e sessão (o navegador nunca vê a senha nem o token da API) ----------
function lerCookies(cab = '') {
  const c = {};
  for (const parte of cab.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) c[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return c;
}
const cookieVisita = (id) => `${COOKIE}=${id}; Path=${PREFIXO}; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
const DA_API = /^hotel_/; // cookies da API (sessão, terminal): ficam guardados aqui, por visita

/** Separa os Set-Cookie da API: os de sessão vão para o "pote" da visita; os outros seguem com o caminho certo. */
function tratarSetCookie(v, lista = []) {
  const saida = [];
  for (const sc of [].concat(lista)) {
    const [par, ...attrs] = sc.split(';');
    const i = par.indexOf('=');
    const nome = par.slice(0, i).trim(), valor = par.slice(i + 1).trim();
    if (DA_API.test(nome)) {
      const apagar = !valor || attrs.some((a) => /^\s*max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (apagar) delete v.jar[nome]; else v.jar[nome] = valor;
    } else saida.push(sc.replace(/;\s*path=\/[^;]*/i, `; Path=${PREFIXO}`));
  }
  return saida;
}
function cabecalhosParaApi(req, v, extra = {}) {
  const h = { ...req.headers, ...extra };
  delete h.host;
  const outros = Object.entries(lerCookies(req.headers.cookie)).filter(([k]) => k !== COOKIE && !DA_API.test(k));
  const todos = [...outros, ...Object.entries(v.jar)].map(([k, val]) => `${k}=${val}`).join('; ');
  if (todos) h.cookie = todos; else delete h.cookie;
  h['x-forwarded-for'] = [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ');
  return h;
}

/** Faz a requisição à API da visita. Responde em buffer quando é preciso olhar o corpo (sessão, 401). */
function pedir(v, metodo, caminho, cabecalhos, corpo, olhar) {
  return new Promise((ok, falhou) => {
    const q = http.request({ host: '127.0.0.1', port: v.api.porta, method: metodo, path: caminho, headers: cabecalhos }, (res) => {
      res.headers['set-cookie'] = tratarSetCookie(v, res.headers['set-cookie']);
      if (!olhar(res)) return ok({ res });
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => ok({ res, corpo: Buffer.concat(partes) }));
      res.on('error', falhou);
    });
    q.on('error', falhou);
    q.end(corpo);
  });
}
async function entrar(v) {
  const corpo = JSON.stringify({ login: v.login ?? LOGIN_DEMO, senha: SENHA_DEMO });
  const r = await pedir(v, 'POST', '/api/v1/auth/login', {
    'content-type': 'application/json', 'content-length': Buffer.byteLength(corpo),
    ...(Object.keys(v.jar).length ? { cookie: Object.entries(v.jar).map(([k, x]) => `${k}=${x}`).join('; ') } : {}),
  }, corpo, () => true);
  if (r.res.statusCode >= 300) throw new Error(`login automático falhou (${r.res.statusCode}): ${r.corpo}`);
}
/** A sessão caiu, expirou, foi bloqueada ou a pessoa clicou em "Sair": entra de novo com o funcionário escolhido. */
function precisaEntrar(caminho, r) {
  if (!r.corpo) return false;
  let j;
  try { j = JSON.parse(r.corpo.toString('utf8')); } catch { return false; }
  if (r.res.statusCode === 401) return ['NAO_AUTENTICADO', 'SESSAO_BLOQUEADA'].includes(j?.codigo ?? j?.erro?.codigo);
  if (caminho.startsWith('/api/v1/auth/sessao')) return j?.autenticado === false || j?.status === 'BLOQUEADA';
  return false;
}

// ---------- arquivos do site (com a faixa "demonstração") ----------
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};
// Camada da demonstração (sites/estadia/demo-camada.{js,css}): aviso, troca de funcionário,
// comparação de menus e menu lateral recolhível — por cima do app, sem mudar o pacote dele.
const FAIXA = `<link rel="stylesheet" href="${PREFIXO}/__demo/camada.css">
<script src="${PREFIXO}/__demo/camada.js" defer></script>`;
// A logo da equipe (a mesma da página da equipe e do questionário) no lugar da chave do app:
// marca.svg aparece no carregamento, no menu e nos cartões; os outros são os ícones do navegador.
const MARCA = '/site/marca';
const DA_MARCA = {
  '/marca.svg': 'marca.svg', '/favicon.svg': 'marca.svg',
  '/apple-touch-icon.png': 'pwa/apple-touch-icon.png', '/apple-touch-icon-precomposed.png': 'pwa/apple-touch-icon.png',
  '/pwa/apple-touch-icon.png': 'pwa/apple-touch-icon.png', '/pwa/icon-32.png': 'pwa/icon-32.png', '/pwa/icon-48.png': 'pwa/icon-48.png',
  '/pwa/icon-96.png': 'pwa/icon-96.png', '/pwa/icon-192.png': 'pwa/icon-192.png', '/pwa/icon-512.png': 'pwa/icon-512.png',
  '/pwa/maskable-512.png': 'pwa/maskable-512.png',
};
let indexCache = null;
async function servirArquivo(req, res, caminho) {
  let rel;
  try { rel = normalize(decodeURIComponent(caminho.split('?')[0])).replace(/^(\.\.[/\\])+/, ''); } catch { rel = '/'; }
  // Mapas de código-fonte (.map) não saem: trazem o código do app, que é privado.
  if (rel.endsWith('.map')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Não encontrado');
  }
  const marca = DA_MARCA[rel] && join(MARCA, DA_MARCA[rel]);
  let arq = marca && existsSync(marca) ? marca : join(WEB, rel);
  if (!arq.startsWith(WEB) && !arq.startsWith(MARCA)) arq = join(WEB, 'index.html');
  let info = existsSync(arq) ? statSync(arq) : null;
  if (!info || info.isDirectory()) { arq = join(WEB, 'index.html'); info = statSync(arq); }
  const tipo = TIPOS[extname(arq)] ?? 'application/octet-stream';
  if (arq.endsWith('index.html')) {
    indexCache ??= (await readFile(arq, 'utf8'))
      .replace(/(<link\s+rel="apple-touch-icon"\s+sizes="180x180"\s+href=")data:image\/png;base64,[^"]+"/, `$1${PREFIXO}/pwa/apple-touch-icon.png"`)
      .replace('</body>', `${FAIXA}\n</body>`);
    res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-cache' });
    return res.end(indexCache);
  }
  const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'content-type': tipo, 'content-length': info.size, 'cache-control': cache });
  createReadStream(arq).pipe(res);
}

// ---------- servidor ----------
const servidor = http.createServer(async (req, res) => {
  const caminho = req.url ?? '/';
  const cookies = lerCookies(req.headers.cookie);
  let id = cookies[COOKIE];
  if (!idValido(id)) {
    id = randomBytes(10).toString('hex');
    res.setHeader('set-cookie', cookieVisita(id));
  }
  try {
    if (caminho === '/__demo/recomecar' && req.method === 'POST') {
      await apagarVisita(id);
      const novo = randomBytes(10).toString('hex');
      res.writeHead(200, { 'set-cookie': cookieVisita(novo), 'content-type': 'application/json' });
      return res.end('{"ok":true}');
    }
    if (caminho === '/__demo/camada.js' || caminho === '/__demo/camada.css') {
      const arq = join('/site', caminho.endsWith('.js') ? 'demo-camada.js' : 'demo-camada.css');
      res.writeHead(200, { 'content-type': caminho.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', 'cache-control': 'no-cache' });
      return createReadStream(arq).pipe(res);
    }
    if (caminho === '/__demo/funcionarios' && req.method === 'GET') {
      const v = await prepararVisita(id);
      const lista = await listarFuncionarios(nomeBanco(id));
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ atual: v.login ?? LOGIN_DEMO, funcionarios: lista }));
    }
    if (caminho === '/__demo/entrar' && req.method === 'POST') {
      const partes = [];
      for await (const p of req) partes.push(p);
      const { login } = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
      const v = await prepararVisita(id);
      const lista = await listarFuncionarios(nomeBanco(id));
      if (!lista.some((f) => f.login === login)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ codigo: 'FUNCIONARIO_INVALIDO', mensagem: 'Funcionário não encontrado nesta demonstração.' }));
      }
      // sai da sessão atual e entra com o funcionário escolhido (a senha pública fica só aqui)
      await pedir(v, 'POST', '/api/v1/auth/logout', cabecalhosParaApi({ headers: {}, socket: req.socket }, v), '', () => true).catch(() => {});
      v.login = login;
      registro[id] = { ...registro[id], login };
      salvarRegistro();
      await entrar(v);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, login }));
    }
    if (caminho === '/__demo/saude') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ modelo: await dataDoModelo().catch(() => null), copias: Object.keys(registro).length, processos: [...visitas.values()].filter((v) => v.api?.vivo).length }));
    }
    if (!caminho.startsWith('/api/')) return await servirArquivo(req, res, caminho);

    const partes = [];
    for await (const p of req) partes.push(p);
    const corpo = Buffer.concat(partes);
    const v = await prepararVisita(id);
    v.ativos++;
    marcarUso(id);
    res.on('close', () => { v.ativos--; marcarUso(id); });
    const olhar = (r) => r.statusCode === 401 || caminho.startsWith('/api/v1/auth/sessao');
    let r = await pedir(v, req.method, caminho, cabecalhosParaApi(req, v), corpo, olhar);
    if (precisaEntrar(caminho, r)) {
      await entrar(v);
      r = await pedir(v, req.method, caminho, cabecalhosParaApi(req, v), corpo, olhar);
    }
    const cab = { ...r.res.headers };
    const meus = [].concat(res.getHeader('set-cookie') ?? []);
    cab['set-cookie'] = [...meus, ...(cab['set-cookie'] ?? [])];
    if (!cab['set-cookie'].length) delete cab['set-cookie'];
    if (r.corpo) {
      cab['content-length'] = r.corpo.length;
      delete cab['transfer-encoding'];
      res.writeHead(r.res.statusCode, cab);
      return res.end(r.corpo);
    }
    res.writeHead(r.res.statusCode, cab);
    r.res.pipe(res);
  } catch (e) {
    log('erro:', e.message);
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '3' });
    res.end(JSON.stringify({ codigo: 'DEMO_INDISPONIVEL', mensagem: 'A demonstração está preparando a sua cópia. Tente de novo em instantes.' }));
  }
});
servidor.requestTimeout = 0; // SSE (tempo real) fica aberto
servidor.headersTimeout = 60_000;

// ---------- faxina ----------
setInterval(async () => {
  const agora = Date.now();
  for (const [id, v] of visitas)
    if (v.api?.vivo && v.ativos <= 0 && agora - v.uso > OCIOSO_MIN * 60_000) { log(`desligando ${id} (parado)`); await pararApi(v.api); }
  const velhas = Object.entries(registro).sort((a, b) => a[1].uso - b[1].uso);
  for (const [i, [id, r]] of velhas.entries())
    if (agora - r.uso > GUARDAR_DIAS * 86_400_000 || velhas.length - i > MAX_COPIAS) { log(`apagando a cópia ${id} (sem uso)`); await apagarVisita(id).catch(() => {}); }
}, 60_000);
setInterval(() => conferirModelo().catch((e) => log('modelo:', e.message)), 60 * 60_000);

for (const s of ['SIGTERM', 'SIGINT'])
  process.on(s, async () => {
    log('encerrando');
    await Promise.all([...visitas.values()].map((v) => pararApi(v.api)));
    process.exit(0);
  });

// ---------- início ----------
await mkdir(DADOS, { recursive: true });
try { registro = JSON.parse(await readFile(ARQ_VISITAS, 'utf8')); } catch {}
servidor.listen(PORTA, '0.0.0.0', () => log(`ouvindo na porta ${PORTA} · ${Object.keys(registro).length} cópias guardadas`));
modeloPronto = conferirModelo();
modeloPronto.catch((e) => { log('não deu para montar o modelo:', e.message); process.exit(1); });
