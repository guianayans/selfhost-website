// Coletor público do analytics do /bio: POST /api/bio/track (a página manda com sendBeacon).
// Guarda só o necessário: nada de IP, e o texto de cada campo é cortado e validado.

import { now, run } from "./db.js";
import { clientIp, rateLimit, readJson } from "./http.js";

const TYPES = new Set(["view", "click", "leave", "music", "ui"]);
const ID = /^[a-z0-9]{8,32}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|curl|wget|python|node-fetch/i;

const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v, min, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : null);

function device(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "Tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "Celular";
  return "Computador";
}

function os(ua) {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Outro";
}

function browser(ua) {
  if (/instagram/i.test(ua)) return "Instagram (app)";
  if (/fban|fbav/i.test(ua)) return "Facebook (app)";
  if (/musical_ly|bytedancewebview|tiktok/i.test(ua)) return "TikTok (app)";
  if (/linkedinapp/i.test(ua)) return "LinkedIn (app)";
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Outro";
}

// De onde a pessoa veio: app que abriu o link (o Instagram não manda referrer), utm_source ou o site anterior
function source(ua, ref, utm) {
  if (utm) return utm.toLowerCase().replace(/^ig$/, "instagram").replace(/^\w/, (c) => c.toUpperCase());
  if (/instagram/i.test(ua)) return "Instagram";
  if (/fban|fbav/i.test(ua)) return "Facebook";
  if (/musical_ly|bytedancewebview|tiktok/i.test(ua)) return "TikTok";
  if (/linkedinapp/i.test(ua)) return "LinkedIn";
  if (!ref) return "Direto";
  let host = "";
  try {
    host = new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return "Direto";
  }
  const known = [
    [/instagram\.com$/, "Instagram"],
    [/facebook\.com$|fb\.me$/, "Facebook"],
    [/t\.co$|twitter\.com$|x\.com$/, "X"],
    [/linkedin\.com$|lnkd\.in$/, "LinkedIn"],
    [/github\.com$/, "GitHub"],
    [/google\./, "Google"],
    [/bing\.com$/, "Bing"],
    [/duckduckgo\.com$/, "DuckDuckGo"],
    [/whatsapp\.com$|wa\.me$/, "WhatsApp"],
    [/tiktok\.com$/, "TikTok"],
    [/youtube\.com$/, "YouTube"],
    [/gvtserver\.online$/, "Meus sites"],
  ];
  for (const [re, name] of known) if (re.test(host)) return name;
  return host;
}

/** Trata POST /api/bio/track. Responde sempre 204: o visitante não precisa saber se contou. */
export async function track(req, res) {
  const done = () => {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
  };
  try {
    // 300 eventos por IP a cada 10 min seguram robôs sem atrapalhar uma visita de verdade
    rateLimit(req, "bio-track", 300, 600, clientIp(req));
    const ua = String(req.headers["user-agent"] ?? "");
    if (!ua || BOT.test(ua)) return done();
    const b = await readJson(req, 4 * 1024);
    if (!TYPES.has(b.type) || !ID.test(String(b.session ?? "")) || !ID.test(String(b.visitor ?? ""))) return done();

    const ref = text(b.referrer, 300);
    const utm = text(b.utm, 40);
    await run(
      `INSERT INTO bio_events (at, type, visitor, session, label, section, href, source, referrer, device, os, browser, country, duration, depth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        now(),
        b.type,
        b.visitor,
        b.session,
        text(b.label, 120),
        text(b.section, 40),
        text(b.href, 300),
        b.type === "view" ? source(ua, ref, utm) : null,
        b.type === "view" ? ref : null,
        device(ua),
        os(ua),
        browser(ua),
        text(String(req.headers["cf-ipcountry"] ?? ""), 2),
        b.type === "leave" ? int(b.duration, 0, 6 * 3600) : null,
        b.type === "leave" ? int(b.depth, 0, 100) : null,
      ],
    );
  } catch {
    // limite estourado ou corpo inválido: ignora em silêncio
  }
  done();
}
