// Servidor do questionário: entrega a página e grava as respostas NA PASTA DO HTML, em tempo real.
//   node questionario/servidor.mjs            → http://<ip-da-máquina>:8090
//   PORTA=9000 node questionario/servidor.mjs
// Sem dependências (Node 18+). Grava respostas.md (legível) e respostas.json (para reabrir/continuar).
// A página detecta sozinha que está neste servidor e salva a cada alteração; aberta como arquivo
// ou num servidor só de arquivos, ela continua funcionando (salva no aparelho/arquivo escolhido).
import { createServer } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 8090);
const LIMITE = 512 * 1024; // respostas cabem com folga; evita abuso
const ARQUIVOS = {
  '/': ['questionario.html', 'text/html; charset=utf-8'],
  '/questionario.html': ['questionario.html', 'text/html; charset=utf-8'],
  '/estilo.css': ['estilo.css', 'text/css; charset=utf-8'],
  '/capa.jpg': ['capa.jpg', 'image/jpeg'], // prévia do link no WhatsApp
  '/respostas.md': ['respostas.md', 'text/markdown; charset=utf-8'],
};

/** Grava de forma atômica (arquivo temporário + rename): nunca fica um arquivo pela metade. */
async function gravar(nome, conteudo) {
  const destino = join(PASTA, nome);
  await writeFile(`${destino}.tmp`, conteudo, 'utf8');
  await rename(`${destino}.tmp`, destino);
}

function responder(res, status, corpo, tipo = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': tipo, 'cache-control': 'no-store' });
  res.end(corpo);
}

const servidor = createServer(async (req, res) => {
  const caminho = (req.url ?? '/').split('?')[0];
  try {
    if (caminho === '/api/respostas' && req.method === 'GET') {
      const json = await readFile(join(PASTA, 'respostas.json'), 'utf8').catch(() => '{}');
      return responder(res, 200, json);
    }
    if (caminho === '/api/respostas' && req.method === 'PUT') {
      let tamanho = 0;
      const partes = [];
      for await (const parte of req) {
        tamanho += parte.length;
        if (tamanho > LIMITE) return responder(res, 413, '{"erro":"grande demais"}');
        partes.push(parte);
      }
      const { estado, markdown } = JSON.parse(Buffer.concat(partes).toString('utf8'));
      if (typeof estado !== 'object' || estado === null || typeof markdown !== 'string')
        return responder(res, 400, '{"erro":"formato inválido"}');
      await gravar('respostas.json', JSON.stringify(estado, null, 2));
      await gravar('respostas.md', markdown);
      console.log(
        `${new Date().toLocaleTimeString('pt-BR')} respostas salvas (${Object.keys(estado).length} campos)`,
      );
      return responder(res, 200, `{"salvoEm":"${new Date().toISOString()}"}`);
    }
    // Fotos do hotel (.webp) e o ícone da aba (icone.png): só nomes simples dentro de imagens/.
    const foto = /^\/imagens\/(?:[a-z0-9-]+\.webp|icone\.png)$/.exec(caminho);
    const arquivo =
      req.method !== 'GET'
        ? undefined
        : foto
          ? [caminho.slice(1), caminho.endsWith('.png') ? 'image/png' : 'image/webp']
          : ARQUIVOS[caminho];
    if (!arquivo) return responder(res, 404, 'Não encontrado', 'text/plain; charset=utf-8');
    const conteudo = await readFile(join(PASTA, arquivo[0])).catch(() => null);
    if (!conteudo)
      return responder(res, 404, 'Ainda não há respostas', 'text/plain; charset=utf-8');
    return responder(res, 200, conteudo, arquivo[1]);
  } catch (e) {
    console.error('erro:', e.message);
    return responder(res, 500, '{"erro":"falha ao salvar"}');
  }
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`Questionário em http://0.0.0.0:${PORTA}  (respostas em ${PASTA}/respostas.md)`);
});
