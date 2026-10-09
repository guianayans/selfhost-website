# Fibras de luz: como desenhar as formas do fundo

O fundo é feito de ~176 fibras (96 no celular). Cada fibra é uma tira fina de triângulos com 220
segmentos; todas compartilham a mesma geometria e são desenhadas numa única chamada (instancing).
Quem decide onde cada ponto fica é o vertex shader, em `fx.js`, no bloco **FORMAS**. Uma forma é
uma função que, para cada ponto de cada fibra, devolve uma posição:

```glsl
vec2 minhaForma(float s, float lane, float seed) { ... return vec2(x, y); }
```

| Entrada | Significado |
|---|---|
| `s` | 0..1 ao longo da fibra (do começo ao fim do traço) |
| `lane` | 0..1, qual fibra é (distribuídas em ordem, com um pouco de acaso) |
| `seed` | 0..1, número aleatório fixo da fibra |
| `uT` | tempo em segundos (acelera enquanto a pessoa rola) |
| `uAspect` | largura ÷ altura da área. `< 1.0` = tela em pé |

Sistema de coordenadas: `y` vai de -1 (base) a 1 (topo) da área; `x` de `-uAspect` a `+uAspect`.
No modo página a área é a tela inteira; no modo história é o elemento `[data-fx-box]`. O centro
`(0, 0)` é o centro da área.

A troca entre duas formas é automática: o shader calcula a posição do mesmo ponto nas duas e
interpola, cada fibra no seu tempo (`seed` atrasa umas em relação às outras). Por isso a transição
parece orgânica sem nenhum código extra, e por isso **toda forma precisa dar lugar a todas as
fibras**: uma fibra sem lugar numa forma fica amontoada num ponto e brilha demais.

## Receitas

**Traço ao longo de uma curva** (linha, onda, gráfico). `s` percorre o `x`, `lane` engrossa o feixe:

```glsl
vec2 curva(float s, float lane, float seed) {
  float u = mix(-0.95, 0.95, s);                       // de uma borda à outra
  float y = 0.4 * u + 0.1 * sin(u * 5.0)               // a curva em si
          + (lane - 0.5) * 0.09                        // espessura do feixe
          + 0.012 * sin(u * 31.0 + uT * 1.3 + seed * 40.0);   // vida: tremor fino
  return vec2(u * uAspect, y);
}
```

**Contorno fechado** (escudo, anel, logotipo). Uma função de caminho `u` 0..1 → ponto, com
`fract(u)` para fechar; `lane` afasta as fibras um pouco para dar espessura. Marque `gOpen = 0.0`
para as pontas não sumirem e baixe `gA`, porque fibras sobrepostas somam brilho:

```glsl
vec2 caminho(float u) {                                // polígono ou curvas de Bézier por trechos
  u = fract(u);
  if (u < 0.25) return mix(vec2(0.0, 1.0), vec2(-1.0, 0.0), u / 0.25);
  if (u < 0.50) return mix(vec2(-1.0, 0.0), vec2(0.0, -1.0), (u - 0.25) / 0.25);
  if (u < 0.75) return mix(vec2(0.0, -1.0), vec2(1.0, 0.0), (u - 0.50) / 0.25);
  return mix(vec2(1.0, 0.0), vec2(0.0, 1.0), (u - 0.75) / 0.25);
}
vec2 losango(float s, float lane, float seed) {
  gOpen = 0.0; gA = 0.3;
  float sz = min(0.6, 0.85 * uAspect);                 // cabe na altura e na largura
  return caminho(s) * sz * (1.0 + (lane - 0.5) * 0.16);
}
```

Trecho curvo: Bézier quadrática com `mix(mix(a, c, t), mix(c, b, t), t)`.

**Várias partes numa forma só** (colchetes + seta, candles, curva + linha de limite). Divida as
fibras por faixas de `lane`, cada faixa desenha uma parte:

```glsl
vec2 simbolo(float s, float lane, float seed) {
  vec2 q;
  if (lane < 0.70)      q = caminho(s);                               // 70% das fibras: o contorno
  else if (lane < 0.85) q = mix(vec2(-0.4, 0.3), vec2(0.0, 0.0), s);  // 15%: um traço
  else                  q = mix(vec2(0.1, -0.3), vec2(0.5, -0.3), s); // 15%: outro traço
  return q * 0.6;
}
```

Para N objetos iguais (velas, barras, colunas): `float i = floor(lane * N), w = fract(lane * N);`.
`i` é o objeto, `w` a posição da fibra dentro dele. O número de fibras deve ser múltiplo de N para
todos ficarem com a mesma quantidade (ajuste a constante `N` das fibras em `fx.js`).

**Nuvem / ruído** (o "antes", o caos): traços curtos espalhados, cada fibra num lugar sorteado por
`fract(sin(lane * 127.1) * 43758.5)`, comprimento `(s - 0.5) * 0.3` numa direção sorteada.

**Convergência** (tudo indo para um ponto): veja `orbit` no template.

## Regras para a forma ficar boa

- **Posição pensada com o texto.** A forma passa pelo espaço vazio do layout (embaixo dos números,
  no vão entre texto e imagem), não por trás de parágrafo. Em `uAspect < 1.0` o layout é outro:
  use `uAspect < 1.0 ? ... : ...` para mudar base, tamanho e foco.
- **`uT` dá vida, não desloca.** Use para ondular, tremer, fazer correr o tracejado
  (`fract(s * 22.0 - uT * 0.35)`). A forma não deve passear pela tela sozinha.
- **Brilho por forma** com `gA`: fibras espalhadas aguentam 1.0; fibras sobrepostas num contorno
  pedem 0.3 a 0.45. Se uma forma estoura em branco, baixe `gA` antes de mexer em qualquer outra coisa.
- **Cabe na tela em pé e deitada**: tamanhos com `min(0.6, 0.85 * uAspect)`.
- **Uma forma por ideia do roteiro**, de 3 a 5 no total. Atualize `SCENES` e a função `shape()`
  (a última cai no `return` final) sempre que acrescentar ou tirar uma.
- **Cores por significado**, quando o produto pede (alta em verde, baixa em rosa; risco em âmbar):
  troque a linha `vCol = ...` do `main()` por uma cor decidida dentro da forma, guardando-a numa
  variável global como `gA` (`vec3 gCol;`, lida depois de cada chamada de `shape`, e interpolada com
  `fi` como o brilho). O RiskTrade faz assim em `trade-story-gl.ts`.

Erro de GLSL não quebra a página: o canvas é removido e o console mostra
`[fx] fundo animado desativado:` com a linha do erro. O `preview.sh` acusa isso.

## Ligando formas às seções

**Modo página.** Cada seção marca `data-fx-scene="n"`. O meio da tela decide: entre o centro de uma
seção e o da seguinte a cena é interpolada. Detalhes que já estão resolvidos em `fx.js` e valem
saber:

- Várias seções seguidas podem usar a mesma cena (números e mosaico na onda, por exemplo): a forma
  fica parada na tela enquanto o meio da tela está entre elas.
- Valor quebrado (`data-fx-scene="2.35"`) deixa a seção num meio-termo a caminho da próxima forma.
- Uma seção `[data-story]` segura a sua cena durante toda a parte presa.
- A última seção nunca chega ao meio da tela; o gatilho dela é ajustado para a forma se completar
  exatamente no fim da rolagem. Por isso a chamada final ocupa a tela inteira (`.final`) e a última
  forma é desenhada em volta da origem, onde o texto fica.
- Cada forma sobe e desce junto com a sua seção (`data-fx-follow` no canvas: 0.85 por padrão;
  1 = presa ao conteúdo, 0 = parada na tela).

**Modo história.** O canvas vai dentro da `.stick` e as formas são desenhadas dentro do elemento
com `data-fx-box`. O progresso da seção percorre as cenas com um descanso em cada uma (20% parado,
60% trocando, 20% parado), então legenda e forma mudam juntas. O número de cenas usadas é o número
de etapas (`data-steps` ou os filhos de `.steps`), que não pode passar de `SCENES`.

```html
<section class="story" data-story>
  <div class="stick">
    <canvas id="fx" aria-hidden="true"></canvas>
    <div class="wrap story-grid">
      <ol class="steps"> ...legendas com data-step... </ol>
      <div class="stage" data-fx-box aria-hidden="true"></div>
    </div>
  </div>
</section>
```

Escolha um modo por site. Página quando o fundo acompanha o site inteiro; história quando as formas
são o próprio conteúdo de uma seção (um gráfico que se monta, por exemplo) e o resto do site tem
fundo próprio.

## De onde isto veio

- `/pendriver/terminalsec/server/static/landing/fx.js`: modo página, com o símbolo inicial preso a
  um elemento do layout (`uPrompt`, medido pelo script) e o escudo final.
- `/pendriver/risktrade/src/components/landing/trade-story-gl.ts`: modo história, com cor e brilho
  por forma e as fibras "voando" no meio da troca (`swirl`).

Leia os dois quando precisar de uma forma mais elaborada: são a melhor biblioteca de exemplos.
