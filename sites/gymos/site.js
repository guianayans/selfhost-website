// GymOS AI — o que é só deste site: a série simulada que anima os terminais e o formulário de interesse.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // ---------------------------------------------------------------- série simulada
  // Um aluno fictício faz séries de 10 repetições; a fadiga reduz velocidade e amplitude nas últimas.
  // Todos os terminais da página ([data-sim]) mostram a mesma série. Nada aqui vem de máquina real.
  const REPS = 10, REP_S = 2.4, REST_S = 3.2, WINDOW_S = 9, SAMPLES = 120;
  const sims = $$("[data-sim]").map((root) => ({
    root,
    rep: $$("[data-sim-rep]", root), set: $$("[data-sim-set]", root), vel: $$("[data-sim-vel]", root),
    force: $$("[data-sim-force]", root), rom: $$("[data-sim-rom]", root), note: $$("[data-sim-note]", root),
    line: $$("[data-sim-line]", root), area: $$("[data-sim-area]", root),
  }));
  if (sims.length) {
    const buf = new Array(SAMPLES).fill(0);
    let t = 0, set = 2, sampleT = 0, last = 0, raf = 0;
    const visible = new Set();
    const text = (els, v) => els.forEach((e) => { if (e.textContent !== v) e.textContent = v; });

    // instante da série -> o que o terminal mostra
    function state(time) {
      const rest = time >= REPS * REP_S;
      const r = Math.min(REPS - 1, Math.floor(time / REP_S)), ph = rest ? 1 : (time / REP_S) % 1;
      const fatigue = r / (REPS - 1);
      // empurra em 40% do tempo, volta em 50%, pausa curta embaixo
      const pos = ph < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * ph / 0.4) : ph < 0.9 ? 0.5 + 0.5 * Math.cos(Math.PI * (ph - 0.4) / 0.5) : 0;
      const romMax = 0.97 - 0.09 * fatigue * fatigue;
      const peak = 1240 - 150 * fatigue;
      const force = rest ? 0 : peak * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * Math.min(1, ph / 0.9)), 1.4));
      return { rest, done: rest ? REPS : r + (ph > 0.4 ? 1 : 0), left: REPS - r - 1, pos: pos * romMax, force, vel: 0.74 - 0.2 * fatigue, peak: 1240 };
    }
    function paint(s) {
      const n = buf.length, pts = buf.map((v, i) => `${(i / (n - 1) * 400).toFixed(1)} ${(104 - v * 92).toFixed(1)}`);
      const d = "M" + pts.join(" L");
      const note = s.rest ? "Série concluída. Descanse antes da próxima."
        : s.left <= 2 && s.done < REPS ? `Velocidade caindo. Faltam ${s.left + (s.done > REPS - s.left - 1 ? 0 : 1)}.` : "Boa execução. Mantenha o ritmo.";
      for (const m of sims) {
        text(m.rep, String(s.done)); text(m.set, String(set));
        text(m.vel, (s.rest ? 0 : s.vel).toFixed(2).replace(".", ","));
        text(m.force, Math.round(s.force).toLocaleString("pt-BR"));
        text(m.note, note);
        m.rom.forEach((e) => (e.style.transform = `scaleX(${s.pos.toFixed(3)})`));
        m.line.forEach((e) => e.setAttribute("d", d));
        m.area.forEach((e) => e.setAttribute("d", `${d} L400 110 L0 110Z`));
        m.root.classList.toggle("resting", s.rest);
      }
    }
    function tick(now) {
      const dt = Math.min(0.064, (now - (last || now)) / 1000); last = now;
      t += dt; sampleT += dt;
      if (t >= REPS * REP_S + REST_S) { t = 0; set = set % 3 + 1; }
      const s = state(t);
      const step = WINDOW_S / SAMPLES;
      while (sampleT >= step) { sampleT -= step; buf.push(s.force / s.peak); buf.shift(); }
      paint(s);
      raf = visible.size && !document.hidden ? requestAnimationFrame(tick) : 0;
    }
    if (reduce) {      // parado: a série na sexta repetição, com o gráfico já desenhado
      const step = WINDOW_S / SAMPLES, end = 5.4 * REP_S;
      for (let i = 0; i < SAMPLES; i++) { const s = state(Math.max(0, end - (SAMPLES - 1 - i) * step)); buf[i] = s.force / s.peak; }
      paint(state(end));
    } else {
      const kick = () => { if (!raf && visible.size && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
        kick();
      });
      sims.forEach((m) => io.observe(m.root));
      document.addEventListener("visibilitychange", kick);
    }
  }

  // ---------------------------------------------------------------- formulário de interesse
  // Envia para data-endpoint (POST JSON) quando houver; sem endpoint, abre o e-mail de data-email
  // com a mensagem pronta. Sem nenhum dos dois, avisa que o envio ainda não foi ligado.
  const form = document.getElementById("lead");
  if (form) {
    const msg = form.querySelector(".form-msg"), btn = form.querySelector("button");
    const say = (text, kind) => { msg.textContent = text; msg.dataset.kind = kind; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bad = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
      if (bad) { say(bad.type === "email" && bad.value ? "Confira o e-mail." : "Preencha os três campos.", "error"); bad.focus(); return; }
      const data = Object.fromEntries(new FormData(form));
      const { endpoint, email } = form.dataset;
      if (endpoint) {
        btn.disabled = true; say("Enviando…", "");
        try {
          const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error(String(res.status));
          form.reset(); say("Recebido. A gente responde por e-mail.", "ok");
        } catch { say("Não foi possível enviar agora. Tente de novo em instantes.", "error"); }
        btn.disabled = false;
      } else if (email) {
        const body = `Nome: ${data.nome}\nE-mail: ${data.email}\nPerfil: ${data.perfil}`;
        location.href = `mailto:${email}?subject=${encodeURIComponent("Interesse no GymOS AI")}&body=${encodeURIComponent(body)}`;
        say("Abrimos o seu aplicativo de e-mail com a mensagem pronta.", "ok");
      } else {
        say("O envio deste formulário ainda não foi ligado. Nada foi enviado.", "error");
      }
    });
  }
})();
