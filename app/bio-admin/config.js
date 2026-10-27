// Configuração do painel /bio/admin, lida do ambiente. Nada aqui vai para o navegador.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Além do ambiente do container, lê DATA_DIR/bio-admin.env (CHAVE=valor por linha): assim o e-mail do admin
// e o SMTP ficam no volume de dados e não somem quando o Coolify recria o serviço.
const fileEnv = {};
try {
  const text = readFileSync(join(process.env.DATA_DIR || "/app/data", "bio-admin.env"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) fileEnv[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
} catch {}

const env = (k, d = "") => (process.env[k] ?? fileEnv[k] ?? d).trim();
const list = (k, d = "") =>
  env(k, d)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const adminConfig = {
  appName: env("BIO_APP_NAME", "Bio"),
  publicUrl: env("PUBLIC_URL", env("PUBLIC_DOMAIN", "http://localhost:4050")).replace(/\/$/, ""),
  // quem recebe o código de login do painel
  adminEmails: list("ADMIN_EMAILS"),
  sessionHours: Number(env("ADMIN_SESSION_HOURS", "12")) || 12,
  cookieSecure: env("COOKIE_SECURE", "true") !== "false",
  // o banco (bio.db) fica no volume de dados do Website Manager
  dataDir: env("DATA_DIR", "/app/data"),
  smtp: {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", "587")),
    secure: env("SMTP_SECURE") === "true",
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM"),
    fromName: env("SMTP_FROM_NAME", "Bio"),
  },
};
