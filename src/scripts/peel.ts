// Sticker peeling (só no mobile, < 768px): a ponta do canto inferior direito de cada adesivo parece levantada.
// Nada nos PNGs/SVGs é alterado: o adesivo original só ganha uma máscara que apara o canto, e um irmão (.peel-ov) desenha
// a aba dobrada = o próprio alfa do adesivo, recortado na região do canto, espelhado na linha da dobra, com verso claro e sombra.
// A dobra é calculada a partir do alfa (ponto mais afastado na diagonal ↘), então respeita a silhueta de cada adesivo.
// Toque (sem arrasto) → o adesivo desliza devagar na diagonal ↘; depois continua arrastável (os arrastos já existem em editar-coisas.ts).
const movel = matchMedia('(max-width: 767px)');
const reduz = matchMedia('(prefers-reduced-motion: reduce)');
const alvos = [...document.querySelectorAll<HTMLImageElement>('.estrela .coisa:not(.coisa--so-desktop), .sobre-pilha > .foto-seq__sticker')];
const R2 = Math.SQRT2;
const PONTA = 0.13; // tamanho da ponta: fração de (largura+altura)/2 medida na diagonal
const PASSO = 55; // deslocamento do toque, em px, na diagonal ↘
const DUR = 2000; // ms

const SKIP = new Set(['src', 'srcset', 'sizes', 'width', 'height', 'alt', 'loading', 'decoding', 'data-coisa', 'fetchpriority']);

function montar(img: HTMLImageElement) {
  // o overlay herda classes e atributos (inclusive o escopo de estilo do Astro) e o `style` (posição, giro, translate)
  const ov = document.createElement('span');
  for (const a of img.attributes) if (!SKIP.has(a.name) && a.name !== 'style') ov.setAttribute(a.name, a.value);
  ov.classList.add('peel-ov');
  ov.setAttribute('aria-hidden', 'true');
  const sombra = document.createElement('span');
  sombra.className = 'peel__sombra';
  const aba = document.createElement('span');
  aba.className = 'peel__aba';
  sombra.append(aba);
  ov.append(sombra);
  img.after(ov);
  let ratio = '';
  const copiar = () => {
    ov.style.cssText = img.style.cssText;
    if (ratio) ov.style.aspectRatio = ratio;
  };
  copiar();
  new MutationObserver(copiar).observe(img, { attributes: true, attributeFilter: ['style'] });

  let smaxFrac = 0; // x+y máximo entre pixels opacos, como fração da largura do bitmap amostrado (uniforme com a escala)
  let amostra = 0;
  const amostrar = () => {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return false;
    const s = Math.min(1, 160 / Math.max(nw, nh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(nw * s));
    c.height = Math.max(1, Math.round(nh * s));
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return false;
    try {
      g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let m = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40 && x + y > m) m = x + y;
      amostra = c.width;
      smaxFrac = m / c.width;
      return true;
    } catch {
      return false; // canvas bloqueado: sem peeling neste adesivo
    }
  };

  const layout = () => {
    const W = img.offsetWidth;
    const H = img.offsetHeight;
    if (!W || !H || !amostra) return;
    ratio = `${W} / ${H}`;
    ov.style.aspectRatio = ratio;
    const smax = smaxFrac * W; // x+y máximo na silhueta, em px de tela
    const d = PONTA * ((W + H) / 2) * R2;
    const D = smax - d; // a dobra é a reta x + y = D
    const t = D / R2; // posição da dobra no gradiente de 135°
    const t1 = smax / R2;
    const url = `url("${img.currentSrc || img.src}")`;
    // original: só a parte antes da dobra (a máscara não altera o hit-test)
    img.style.setProperty('--peel-mask', `linear-gradient(135deg, #000 ${(t - 0.5).toFixed(1)}px, transparent ${t.toFixed(1)}px)`);
    // aba: alfa do adesivo ∩ região além da dobra, espelhada na reta (matrix 0 -1 -1 0 D D), com verso acetinado
    aba.style.cssText = [
      `-webkit-mask-image:${url},linear-gradient(135deg,transparent ${(t - 0.5).toFixed(1)}px,#000 ${t.toFixed(1)}px)`,
      `mask-image:${url},linear-gradient(135deg,transparent ${(t - 0.5).toFixed(1)}px,#000 ${t.toFixed(1)}px)`,
      `transform:matrix(0,-1,-1,0,${D.toFixed(1)},${D.toFixed(1)})`,
      `background:linear-gradient(135deg,#ffffff ${t.toFixed(1)}px,#f1f3f7 ${(t + (t1 - t) * 0.35).toFixed(1)}px,#d3d8e0 ${(t + (t1 - t) * 0.7).toFixed(1)}px,#aab1bd ${t1.toFixed(1)}px)`,
    ].join(';');
  };

  const pronto = () => {
    if (!amostrar()) return;
    layout();
    new ResizeObserver(layout).observe(img);
  };
  if (img.complete && img.naturalWidth) pronto();
  else img.addEventListener('load', pronto, { once: true });

  // ---- toque: desliza devagar na diagonal ↘ (translate separado do transform, não colide com giro/posição) ----
  let anim = 0;
  let tx = 0;
  let ty = 0;
  const pos = (x: number, y: number) => {
    tx = x;
    ty = y;
    const v = x || y ? `${x.toFixed(1)}px ${y.toFixed(1)}px` : '';
    img.style.translate = v;
    ov.style.translate = v;
  };
  const parar = () => cancelAnimationFrame(anim);
  // adesivo da pilha posiciona com left/top: ao pegar, incorpora o deslocamento na posição (sem salto no arrasto)
  const incorporar = () => {
    if (!img.classList.contains('foto-seq__sticker') || (!tx && !ty)) return;
    const pr = img.parentElement!.getBoundingClientRect();
    img.style.left = `${(((img.offsetLeft + tx) / pr.width) * 100).toFixed(2)}%`;
    img.style.top = `${(img.offsetTop + ty).toFixed(1)}px`;
    pos(0, 0);
  };
  let t0 = 0;
  let x0 = 0;
  let y0 = 0;
  let moveu = false;
  img.addEventListener(
    'pointerdown',
    (e) => {
      if (!movel.matches) return;
      parar();
      incorporar();
      t0 = performance.now();
      x0 = e.clientX;
      y0 = e.clientY;
      moveu = false;
    },
    true,
  );
  img.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) moveu = true;
  });
  img.addEventListener('pointerup', () => {
    if (!movel.matches || moveu || performance.now() - t0 > 400 || reduz.matches) return;
    const r = img.getBoundingClientRect();
    const alvo = Math.max(0, Math.min(PASSO / R2, innerWidth - 4 - r.right, innerHeight - 4 - r.bottom)); // não sai da tela
    const ix = tx;
    const iy = ty;
    const ini = performance.now();
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - ini) / DUR);
      const e = 1 - (1 - p) ** 3; // ease-out
      pos(ix + alvo * e, iy + alvo * e);
      if (p < 1) anim = requestAnimationFrame(passo);
    };
    anim = requestAnimationFrame(passo);
  });
}

for (const img of alvos) montar(img);
