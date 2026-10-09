// Fundo de fibras de luz em WebGL que muda de forma conforme a rolagem.
// Cada fibra é uma faixa fina com brilho; a forma é calculada na GPU (vertex shader) e a rolagem
// escolhe a cena. Uma chamada de desenho para todas as fibras (instancing), na taxa da tela.
// Sem WebGL a página continua igual, só sem o fundo animado.
//
// Dois modos, decididos pelo lugar do <canvas id="fx"> no HTML:
//   página  — canvas fixo, filho do <body>. Cada seção diz a sua cena: data-fx-scene="0..N-1"
//             (aceita meio-termo, ex. 2.35) e data-fx-intensity="0..1" (menos brilho onde há texto).
//   história — canvas dentro de uma seção [data-story]. O progresso da seção percorre as cenas,
//             com um descanso em cada uma, e as formas cabem no elemento [data-fx-box].
//
// Para criar um site novo, o que muda é o bloco FORMAS abaixo e as cores (--fx-1..3 no CSS).
(() => {
  const cv = document.getElementById("fx");
  if (!cv) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 700px)").matches;
  const story = cv.closest("[data-story]");

  // ------------------------------------------------------------------ FORMAS
  // Cada forma recebe s (0..1 ao longo da fibra), lane (0..1, qual fibra) e seed (0..1, aleatório
  // fixo da fibra) e devolve um ponto. Unidades: y de -1 (base) a 1 (topo) da área; x de -uAspect
  // a +uAspect. uAspect < 1.0 = tela em pé (celular): ajuste a posição para não cobrir o texto.
  // Opcional dentro da forma: gA = brilho (1 = normal) e gOpen = 0.0 para contorno fechado
  // (as pontas não somem). uT é o tempo: use para dar vida (ondular, correr), nunca para mover
  // a forma de lugar.
  const SCENES = 4;   // quantas formas existem em shape() — mantenha igual
  const SHAPES = `
vec2 orbit(float s, float lane, float seed) {            // 0: tudo converge para um ponto
  float along = 1.0 - s * 1.14;                          // 1 = longe, 0 = foco, <0 = cauda
  float r = pow(abs(along), 1.1) * (along > 0.0 ? 1.35 : 0.3) * (0.5 + 0.5 * seed) * (uAspect < 1.0 ? 0.42 : 1.0);
  float th = lane * 6.2831853 + seed * 0.5;
  float sw = uT * 0.21 + along * 2.7 + seed * 6.0;
  vec2 F = uAspect < 1.0 ? vec2(-0.1, -0.55) : vec2(0.08 * uAspect, -0.1);   // foco no vão entre o texto e a imagem
  vec2 p = F + vec2(along * uAspect * (along > 0.0 ? 1.3 : 0.8), along * 0.12);
  return p + vec2(cos(th + sw) * 0.55, sin(th + sw)) * r * 0.78;
}
vec2 beams(float s, float lane, float seed) {            // 1: feixes atravessando a tela
  float u = mix(-1.3, 1.3, s);
  float base = uAspect < 1.0 ? 0.5 : -0.72;
  float y = base + (lane - 0.5) * 0.28
          + 0.06 * sin(u * 2.1 + uT * 0.33 + seed * 5.0)
          + 0.03 * sin(u * 6.3 - uT * 0.8 + lane * 21.0);
  return vec2(u * uAspect, y);
}
vec2 wave(float s, float lane, float seed) {             // 2: onda larga por baixo do conteúdo
  float u = mix(-1.35, 1.35, s);
  float y = (uAspect < 1.0 ? -0.74 : -0.56) + 0.2 * sin(u * 1.3 - 0.35 + uT * 0.17) * (0.5 + 0.5 * lane)
          + (lane - 0.5) * 0.34
          + 0.03 * sin(u * 7.0 + uT * 0.9 + seed * 30.0);
  return vec2(u * uAspect, y);
}
vec2 ring(float s, float lane, float seed) {             // 3: anel que se fecha atrás da chamada final
  gOpen = 0.0; gA = 0.3;
  float R = min(0.66, 0.84 * uAspect) * (1.0 + (lane - 0.5) * 0.2);
  float th = s * 2.0 * PI + seed * 6.2831853 + uT * 0.04;
  return vec2(cos(th), sin(th)) * (R + 0.012 * sin(s * 40.0 + uT * 1.6 + seed * 30.0));
}
vec2 shape(float k, float s, float lane, float seed) {
  if (k < 0.5) return orbit(s, lane, seed);
  if (k < 1.5) return beams(s, lane, seed);
  if (k < 2.5) return wave(s, lane, seed);
  return ring(s, lane, seed);
}`;
  // ------------------------------------------------------------------ fim das FORMAS

  const VS = `
precision highp float;
attribute float aS;       // posição ao longo da fibra (0..1)
attribute float aSide;    // -1 / +1: lados da faixa
attribute vec3 aLine;     // lane (0..1), semente, cor
uniform float uT, uScene, uK, uAspect, uIntensity, uW;   // uK: cena de partida, decidida no script (a mesma dos deslocamentos)
uniform vec2 uRes, uPtr;
uniform vec2 uOff;        // deslocamento vertical da forma atual e da próxima (acompanham a sua seção)
uniform vec4 uBox;        // centro e escala (clip) da área onde as formas são desenhadas
uniform vec3 uC1, uC2, uC3;
varying float vSide, vA;
varying vec3 vCol;
const float PI = 3.14159265;
float gA, gOpen;
${SHAPES}
void main() {
  float lane = aLine.x, seed = aLine.y;
  float k0 = uK, f = clamp(uScene - k0, 0.0, 1.0);
  float fi = smoothstep(0.0, 1.0, clamp(f * 1.7 - seed * 0.7, 0.0, 1.0));   // cada fibra muda no seu tempo
  float e = 1.0 / 220.0;
  float s2 = aS + (aS < 0.995 ? e : -e);
  gA = 1.0; gOpen = 1.0; vec2 pA = shape(k0, aS, lane, seed); float aA = gA, oA = gOpen;
  gA = 1.0; gOpen = 1.0; vec2 pB = shape(k0 + 1.0, aS, lane, seed); float aB = gA, oB = gOpen;
  vec2 par = uPtr * 0.035 * (0.3 + seed);
  vec2 p = mix(pA + vec2(0.0, uOff.x), pB + vec2(0.0, uOff.y), fi) + par;
  vec2 q = mix(shape(k0, s2, lane, seed) + vec2(0.0, uOff.x), shape(k0 + 1.0, s2, lane, seed) + vec2(0.0, uOff.y), fi) + par;
  vec2 c = uBox.xy + p * uBox.zw, c2 = uBox.xy + q * uBox.zw;
  vec2 dpx = (c2 - c) * uRes * (aS < 0.995 ? 0.5 : -0.5);
  vec2 n = normalize(vec2(-dpx.y, dpx.x) + 1e-5);
  gl_Position = vec4(c + n * aSide * uW / (uRes * 0.5), 0.0, 1.0);
  vSide = aSide;
  float ends = mix(1.0, smoothstep(0.0, 0.07, aS) * smoothstep(1.0, 0.93, aS), mix(oA, oB, fi));
  float pulse = pow(0.5 + 0.5 * sin((aS * 7.0 - uT * 0.9 + seed * 13.0) * PI), 14.0);   // "pacotes" correndo
  vA = ends * mix(aA, aB, fi) * (0.2 + 0.24 * seed + pulse * 0.95) * uIntensity;
  float cp = aLine.z;
  vCol = cp < 0.64 ? uC1 : cp < 0.84 ? uC2 : uC3;
}`;
  const FS = `
precision mediump float;
varying float vSide, vA;
varying vec3 vCol;
void main() {
  float d = vSide;
  float a = (exp(-d * d * 38.0) * 0.95 + exp(-d * d * 3.2) * 0.16) * vA;   // núcleo fino + halo
  vec3 c = vCol * a;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

  const attrs = { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" };
  let gl = cv.getContext("webgl2", attrs);
  let inst = null;
  if (gl) {
    inst = { div: (l, d) => gl.vertexAttribDivisor(l, d), draw: (m, f, c, n) => gl.drawArraysInstanced(m, f, c, n) };
  } else {
    gl = cv.getContext("webgl", attrs);
    const ext = gl && gl.getExtension("ANGLE_instanced_arrays");
    if (!ext) { cv.remove(); return; }
    inst = { div: (l, d) => ext.vertexAttribDivisorANGLE(l, d), draw: (m, f, c, n) => ext.drawArraysInstancedANGLE(m, f, c, n) };
  }

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { console.warn("[fx] fundo animado desativado:", err); cv.remove(); return; }
  gl.useProgram(prog);

  // geometria: uma faixa (tira de triângulos) reaproveitada por todas as fibras
  const SEG = small ? 150 : 220, N = small ? 96 : 176;
  const strip = new Float32Array((SEG + 1) * 4);
  for (let i = 0; i <= SEG; i++) strip.set([i / SEG, -1, i / SEG, 1], i * 4);
  const lines = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) lines.set([(i + Math.random() * 0.8) / N, Math.random(), Math.random()], i * 3);
  const buf = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
  const bStrip = buf(strip), bLines = buf(lines);
  const aS = gl.getAttribLocation(prog, "aS"), aSide = gl.getAttribLocation(prog, "aSide"), aLine = gl.getAttribLocation(prog, "aLine");
  gl.bindBuffer(gl.ARRAY_BUFFER, bStrip);
  gl.enableVertexAttribArray(aS); gl.vertexAttribPointer(aS, 1, gl.FLOAT, false, 8, 0);
  gl.enableVertexAttribArray(aSide); gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, 8, 4);
  gl.bindBuffer(gl.ARRAY_BUFFER, bLines);
  gl.enableVertexAttribArray(aLine); gl.vertexAttribPointer(aLine, 3, gl.FLOAT, false, 12, 0);
  inst.div(aLine, 1);
  const U = {};
  ["uT", "uScene", "uK", "uAspect", "uIntensity", "uW", "uRes", "uPtr", "uOff", "uBox", "uC1", "uC2", "uC3"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);   // soma de luz: só funciona sobre fundo escuro
  gl.clearColor(0, 0, 0, 0);

  // cores: --fx-1 (principal), --fx-2 e --fx-3 (acentos), em qualquer formato de cor do CSS
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const cs = getComputedStyle(cv);
  [["--fx-1", "#4dff9a"], ["--fx-2", "#c8ff52"], ["--fx-3", "#66d6ff"]].forEach(([name, fallback], i) => {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = fallback; probe.fillStyle = cs.getPropertyValue(name).trim() || fallback;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    gl.uniform3f(U["uC" + (i + 1)], r / 255, g / 255, b / 255);
  });

  // tamanho: nitidez da tela até 2x (1.5x no celular); se o aparelho não der conta, baixa sozinho
  let dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2), lastW = 0, lastH = 0;
  function size(force) {
    const w = cv.clientWidth, h = cv.clientHeight;
    // no celular a barra do navegador muda a altura a cada rolagem: só redimensiona se mudar de verdade
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, cv.width, cv.height);
  }
  addEventListener("resize", () => size(false));
  size(true);

  // ------------------------------------------------------------------ rolagem → cena
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FOLLOW = cv.dataset.fxFollow != null ? Number(cv.dataset.fxFollow) : 0.85;   // 1 = forma presa ao conteúdo, 0 = parada na tela

  // modo página: cada seção marcada vira um ponto [y do gatilho, y real, cena, intensidade]
  const marks = story ? [] : [...document.querySelectorAll("[data-fx-scene]")].map((el) => ({
    el, sc: clamp(Number(el.dataset.fxScene) || 0, 0, SCENES - 1),
    it: el.dataset.fxIntensity != null ? Number(el.dataset.fxIntensity) : 0.8,
    hold: el.hasAttribute("data-story"),
  }));
  function pageTarget() {
    const vh = innerHeight, mid = vh * 0.5, pts = [];
    const remaining = Math.max(0, document.documentElement.scrollHeight - vh - scrollY);
    for (const { el, sc, it, hold } of marks) {
      const r = el.getBoundingClientRect(), c = r.top + r.height / 2;
      const a = r.top + vh * 0.6, b = r.bottom - vh * 0.6;
      if (hold && a < b) pts.push([a, a, sc, it], [b, b, sc, it]);   // cena presa: a forma fica durante toda a parte presa
      else pts.push([c, c, sc, it]);
    }
    if (!pts.length) return [0, 0.8, []];
    // A última seção fica no fim da página e o meio dela nunca chega ao meio da tela: o ponto dela
    // "encolhe" para ser alcançado exatamente no fim da rolagem (a última forma sempre se completa).
    const L = pts.length - 1;
    pts[L][0] = Math.min(pts[L][0], mid + remaining);
    for (let i = L - 1; i >= 0; i--) pts[i][0] = Math.min(pts[i][0], pts[i + 1][0] - 40);

    // deslocamento de cada forma: entra com a primeira seção dela, fica parada na tela enquanto o
    // meio da tela estiver entre as seções dela e sai com a última. Contínuo, sem pulo.
    const lo = new Array(SCENES).fill(1e9), hi = new Array(SCENES).fill(-1e9);
    pts.forEach(([, y, sc]) => { if (sc % 1) return; lo[sc] = Math.min(lo[sc], y); hi[sc] = Math.max(hi[sc], y); });
    const off = lo.map((l, k) => {
      if (l > 1e8) return 0;
      const d = mid < l ? l - mid : mid > hi[k] ? hi[k] - mid : 0;
      return clamp(-d / vh * 2 * (k === SCENES - 1 ? 1 : FOLLOW), -1.8, 1.8);   // a última fica presa ao texto final
    });
    let sc = pts[L][2], it = pts[L][3];
    if (mid <= pts[0][0]) { sc = pts[0][2]; it = pts[0][3]; }
    else for (let i = 1; i <= L; i++) {
      if (mid <= pts[i][0]) {
        const t = (mid - pts[i - 1][0]) / Math.max(1, pts[i][0] - pts[i - 1][0]);
        sc = pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * t; it = pts[i - 1][3] + (pts[i][3] - pts[i - 1][3]) * t;
        break;
      }
    }
    return [sc, it, off];
  }

  // modo história: progresso da seção (0..1) → cena, com um "descanso" em cada forma
  const steps = story ? clamp(Number(story.dataset.steps) || story.querySelectorAll(".steps > *").length || SCENES, 2, SCENES) : 0;
  const boxEl = story && story.querySelector("[data-fx-box]");
  function storyProgress() {
    const r = story.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, story.offsetHeight - innerHeight), 0, 1);
  }
  function storyTarget() {
    const x = clamp(storyProgress() * steps - 0.5, 0, steps - 1);
    const i = Math.min(steps - 2, Math.floor(x));
    const k = clamp((x - i - 0.2) / 0.6, 0, 1);
    return [i + k * k * (3 - 2 * k), 1, []];
  }
  const target = story ? storyTarget : pageTarget;

  // área das formas: a tela inteira (página) ou o elemento [data-fx-box] (história)
  const box = [0, 0, 1, 1, 1];   // centro x, centro y, escala x, escala y, proporção
  function layout() {
    const W = cv.clientWidth || 1, H = cv.clientHeight || 1;
    let cx = W / 2, cy = H / 2, hw = W / 2, hh = H / 2;
    if (boxEl) {
      const r = boxEl.getBoundingClientRect(), o = cv.getBoundingClientRect();
      cx = r.left - o.left + r.width / 2; cy = r.top - o.top + r.height / 2; hw = r.width / 2; hh = Math.max(1, r.height / 2);
    }
    box[0] = cx / W * 2 - 1; box[1] = 1 - cy / H * 2; box[2] = hh / W * 2; box[3] = hh / H * 2; box[4] = hw / hh;
  }

  let [scene, , off0] = target();
  let inten = reduce ? target()[1] : 0, t = 7.0, lastT = 0, lastY = scrollY, vel = 0, slow = 0, raf = 0, running = false;
  const offs = new Array(SCENES).fill(0);
  off0.forEach((v, i) => (offs[i] = v));
  const ptr = [0, 0], ptrT = [0, 0];
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    addEventListener("pointermove", (e) => { ptrT[0] = e.clientX / innerWidth * 2 - 1; ptrT[1] = 1 - e.clientY / innerHeight * 2; }, { passive: true });
  }

  function draw(now) {
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    const [sc, it, off] = target();
    if (reduce) {
      scene = sc; inten = it; off.forEach((v, i) => (offs[i] = v));
    } else {
      const k = 1 - Math.exp(-dt / 260);            // inércia igual em 60 ou 120 Hz
      const ko = 1 - Math.exp(-dt / 70);            // posição acompanha a página quase na hora, sem tremer
      off.forEach((v, i) => (offs[i] += (v - offs[i]) * ko));
      scene += (sc - scene) * k; inten += (it - inten) * (1 - Math.exp(-dt / 400));
      const dy = scrollY - lastY; lastY = scrollY;
      vel += ((dt ? Math.abs(dy) / dt : 0) - vel) * 0.1;
      t += dt / 1000 * (1 + Math.min(3, vel * 1.4));   // o fluxo acelera enquanto rola
      ptr[0] += (ptrT[0] - ptr[0]) * k; ptr[1] += (ptrT[1] - ptr[1]) * k;
    }
    layout();
    const k0 = clamp(Math.floor(scene), 0, SCENES - 2);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uT, t); gl.uniform1f(U.uScene, clamp(scene, 0, SCENES - 1)); gl.uniform1f(U.uK, k0);
    gl.uniform1f(U.uAspect, box[4]); gl.uniform1f(U.uIntensity, inten);
    gl.uniform1f(U.uW, (small ? 4 : 5) * dpr); gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform2f(U.uPtr, ptr[0], ptr[1]);
    gl.uniform2f(U.uOff, offs[k0], offs[k0 + 1]);
    gl.uniform4f(U.uBox, box[0], box[1], box[2], box[3]);
    inst.draw(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, N);

    if (!running) return;
    // aparelho lento (quadros acima de ~28 ms por ~1 s): menos pixels, mesma animação
    if (dt > 28) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 60 && dpr > 1) { dpr = 1; slow = 0; size(true); }
    raf = requestAnimationFrame(draw);
  }
  let near = true;
  const once = () => requestAnimationFrame((now) => { if (!running) { lastT = 0; draw(now); } });
  function start() { if (running || reduce || document.hidden) return; running = true; lastT = 0; raf = requestAnimationFrame(draw); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (reduce) {       // sem animação contínua: desenha uma vez e a cada rolagem, com a cena já no lugar
    addEventListener("scroll", once, { passive: true });
    addEventListener("resize", once);
    once();
  } else if (story && "IntersectionObserver" in window) {   // só anima com a seção (quase) na tela
    near = false;
    new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) start(); else stop(); }, { rootMargin: "200px 0px" }).observe(story);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (near) start(); });
  cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stop(); cv.classList.remove("on"); });
  cv.classList.add("on");
})();
