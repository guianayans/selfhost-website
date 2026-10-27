// Banco do painel e do analytics do /bio: um arquivo SQLite (node:sqlite, sem dependências), como no Notchly.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { adminConfig as config } from "./config.js";

mkdirSync(config.dataDir, { recursive: true });

export const sqlite = new DatabaseSync(join(config.dataDir, "bio.db"));
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export const all = async (sql, params = []) => sqlite.prepare(sql).all(...params);
export const get = async (sql, params = []) => sqlite.prepare(sql).get(...params) ?? null;
export const run = async (sql, params = []) => sqlite.prepare(sql).run(...params);
// busca sem diferenciar maiúsculas (no Postgres: ILIKE)
export const LIKE_CI = "LIKE";

export const now = () => Math.floor(Date.now() / 1000);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS admin_codes (
    email      TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    ip         TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_audit (
    id     INTEGER PRIMARY KEY,
    at     INTEGER NOT NULL,
    actor  TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    ip     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit (target);

  -- Analytics do /bio. Um evento por linha:
  --   view (abriu a página), click (link ou botão), leave (saiu: tempo e rolagem), music (notch), ui (filtros, overlay…)
  -- visitor fica no localStorage do visitante e session no sessionStorage; nenhum IP é guardado.
  CREATE TABLE IF NOT EXISTS bio_events (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    at       INTEGER NOT NULL,
    type     TEXT NOT NULL,
    visitor  TEXT,
    session  TEXT,
    label    TEXT,
    section  TEXT,
    href     TEXT,
    source   TEXT,
    referrer TEXT,
    device   TEXT,
    os       TEXT,
    browser  TEXT,
    country  TEXT,
    duration INTEGER,
    depth    INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_bio_events_at ON bio_events (at);
  CREATE INDEX IF NOT EXISTS idx_bio_events_session ON bio_events (session);
  CREATE INDEX IF NOT EXISTS idx_bio_events_type_at ON bio_events (type, at);

  -- aba Links: um registro por link clicado
  DROP VIEW IF EXISTS bio_links;
  CREATE VIEW bio_links AS
    SELECT section || ' · ' || label AS id, label, section, MAX(href) AS href,
           COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS people,
           SUM(at > CAST(strftime('%s', 'now') AS INTEGER) - 7 * 86400) AS clicks_7d,
           MIN(at) AS first_at, MAX(at) AS last_at
    FROM bio_events WHERE type = 'click' GROUP BY section, label;

  -- aba Visitas: uma linha por visita (sessão), com a origem e o que a pessoa fez
  DROP VIEW IF EXISTS bio_visits;
  CREATE VIEW bio_visits AS
    SELECT session AS id, MIN(at) AS started_at, MAX(at) AS last_at, MAX(visitor) AS visitor,
           MAX(source) AS source, MAX(referrer) AS referrer, MAX(device) AS device, MAX(os) AS os,
           MAX(browser) AS browser, MAX(country) AS country,
           MAX(COALESCE(duration, 0)) AS duration, MAX(COALESCE(depth, 0)) AS depth,
           SUM(type = 'view') AS views, SUM(type = 'click') AS clicks,
           GROUP_CONCAT(DISTINCT CASE WHEN type = 'click' THEN label END) AS clicked
    FROM bio_events WHERE session IS NOT NULL GROUP BY session;
`);
