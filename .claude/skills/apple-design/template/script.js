// Motor de rolagem da página: cena presa por etapas, vídeo e sequência de imagens guiados pela
// rolagem, entradas ao aparecer, contadores e parallax. Tudo ligado por atributos no HTML:
//   [data-story]            seção alta com uma área presa (.stick); expõe --sp (0..1) e data-step
//   [data-step="n"]         qualquer coisa dentro da história que só aparece na etapa n (classe .on)
//   video[data-scrub]       vídeo cujo tempo segue a rolagem
//   canvas[data-frames]     sequência de imagens que segue a rolagem (data-frames="pasta/f_%04d.webp" data-count="120")
//   [data-reveal]           entra ao aparecer na tela (classe .in); irmãos entram em cascata
//   [data-count="653"]      número que conta de 0 até o valor ao aparecer
//   [data-parallax="0.15"]  desloca devagar em relação à rolagem
// Com "reduzir movimento" nada desliza nem conta: tudo aparece no lugar.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const locale = document.documentElement.lang || "pt-BR";

  // progresso de uma seção presa: 0 quando gruda, 1 quando solta
  function pinned(el) {
    const r = el.getBoundingClientRect();
    return clamp01(-r.top / Math.max(1, el.offsetHeight - innerHeight));
  }
  // progresso de um elemento comum atravessando a tela: 0 ao entrar por baixo, 1 ao sair por cima
  function through(el) {
    const r = el.getBoundingClientRect();
    return clamp01((innerHeight - r.top) / (innerHeight + r.height));
  }

  // ---------------------------------------------------------------- barra: fundo de vidro depois do topo
  const nav = document.querySelector(".nav");

  // ---------------------------------------------------------------- cena presa por etapas
  // Quem precisa reagir a uma etapa (iniciar um contador, tocar uma animação) escuta o evento
  // "story:step" na seção: e.detail = { step, steps }.
  const stories = $$("[data-story]").map((el) => ({
    el, step: -1,
    steps: Number(el.dataset.steps) || $$(".steps > *", el).length || 1,
    items: $$("[data-step]", el),
    dots: $$(".dots > *", el),
  }));
  function updateStories() {
    for (const s of stories) {
      const p = pinned(s.el);
      s.el.style.setProperty("--sp", p.toFixed(4));
      const n = Math.min(s.steps - 1, Math.floor(p * s.steps));
      if (n === s.step) continue;
      s.step = n;
      s.el.dataset.step = n;
      s.items.forEach((it) => it.classList.toggle("on", Number(it.dataset.step) === n));
      s.dots.forEach((d, i) => d.classList.toggle("on", i === n));
      s.el.dispatchEvent(new CustomEvent("story:step", { detail: { step: n, steps: s.steps } }));
    }
  }

  // ---------------------------------------------------------------- parallax
  const layers = reduce ? [] : $$("[data-parallax]").map((el) => ({ el, k: Number(el.dataset.parallax) || 0.1 }));
  function updateParallax() {
    for (const { el, k } of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - innerHeight / 2) * -k).toFixed(1)}px, 0)`;
    }
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (nav) nav.classList.toggle("scrolled", scrollY > 8);
      updateStories();
      updateParallax();
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // ---------------------------------------------------------------- vídeo / sequência guiados pela rolagem
  // O progresso vem da seção [data-story] em volta; sem ela, da travessia do próprio elemento pela tela.
  // O valor mostrado persegue o alvo com inércia: a rolagem do mouse vira movimento contínuo.
  const scrubs = [];
  const progressOf = (el) => { const s = el.closest("[data-story]"); return s ? () => pinned(s) : () => through(el); };

  $$("video[data-scrub]").forEach((v) => {
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.removeAttribute("autoplay"); v.pause();
    // iPhone só deixa mexer no tempo depois de um toque ter "acordado" o vídeo
    const wake = () => { const p = v.play(); if (p) p.then(() => v.pause()).catch(() => {}); };
    addEventListener("touchstart", wake, { once: true, passive: true });
    scrubs.push({ el: v, get: progressOf(v), cur: -1, near: false, show(p) {
      const d = v.duration;
      if (!d || v.seeking) return false;           // um pedido por vez: não empilha buscas
      const t = Math.min(d - 0.04, p * d);
      if (Math.abs(v.currentTime - t) > 1 / 90) v.currentTime = t;
      return true;
    } });
  });

  $$("canvas[data-frames]").forEach((cv) => {
    const count = Number(cv.dataset.count) || 0, pattern = cv.dataset.frames, ctx = cv.getContext("2d");
    if (!count || !pattern) return;
    const url = (i) => pattern.replace(/%0?(\d*)d/, (_, w) => String(i + 1).padStart(Number(w) || 1, "0"));
    const imgs = new Array(count);
    let shown = -1, loading = false;
    const load = (i) => new Promise((done) => { const im = new Image(); im.decoding = "async"; im.onload = im.onerror = done; im.src = url(i); imgs[i] = im; });
    const ready = (i) => imgs[i] && imgs[i].complete && imgs[i].naturalWidth;
    function paint(i) {
      // quadro pedido ou o mais próximo já carregado (antes dele)
      while (i > 0 && !ready(i)) i--;
      if (!ready(i) || i === shown) return;
      const im = imgs[i];
      if (cv.width !== im.naturalWidth) { cv.width = im.naturalWidth; cv.height = im.naturalHeight; }
      ctx.drawImage(im, 0, 0);
      shown = i;
    }
    const item = { el: cv, get: progressOf(cv), cur: -1, near: false, want: 0,
      show(p) { item.want = Math.round(p * (count - 1)); paint(item.want); return true; },
      async preload() {            // o primeiro quadro já; o resto em fila curta quando a seção chega perto
        if (loading) return; loading = true;
        for (let i = 1; i < count; i += 6) { await Promise.all(Array.from({ length: Math.min(6, count - i) }, (_, j) => load(i + j))); paint(item.want); }
      } };
    load(0).then(() => paint(0));
    scrubs.push(item);
  });

  if (scrubs.length) {
    let raf = 0, last = 0;
    const tick = (now) => {
      const dt = Math.min(64, now - (last || now)); last = now;
      let moving = false;
      for (const s of scrubs) {
        if (!s.near) continue;
        const p = s.get();
        s.cur = s.cur < 0 || reduce ? p : s.cur + (p - s.cur) * (1 - Math.exp(-dt / 110));
        if (Math.abs(p - s.cur) < 0.0004) s.cur = p; else moving = true;
        if (!s.show(s.cur)) moving = true;
      }
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", kick);
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const s = scrubs.find((x) => (x.el.closest("[data-story]") || x.el) === e.target);
      if (!s) return;
      s.near = e.isIntersecting;
      if (s.near) { if (s.preload) s.preload(); kick(); }
    }), { rootMargin: "100% 0px" });
    scrubs.forEach((s) => io.observe(s.el.closest("[data-story]") || s.el));
    scrubs.forEach((s) => s.el.addEventListener("loadedmetadata", kick));
  }

  // ---------------------------------------------------------------- entradas ao aparecer
  const reveals = $$("[data-reveal]");
  reveals.forEach((el) => {     // irmãos entram em cascata
    const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
    el.style.setProperty("--d", `${Math.min(sibs.indexOf(el), 6) * 80}ms`);
  });
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add("in");
    }), { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  // ---------------------------------------------------------------- números contam ao aparecer
  const nums = $$("[data-count]");
  if (!reduce && "IntersectionObserver" in window) {
    nums.forEach((n) => (n.textContent = "0"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const end = Number(e.target.dataset.count), t0 = performance.now(), dur = 1400;
      const f = (t) => {
        const k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
        e.target.textContent = v.toLocaleString(locale);
        if (k < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }), { threshold: 0.6 });
    nums.forEach((n) => io.observe(n));
  }
})();
