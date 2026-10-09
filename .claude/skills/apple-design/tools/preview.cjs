#!/usr/bin/env node
// Serve um site como o painel serve (em /{slug}/, com suporte a Range para vídeo) e tira capturas
// ao longo da rolagem, no computador e no celular, avisando de erros do navegador.
//   node preview.cjs sites/meu-site                 -> capturas em ./shots (8 pontos da rolagem)
//   node preview.cjs sites/meu-site --out /tmp/x --steps 12
//   node preview.cjs sites/meu-site --serve         -> só o servidor, em http://127.0.0.1:4173/meu-site/
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : args[i + 1]; };
const dir = path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : ".");
const slug = path.basename(dir), out = path.resolve(opt("out", "shots")), steps = Number(opt("steps", 8)), port = Number(opt("port", 4173));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".webm": "video/webm", ".webmanifest": "application/manifest+json" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/" + slug) { res.writeHead(301, { Location: `/${slug}/` }); return res.end(); }
  if (!url.startsWith(`/${slug}/`)) { res.writeHead(404); return res.end("fora do site"); }
  let file = path.join(dir, url.slice(slug.length + 2));
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Arquivo não encontrado."); }
  const size = fs.statSync(file).size, head = { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m) {
    const start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, "Content-Length": size });
  fs.createReadStream(file).pipe(res);
});

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const npx = path.join(os.homedir(), ".npm", "_npx");
  for (const d of fs.existsSync(npx) ? fs.readdirSync(npx) : []) {
    try { return require(path.join(npx, d, "node_modules", "playwright")); } catch {}
  }
  return null;
}

server.listen(port, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${port}/${slug}/`;
  if (args.includes("--serve")) return console.log("servindo", base);
  const pw = loadPlaywright();
  if (!pw) { console.error("playwright não encontrado: rode `npx playwright install chromium` ou use --serve e abra", base); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  let problems = 0;
  for (const [name, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const log = (kind, text) => { problems++; console.log(`[${name}] ${kind}: ${text}`); };
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log(m.type(), m.text()); });
    page.on("pageerror", (e) => log("erro", e.message));
    page.on("requestfailed", (r) => log("falhou", r.url()));
    page.on("response", (r) => { if (r.status() >= 400) log(String(r.status()), r.url()); });
    await page.goto(base, { waitUntil: "load" });
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, wide: document.documentElement.scrollWidth - innerWidth,
      fx: document.getElementById("fx") ? document.getElementById("fx").classList.contains("on") : null }));
    if (info.wide > 1) log("layout", `a página passa ${info.wide}px da largura da tela (rolagem horizontal)`);
    if (info.fx === false) log("webgl", "o canvas #fx existe mas não ligou");
    for (let i = 0; i < steps; i++) {
      const y = Math.round(info.max * i / Math.max(1, steps - 1));
      await page.evaluate((top) => scrollTo(0, top), y);
      await page.waitForTimeout(1300);     // deixa a inércia das formas e as entradas assentarem
      await page.screenshot({ path: path.join(out, `${name}-${String(i).padStart(2, "0")}.png`) });
    }
    console.log(`[${name}] ${steps} capturas, página com ${info.max + viewport.height}px de altura`);
    await page.close();
  }
  await browser.close();
  server.close();
  console.log(problems ? `${problems} aviso(s) acima — capturas em ${out}` : `sem erros — capturas em ${out}`);
});
