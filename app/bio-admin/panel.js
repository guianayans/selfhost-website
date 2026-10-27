// O que é específico do /bio no painel: números da Visão geral, abas de dados e gráficos do analytics.
// Datas em epoch (segundos). O dia é o de Brasília (UTC-3, sem horário de verão).

const BRT = 3 * 3600;
const DAY = 86400;
const SECTIONS = { hero: "Topo", apps: "Apps no ar", repos: "Repositórios", privs: "Projetos privados", foot: "Rodapé", notch: "Notch" };
const sectionMap = Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, [v, k === "apps" ? "admin" : ""]]));

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const fmtDur = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s` : `${Math.round(s)} s`);
// início do dia de hoje em Brasília, em epoch
const todayStart = (t) => Math.floor((t - BRT) / DAY) * DAY + BRT;

export const panel = {
  links: [{ label: "Abrir /bio ↗", href: "/bio/" }],
  auditLabels: {},

  async stats({ get, now }) {
    const t = now();
    const since = t - 30 * DAY;
    const today = todayStart(t);
    const v = await get(
      `SELECT SUM(type = 'view') AS views, SUM(type = 'view' AND at >= ?) AS views_today,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN visitor END) AS visitors,
              SUM(type = 'click') AS clicks, SUM(type = 'click' AND at >= ?) AS clicks_today,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN session END) AS sessions,
              COUNT(DISTINCT CASE WHEN type = 'click' THEN session END) AS sessions_click,
              COUNT(DISTINCT CASE WHEN type = 'music' AND label IN ('Começou sozinha', 'Ativou o som', 'Tocar') THEN session END) AS plays
       FROM bio_events WHERE at >= ?`,
      [today, today, since],
    );
    const time = await get(
      `SELECT AVG(d) AS avg FROM (SELECT MAX(duration) AS d FROM bio_events WHERE type = 'leave' AND at >= ? GROUP BY session)`,
      [since],
    );
    const top = await get(
      `SELECT label, COUNT(*) AS n FROM bio_events WHERE type = 'click' AND at >= ? GROUP BY section, label ORDER BY n DESC LIMIT 1`,
      [since],
    );
    const insta = await get(`SELECT COUNT(*) AS n FROM bio_events WHERE type = 'view' AND source = 'Instagram' AND at >= ?`, [since]);
    const views = v?.views ?? 0;
    return [
      { label: "Visualizações · 30 dias", value: views, sub: `${(v?.views_today ?? 0).toLocaleString("pt-BR")} hoje` },
      { label: "Visitantes únicos · 30 dias", value: v?.visitors ?? 0, sub: `${(v?.sessions ?? 0).toLocaleString("pt-BR")} visitas` },
      { label: "Cliques · 30 dias", value: v?.clicks ?? 0, sub: `${(v?.clicks_today ?? 0).toLocaleString("pt-BR")} hoje` },
      { label: "Taxa de clique", value: `${pct(v?.sessions_click ?? 0, v?.sessions ?? 0)}%`, sub: "visitas com pelo menos 1 clique" },
      { label: "Tempo médio na página", value: time?.avg ? fmtDur(time.avg) : "—", sub: "por visita" },
      { label: "Link mais clicado", value: top?.label ?? "—", sub: top ? `${top.n.toLocaleString("pt-BR")} cliques` : "nenhum clique ainda" },
      { label: "Vindos do Instagram", value: `${pct(insta?.n ?? 0, views)}%`, sub: `${(insta?.n ?? 0).toLocaleString("pt-BR")} visualizações` },
      { label: "Ouviram a música com som", value: v?.plays ?? 0, sub: `${pct(v?.plays ?? 0, v?.sessions ?? 0)}% das visitas` },
    ];
  },

  // Gráficos da Visão geral (GET /api/bio/admin/analytics?days=)
  async analytics({ all, now }, days) {
    const t = now();
    const since = days ? todayStart(t) - (days - 1) * DAY : 0;
    const count = (sql, params = []) => all(sql, [since, ...params]);

    const daily = await count(
      `SELECT date(at - ${BRT}, 'unixepoch') AS day, SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN visitor END) AS visitors, SUM(type = 'click') AS clicks
       FROM bio_events WHERE at >= ? GROUP BY day ORDER BY day`,
    );
    const top = (field, type = "view", limit = 8) =>
      count(
        `SELECT COALESCE(${field}, 'Desconhecido') AS label, COUNT(*) AS n FROM bio_events
         WHERE at >= ? AND type = ? GROUP BY 1 ORDER BY n DESC LIMIT ${limit}`,
        [type],
      );
    return {
      days,
      first: (await all("SELECT MIN(at) AS t FROM bio_events"))[0]?.t ?? null,
      daily,
      links: await count(
        `SELECT label, section, COUNT(*) AS n, COUNT(DISTINCT visitor) AS people FROM bio_events
         WHERE at >= ? AND type = 'click' GROUP BY section, label ORDER BY n DESC LIMIT 15`,
      ),
      sections: (
        await count(`SELECT section AS label, COUNT(*) AS n FROM bio_events WHERE at >= ? AND type = 'click' GROUP BY section ORDER BY n DESC`)
      ).map((r) => ({ ...r, label: SECTIONS[r.label] ?? r.label ?? "Outro" })),
      sources: await top("source"),
      devices: await top("device"),
      os: await top("os"),
      browsers: await top("browser"),
      countries: await top("country"),
      hours: await count(
        `SELECT CAST(strftime('%H', at - ${BRT}, 'unixepoch') AS INTEGER) AS hour, COUNT(*) AS n
         FROM bio_events WHERE at >= ? AND type = 'view' GROUP BY hour ORDER BY hour`,
      ),
      music: await count(
        `SELECT label, COUNT(*) AS n FROM bio_events WHERE at >= ? AND type = 'music' GROUP BY label ORDER BY n DESC LIMIT 8`,
      ),
      ui: await count(`SELECT label, COUNT(*) AS n FROM bio_events WHERE at >= ? AND type = 'ui' GROUP BY label ORDER BY n DESC LIMIT 8`),
      depth: await count(
        `SELECT CASE WHEN d >= 90 THEN 'Até o fim' WHEN d >= 50 THEN 'Metade ou mais' WHEN d >= 25 THEN 'Um quarto' ELSE 'Só o topo' END AS label,
                COUNT(*) AS n
         FROM (SELECT MAX(depth) AS d FROM bio_events WHERE at >= ? AND type = 'leave' GROUP BY session)
         GROUP BY label ORDER BY MIN(d) DESC`,
      ),
    };
  },

  resources: {
    links: {
      label: "Links",
      singular: "link",
      table: "bio_links",
      title: "label",
      subtitle: "href",
      copy: "href",
      search: ["label", "href"],
      searchLabel: "nome ou endereço",
      order: "clicks DESC",
      filters: [
        { value: "apps", label: "Apps no ar", where: "section = 'apps'" },
        { value: "repos", label: "Repositórios", where: "section = 'repos'" },
        { value: "hero", label: "Topo e redes", where: "section = 'hero'" },
        { value: "notch", label: "Notch", where: "section = 'notch'" },
        { value: "foot", label: "Rodapé", where: "section = 'foot'" },
        { value: "7d", label: "Clicados nos últimos 7 dias", where: "clicks_7d > 0" },
      ],
      columns: [
        { field: "label", label: "Link", sub: "href" },
        { field: "section", label: "Seção", type: "badge", map: sectionMap },
        { field: "clicks", label: "Cliques", type: "number" },
        { field: "people", label: "Pessoas", type: "number" },
        { field: "clicks_7d", label: "7 dias", type: "number" },
        { field: "last_at", label: "Último clique", type: "datetime" },
      ],
      badges: (r) => [[`${r.clicks} cliques`, "ok"], [`${r.people} pessoas`, ""], [SECTIONS[r.section] ?? r.section, ""]],
      related: [
        {
          label: "Cliques por dia (últimos 30)",
          empty: "Sem cliques nos últimos 30 dias.",
          load: async ({ row, all, now }) =>
            (
              await all(
                `SELECT date(at - ${BRT}, 'unixepoch') AS day, COUNT(*) AS n FROM bio_events
                 WHERE type = 'click' AND section = ? AND label = ? AND at >= ? GROUP BY day ORDER BY day DESC`,
                [row.section, row.label, now() - 30 * DAY],
              )
            ).map((d) => ({ primary: d.day.split("-").reverse().join("/"), meta: `${d.n} cliques` })),
        },
        {
          label: "Últimos cliques",
          load: async ({ row, all }) =>
            (
              await all(
                `SELECT c.at, v.source, c.device, c.os, c.country FROM bio_events c
                 LEFT JOIN bio_visits v ON v.id = c.session
                 WHERE c.type = 'click' AND c.section = ? AND c.label = ? ORDER BY c.id DESC LIMIT 20`,
                [row.section, row.label],
              )
            ).map((c) => ({
              primary: new Date(c.at * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
              secondary: [c.source, c.device, c.os].filter(Boolean).join(" · "),
              meta: c.country ?? "",
            })),
        },
      ],
      create: false,
      remove: false,
    },

    visitas: {
      label: "Visitas",
      singular: "visita",
      feminine: true,
      table: "bio_visits",
      title: "source",
      subtitle: "id",
      search: ["source", "referrer", "clicked", "country"],
      searchLabel: "origem, link clicado ou país",
      order: "started_at DESC",
      filters: [
        { value: "hoje", label: "Hoje", where: (t) => `started_at >= ${todayStart(t)}` },
        { value: "7d", label: "Últimos 7 dias", where: (t) => `started_at >= ${t - 7 * DAY}` },
        { value: "clicou", label: "Clicaram em algo", where: "clicks > 0" },
        { value: "instagram", label: "Vindas do Instagram", where: "source = 'Instagram'" },
        { value: "celular", label: "Celular", where: "device = 'Celular'" },
        { value: "computador", label: "Computador", where: "device = 'Computador'" },
      ],
      columns: [
        { field: "started_at", label: "Quando", type: "datetime" },
        { field: "source", label: "Origem", sub: "referrer" },
        { field: "device", label: "Aparelho", sub: "browser" },
        { field: "country", label: "País" },
        { field: "duration", label: "Segundos", type: "number" },
        { field: "depth", label: "Rolou (%)", type: "number" },
        { field: "clicks", label: "Cliques", type: "number", sub: "clicked" },
      ],
      listBadges: (r) => (r.clicks > 0 ? [["clicou", "ok"]] : []),
      badges: (r) => [
        [r.device, ""],
        [r.os, ""],
        [r.browser, ""],
        [r.country ?? "país ?", ""],
        [r.duration ? fmtDur(r.duration) : "tempo ?", ""],
        [`rolou ${r.depth}%`, r.depth >= 90 ? "ok" : ""],
        [`${r.clicks} cliques`, r.clicks ? "ok" : ""],
      ],
      related: [
        {
          label: "O que a pessoa fez, em ordem",
          load: async ({ row, all }) =>
            (await all("SELECT at, type, label, section, href, duration, depth FROM bio_events WHERE session = ? ORDER BY id", [row.id])).map((e) => ({
              primary:
                e.type === "view"
                  ? "Abriu a página"
                  : e.type === "leave"
                    ? `Saiu ou trocou de aba (${fmtDur(e.duration ?? 0)}, rolou ${e.depth ?? 0}%)`
                    : `${{ click: "Clicou", music: "Música", ui: "Interagiu" }[e.type] ?? e.type}: ${e.label ?? "—"}`,
              secondary: [SECTIONS[e.section] ?? e.section, e.href].filter(Boolean).join(" · "),
              meta: new Date(e.at * 1000).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }),
            })),
        },
        {
          label: "Outras visitas da mesma pessoa",
          empty: "Primeira visita desta pessoa.",
          load: async ({ row, all }) =>
            (
              await all("SELECT id, started_at, source, clicks FROM bio_visits WHERE visitor = ? AND id <> ? ORDER BY started_at DESC LIMIT 20", [
                row.visitor,
                row.id,
              ])
            ).map((v) => ({
              primary: new Date(v.started_at * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
              secondary: v.source ?? "",
              meta: `${v.clicks} cliques`,
            })),
        },
      ],
      create: false,
      remove: false,
    },

    eventos: {
      label: "Atividade",
      singular: "evento",
      table: "bio_events",
      title: "label",
      subtitle: "href",
      search: ["label", "href", "source", "country"],
      searchLabel: "nome, endereço, origem ou país",
      filters: [
        { value: "click", label: "Cliques", where: "type = 'click'" },
        { value: "view", label: "Visualizações", where: "type = 'view'" },
        { value: "music", label: "Música do notch", where: "type = 'music'" },
        { value: "ui", label: "Interações (filtros, overlay…)", where: "type = 'ui'" },
        { value: "leave", label: "Saídas (tempo e rolagem)", where: "type = 'leave'" },
      ],
      columns: [
        { field: "at", label: "Quando", type: "datetime" },
        {
          field: "type",
          label: "Tipo",
          type: "badge",
          map: { view: ["Visualização", ""], click: ["Clique", "ok"], leave: ["Saída", ""], music: ["Música", "admin"], ui: ["Interação", "warn"] },
        },
        { field: "label", label: "O quê", sub: "href" },
        { field: "section", label: "Seção", type: "badge", map: sectionMap },
        { field: "device", label: "Aparelho", sub: "os" },
        { field: "source", label: "Origem" },
        { field: "country", label: "País" },
      ],
      create: false,
      remove: false,
    },
  },
};
