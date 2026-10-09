# Vídeo e sequência de imagens guiados pela rolagem

O efeito da Apple em que o produto gira, abre ou se monta conforme a pessoa rola. Dois caminhos,
os dois já suportados por `script.js` e `styles.css`:

| | `video[data-scrub]` | `canvas[data-frames]` |
|---|---|---|
| Como funciona | o script ajusta `currentTime` conforme o progresso | desenha o quadro N de uma pasta de imagens |
| Peso | menor (um arquivo comprimido) | maior (uma imagem por quadro) |
| Fluidez | boa, se o vídeo for preparado (abaixo) | a melhor: é o que a Apple usa |
| iPhone | só responde depois do primeiro toque na página | funciona sempre |
| Use quando | cena longa, movimento suave, peso importa | cena curta e central, precisa ser perfeita |

Na dúvida: sequência de imagens para a cena principal (60 a 150 quadros), vídeo para o resto.

## Preparar o material

Vídeo comum não serve para isto: ele guarda um quadro inteiro a cada poucos segundos e só as
diferenças entre eles, então pular para um instante qualquer (e principalmente voltar) exige
decodificar vários quadros e a rolagem engasga. O script abaixo recodifica com **todo quadro sendo
quadro-chave**, sem áudio, e gera o poster:

```bash
.claude/skills/apple-design/tools/make-scrub.sh entrada.mp4 sites/{slug}/assets/cena
# -> assets/cena.mp4 e assets/cena-poster.webp

.claude/skills/apple-design/tools/make-scrub.sh entrada.mp4 sites/{slug}/assets/cena --frames 120
# -> também assets/cena/f_0001.webp ... f_0120.webp (o script informa o data-count)
```

Ajustes por variável: `WIDTH` (padrão 1600), `CRF` (padrão 24; maior = menor e pior), `Q`
(qualidade do webp, padrão 72). Um vídeo só de quadros-chave fica grande: mantenha a cena entre 3 e
8 segundos e confira o tamanho. Alvo: até ~8 MB de vídeo, até ~6 MB de quadros. Para o celular,
gere uma versão menor (`WIDTH=900`) e troque o `src` com `<source media="(max-width: 700px)">`.

O material precisa ter sido feito para isso: movimento contínuo, sem cortes, câmera estável, fundo
da mesma cor do site (ou que termine nela) para as bordas não aparecerem.

## HTML

Seção alta com a mídia presa em tela cheia e legendas por etapa. A altura da seção é a duração:
quanto mais alta, mais devagar o vídeo passa (`.scrub` vem com `380vh`).

```html
<section class="scrub" data-story data-steps="3" aria-label="O produto em movimento">
  <div class="stick">
    <video class="scrub-media" data-scrub muted playsinline preload="auto"
           poster="assets/cena-poster.webp" src="assets/cena.mp4"></video>
    <div class="scrub-shade" aria-hidden="true"></div>
    <div class="wrap">
      <ol class="steps">
        <li data-step="0"><h2>Primeiro momento.</h2><p>O que a pessoa está vendo.</p></li>
        <li data-step="1"><h2>Segundo momento.</h2><p>O que mudou.</p></li>
        <li data-step="2"><h2>Terceiro momento.</h2><p>Onde chegou.</p></li>
      </ol>
    </div>
  </div>
</section>
```

Com sequência de imagens, troque o `<video>` por:

```html
<canvas class="scrub-media" data-frames="assets/cena/f_%04d.webp" data-count="120"
        role="img" aria-label="Descrição do que acontece na cena"></canvas>
```

`%04d` é o número do quadro com quatro dígitos, começando em 1. O primeiro quadro carrega com a
página; os outros entram em fila quando a seção chega perto da tela, e enquanto um quadro não chega
o script mostra o anterior mais próximo.

Variações:

- **Mídia emoldurada** em vez de tela cheia: ponha o `<video data-scrub>` dentro de uma
  `.scene` ou `.device` da cena presa comum; o progresso continua vindo da `[data-story]` em volta.
- **Sem seção presa**: um `video[data-scrub]` solto na página avança enquanto atravessa a tela
  (0 ao entrar por baixo, 1 ao sair por cima). Bom para um detalhe que "abre" ao passar.
- **Junto com o fundo de fibras**: dê à seção `data-fx-intensity="0"` para o fundo apagar enquanto
  o vídeo ocupa a tela.

## O que o script já resolve

- **Inércia**: o tempo mostrado persegue o alvo (constante de ~110 ms), então a roda do mouse, que
  rola em degraus, vira movimento contínuo.
- **Um pedido por vez**: enquanto o vídeo ainda está buscando um instante (`seeking`), o próximo
  espera. Sem isso as buscas se empilham e o vídeo fica para trás.
- **iPhone**: o vídeo é "acordado" no primeiro toque (`play()` seguido de `pause()`); antes disso
  o Safari ignora `currentTime`. Por isso `muted` e `playsinline` são obrigatórios e o `poster` é o
  que aparece até lá.
- **Só trabalha perto da tela** (IntersectionObserver com margem de uma tela) e para o laço quando
  o valor assenta.
- **Reduzir movimento**: continua seguindo a rolagem (é a pessoa que move), mas sem inércia.

## Vídeo comum, que só toca

Para vídeo que toca em loop (mock do produto no herói, por exemplo) não use `data-scrub`:

```html
<video autoplay muted loop playsinline preload="metadata" poster="assets/demo-poster.webp">
  <source src="assets/demo.webm" type="video/webm">
  <source src="assets/demo.mp4" type="video/mp4">
</video>
```

Aqui vale o contrário: compressão normal (sem `-g 1`), arquivo pequeno. No celular, carregue o
`src` só quando o vídeo chegar perto da tela, como a landing do RiskTrade faz.
