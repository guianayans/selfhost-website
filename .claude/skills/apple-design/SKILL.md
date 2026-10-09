---
name: apple-design
description: Cria sites de produto no estilo Apple / RiskTrade / TerminalSec para o Website Manager — fundo animado em WebGL que muda de forma com a rolagem, cena presa na tela que avança por etapas, vídeo ou sequência de imagens guiados pela rolagem, tipografia grande e mosaico de recursos. Use quando o pedido for um site, landing page ou página de produto "estilo Apple", "igual ao RiskTrade/TerminalSec", com animação de fundo que acompanha a rolagem, scrollytelling ou vídeo que avança com o scroll.
---

# apple-design

Sites estáticos (HTML, CSS e JS puros, sem build) publicados pelo Website Manager em `sites/{slug}/`.
O ponto de partida é o template desta pasta, que já funciona: o trabalho é dar a ele a história, as
formas e a identidade do produto, e não reescrever o motor.

```
template/index.html   estrutura: barra, herói, cena presa, números, mosaico, chamada final
template/styles.css   identidade no bloco :root; o resto é o layout
template/script.js    motor de rolagem (etapas, vídeo, quadros, entradas, contadores, parallax)
template/fx.js        fundo de fibras de luz em WebGL; as formas ficam no bloco FORMAS
reference/fibras-webgl.md   como desenhar formas novas e ligá-las às seções
reference/scroll-video.md   vídeo e sequência de imagens guiados pela rolagem
tools/make-scrub.sh         prepara um vídeo (todo quadro é quadro-chave) e exporta quadros
tools/preview.sh            serve o site como o painel e tira capturas ao longo da rolagem
```

## O que faz um site desses funcionar

O RiskTrade e o TerminalSec impressionam pelo mesmo motivo: **o fundo conta a história do produto**.
As mesmas fibras de luz se reorganizam, conforme a pessoa rola, em desenhos que significam alguma
coisa para aquele produto:

- TerminalSec: símbolo `[>_]` → vórtice (ataques convergindo) → feixes (eventos saindo da máquina)
  → onda (os números) → escudo que se fecha atrás da chamada final.
- RiskTrade: ruído → candles → curva de patrimônio com drawdown → a mesma curva parando no limite
  de risco → seta de alta.

Formas genéricas (as do template: órbita, feixes, onda, anel) servem para o site ficar de pé, mas um
site entregue com elas é um site sem ideia. Antes de escrever código, escreva a sequência de 3 a 5
desenhos e o que cada um quer dizer. A última forma deve ser um símbolo fechado do produto, que
emoldura o texto da chamada final.

O resto vem de poucas regras, todas já aplicadas no template:

- **Uma ideia por tela.** Título curto e afirmativo, com ponto final. Um apoio de duas linhas. Uma ação.
- **Tipografia grande e apertada**: títulos com `clamp()`, peso 700, `letter-spacing` negativo,
  `line-height` perto de 1. Texto de apoio em cinza, nunca branco puro.
- **Uma cor de marca**, usada em botão, destaque e progresso. Fundo quase preto puxado para o tom
  da marca. As fibras usam a cor da marca e dois acentos (a minoria das fibras).
- **A rolagem é o controle**: nada se move sozinho de um lugar para outro; o que se move, se move
  porque a pessoa rolou, com inércia (o valor mostrado persegue o alvo, não pula). Nunca sequestre
  a rolagem (sem `preventDefault` em wheel/touch, sem scroll-snap obrigatório).
- **Brilho menor onde há leitura**: `data-fx-intensity` baixo nas seções com muito texto, alto no
  herói e na chamada final.
- **O produto de verdade aparece**: capturas, mocks feitos em HTML com dados plausíveis, vídeo
  curto. Nada de ilustração genérica nem ícones decorativos.

## Passo a passo

1. **Entenda o produto** antes de tudo: o que é, para quem, qual problema resolve, qual o resultado.
   Se o site é de um projeto que existe na máquina (ex.: outra pasta em `/pendriver/`), leia o
   projeto: nomes de telas, números reais e vocabulário saem de lá. Se faltar algo que só o usuário
   sabe (nome, cores da marca, para onde o botão leva), pergunte de uma vez só.
2. **Escreva o roteiro**: frase do herói, 3 a 5 etapas da cena presa (problema → o que o produto
   faz → o que a pessoa passa a ver → onde ela chega), 3 ou 4 números verdadeiros, recursos do
   mosaico, frase final. Ao lado de cada parte, a forma do fundo e o que ela significa.
3. **Copie o template**: `cp -r .claude/skills/apple-design/template sites/{slug}` (slug só com
   `a-z`, `0-9` e `-`). Atenção: neste servidor `sites/` é a pasta publicada. O que for salvo ali
   está no ar na hora, em `/{slug}/`. Se o usuário não quiser publicar ainda, trabalhe fora de
   `sites/` e copie no fim.
4. **Identidade**: troque o bloco `:root` de `styles.css` (fundo, superfície, cor da marca,
   `--fx-1..3`, fontes). Fontes próprias em `assets/fonts/*.woff2` com `@font-face`.
5. **Conteúdo**: escreva o `index.html` a partir do roteiro. Monte as cenas da etapa
   (`.scene[data-step]`) com o produto de verdade. Remova seções que não servem ao roteiro e
   acrescente as que faltam, sempre marcando `data-fx-scene`.
6. **Formas**: reescreva o bloco FORMAS de `fx.js` seguindo `reference/fibras-webgl.md`.
7. **Vídeo guiado pela rolagem**, se houver material: `reference/scroll-video.md`.
8. **Confira no navegador** (seção abaixo) e corrija o que as capturas mostrarem.

## Regras do Website Manager

- O site é servido em `/{slug}/`: **todo caminho é relativo** (`styles.css`, `assets/x.webp`),
  nunca começando com `/`.
- Sem build e sem dependências: nada de npm, bundler, framework ou CDN de biblioteca. Fontes do
  Google são aceitáveis; hospedar o `.woff2` no site é melhor.
- Extensões aceitas pelo painel: html, css, js, json, svg, png, jpg, webp, gif, ico, woff, woff2,
  ttf, otf, mp4, webm, mp3, pdf, webmanifest. Upload pelo painel limitado a `MAX_UPLOAD_MB` (50);
  arquivos maiores vão por rsync.
- O servidor responde a pedidos parciais (Range), então o vídeo pode ser buscado em qualquer ponto.
- Arquivos alterados valem na hora: não é preciso reiniciar o container.
- O deploy do Mac (`scripts/deploy-from-mac.sh`) usa `rsync --delete`: um site criado direto no
  servidor some no próximo deploy se não existir também no Mac. Avise o usuário ao terminar.

## O que o motor oferece (atributos no HTML)

| Atributo | Efeito |
|---|---|
| `data-fx-scene="n"` + `data-fx-intensity="0..1"` | a seção escolhe a forma e o brilho do fundo |
| `data-story` (+ `data-steps`) | seção alta com `.stick` presa; expõe `--sp` (0..1) e `data-step` |
| `data-step="n"` dentro da história | o elemento ganha `.on` só na etapa n (legendas e cenas) |
| `video[data-scrub]` | o tempo do vídeo segue a rolagem |
| `canvas[data-frames][data-count]` | sequência de imagens segue a rolagem |
| `data-reveal` | entra ao aparecer; irmãos em cascata |
| `data-count="653"` | conta de 0 até o valor ao aparecer |
| `data-parallax="0.1"` | desloca devagar em relação à rolagem |

A altura da seção `[data-story]` é a duração da cena: cerca de `100vh` por etapa mais `40vh` de
folga (4 etapas = `440vh`). Para reagir a uma etapa (iniciar um contador, preencher um mock), escute
`story:step` na seção: `e.detail.step`.

O fundo tem dois modos, decididos pela posição do `<canvas id="fx">`:

- **Página** (TerminalSec): canvas fixo, filho do `<body>`; cada seção marca a sua cena.
- **História** (RiskTrade): canvas dentro da `.stick` de uma `[data-story]`; o progresso da seção
  percorre as cenas e as formas cabem no elemento marcado com `data-fx-box` (em geral a `.stage`).

## Não negociável

- **Fundo escuro.** As fibras somam luz (`blendFunc(ONE, ONE)`): sobre fundo claro elas somem. Se o
  site pedir tema claro, use faixas escuras para as seções com fundo animado.
- **Leitura acima do efeito.** Texto sobre fibras leva a `text-shadow` escura do template e a seção
  leva intensidade baixa. Se uma forma passa por trás de um parágrafo, mova a forma.
- **Celular é outro layout**, não o mesmo encolhido: em `uAspect < 1.0` as formas mudam de posição
  (o texto ocupa a largura toda), a cena presa empilha (palco em cima, legenda embaixo).
- **`prefers-reduced-motion`**: o fundo desenha parado e só troca de cena, nada desliza nem conta.
  O template já faz; não quebre ao acrescentar animações.
- **Sem WebGL a página continua completa.** O canvas é decoração; nenhum conteúdo depende dele.
- **Sem rolagem horizontal** em nenhuma largura. Itens de grid com `min-width: 0`.
- **Desempenho**: uma chamada de desenho, DPR limitado a 2 (1.5 no celular), queda automática de
  resolução em aparelho lento. Não acrescente um segundo canvas WebGL na mesma página, nem
  `filter: blur()` animado em áreas grandes, nem listeners de scroll que leem layout fora do
  `requestAnimationFrame`.

## Conferir antes de entregar

```bash
.claude/skills/apple-design/tools/preview.sh sites/{slug} --out /tmp/shots-{slug} --steps 10
```

Gera capturas de 10 pontos da rolagem em 1440×900 e 390×844 e lista erros de console, arquivos que
não carregaram, rolagem horizontal e WebGL que não ligou. Abra as capturas e verifique: cada forma é
reconhecível; nenhuma forma atrapalha a leitura; a última se fecha em volta do texto final com a
página no fim; a cena presa mostra uma etapa por vez; no celular nada estoura a largura. Vídeo ou
quadros devem aparecer em instantes diferentes em capturas diferentes.

O navegador headless desenha o WebGL por software: serve para ver forma e posição, não fluidez.
Diga ao usuário o que foi conferido assim e o que só ele vê num aparelho de verdade (fluidez em
120 Hz, iPhone).
