// Microinterações tipográficas (textos Manrope que não são botões): marque o elemento com data-tx.
//  - Text Appear: ao entrar no viewport, as letras surgem em sequência (translateY sutil + opacidade + leve blur).
//  - Text Pressure: depois da entrada, as letras próximas ao cursor ganham peso (eixo wght da Manrope variável),
//    com inércia. A Manrope não tem eixos de largura nem itálico, então só o peso reage.
// Sem layout shift: cada palavra tem largura fixa (a medida em repouso), então o peso não empurra o texto.
// Acessibilidade: o texto original fica num span só para leitores de tela; as letras são aria-hidden.
// Telas de toque: só a entrada. prefers-reduced-motion: texto sempre visível e estático.
const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
// Teste do Text Pressure do React Bits (props: radius 0.5, smoothing 0.85, idle "pulse", idleSpeed 1, weight, italic).
// Fora do que a Manrope suporta ou do que preservamos do layout: flex/minFontSize (o texto não se auto-ajusta à largura),
// width (sem eixo de largura), alpha, stroke, clickRipple. Italic: a Manrope não tem eixo ital; usamos oblique sintético.
// VERSÃO ANTERIOR (para voltar atrás): raio = max(110, fontSize*3.4), inércia 0.14, sem idle e sem oblique.
const PESO_MAX = 800;
const RAIO = 0.5; // fração da largura do bloco
const SMOOTHING = 0.85; // quanto do estado anterior se mantém a cada quadro
const IDLE_VEL = 1; // velocidade do pulso em repouso
const IDLE_PARADO = 1400; // ms sem mexer o mouse para o pulso assumir
const OBLIQUO_MAX = 9; // graus, no peso máximo

type Letra = { el: HTMLElement; peso: number; cx: number; cy: number }; // cx, cy: centro da letra relativo ao canto do bloco (medido em repouso)
type Bloco = {
  el: HTMLElement;
  base: number;
  letras: Letra[];
  palavras: HTMLElement[];
  total: number; // duração da entrada (ms), para só ativar a pressão depois dela
  ativo: boolean;
  timer: number;
  visivel: boolean; // dentro (ou perto) do viewport: fora dele a pressão/pulso não precisa rodar
};
const blocos = new Map<HTMLElement, Bloco>();
// só os blocos à vista animam: o pulso mexe no peso de cada letra a cada quadro (recálculo de estilo + reforma do texto),
// e blocos fora da tela gastavam esse custo (e uma leitura de layout por bloco) à toa. O resultado visual é idêntico.
const vistos = new Set<Element>();
const observador = new IntersectionObserver(
  (es) => {
    for (const e of es) {
      if (e.isIntersecting) vistos.add(e.target);
      else vistos.delete(e.target);
      const b = blocos.get(e.target as HTMLElement);
      if (b) b.visivel = e.isIntersecting;
    }
  },
  { rootMargin: '120px' },
);
let mx = -1e4;
let my = -1e4;
let ultimoMove = 0;
let rodando = false;

function preparar(el: HTMLElement) {
  if (blocos.has(el)) return;
  const texto = el.textContent ?? '';
  const nodes = [...el.childNodes];
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = texto.replace(/\s+/g, ' ').trim();
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  el.append(sr, vis);
  el.classList.add('tx');

  const letras: Letra[] = [];
  const palavras: HTMLElement[] = [];
  let i = 0;
  for (const n of nodes) {
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR') {
      const br = document.createElement('br');
      br.className = (n as Element).className; // preserva classes (ex.: quebras só do web)
      vis.append(br);
      continue;
    }
    for (const parte of (n.textContent ?? '').split(/(\s+)/)) {
      if (!parte) continue;
      if (/^\s+$/.test(parte)) {
        vis.append(' ');
        continue;
      }
      const w = document.createElement('span');
      w.className = 'palavra';
      for (const ch of parte) {
        const l = document.createElement('span');
        l.className = 'letra';
        l.textContent = ch;
        l.style.setProperty('--i', String(i++));
        w.append(l);
        letras.push({ el: l, peso: 0, cx: 0, cy: 0 });
      }
      vis.append(w);
      palavras.push(w);
    }
  }
  const base = parseInt(getComputedStyle(el).fontWeight) || 500;
  const passo = Math.min(18, 1100 / Math.max(1, letras.length)); // textos longos entram mais rápido por letra
  for (const l of letras) {
    l.peso = base;
    l.el.style.setProperty('--passo', `${passo}ms`);
  }
  blocos.set(el, { el, base, letras, palavras, total: letras.length * passo + 800, ativo: false, timer: 0, visivel: vistos.has(el) });
  observador.observe(el);
}

/** libera as larguras fixas (antes de mudar o tamanho da fonte) */
export function liberarLarguras() {
  for (const b of blocos.values()) for (const p of b.palavras) p.style.width = '';
}

/** largura fixa por palavra (medida em repouso): o peso variável não desloca o resto da linha */
export function medir() {
  const todas = [...blocos.values()].flatMap((b) => b.palavras);
  for (const p of todas) p.style.width = '';
  const larguras = todas.map((p) => p.getBoundingClientRect().width);
  todas.forEach((p, k) => (p.style.width = `${larguras[k]}px`));
  // centros das letras relativos ao bloco, medidos sem transform (a entrada move as letras): o quadro não lê mais o layout por letra
  document.documentElement.classList.add('tx-medindo');
  for (const b of blocos.values()) {
    const rb = b.el.getBoundingClientRect();
    for (const l of b.letras) {
      const r = l.el.getBoundingClientRect();
      l.cx = r.left + r.width / 2 - rb.left;
      l.cy = r.top + r.height / 2 - rb.top;
    }
  }
  document.documentElement.classList.remove('tx-medindo');
}

// o IntersectionObserver considera a geometria, não `visibility`/`opacity`: textos de seções escondidas (ex.: versos do GIF com a estrela invisível) seguiam animando
const visivelDeFato = (el: HTMLElement) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true, checkVisibilityCSS: true } as CheckVisibilityOptions) : true);

let par = false;
function quadro(agora: number) {
  const parado = agora - ultimoMove > IDLE_PARADO;
  par = !par; // o pulso em repouso (lento e suave) atualiza a cada 2 quadros (30 Hz): metade do custo de estilo/texto, sem diferença visível; a resposta ao mouse segue a 60 Hz
  // fase 1: só leituras (um retângulo por bloco); fase 2: só escritas. Sem leituras de layout por letra e sem vai-e-volta leitura/escrita.
  // com o mouse parado o retângulo não é usado (só o pulso): sem leitura de layout, evita recalcular estilo/layout duas vezes por quadro
  const ativos: { b: Bloco; r: DOMRect | null }[] = [];
  for (const b of blocos.values()) if (b.ativo && b.visivel && visivelDeFato(b.el)) ativos.push({ b, r: parado ? null : b.el.getBoundingClientRect() });
  for (const { b, r } of ativos) {
    const raio = r ? Math.max(100, r.width * RAIO) : 0;
    const perto = !!r && !parado && mx > r.left - raio && mx < r.right + raio && my > r.top - raio && my < r.bottom + raio;
    const amp = (b.letras.length > 60 ? 0.14 : 0.32) * (PESO_MAX - b.base); // pulso mais discreto em texto longo
    b.letras.forEach((l, k) => {
      let alvo = b.base;
      let sm = SMOOTHING;
      if (perto) {
        const d = Math.hypot(mx - (r!.left + l.cx), my - (r!.top + l.cy));
        alvo = b.base + (PESO_MAX - b.base) * (1 - Math.min(1, d / raio)) ** 2;
      } else if (!reduzir) {
        if (par) return; // pulso em repouso: só nos quadros pares
        sm = SMOOTHING * SMOOTHING; // um passo a cada 2 quadros = dois passos de suavização, para o mesmo ritmo
        // idle "pulse": onda de peso percorrendo as letras
        alvo = b.base + amp * (0.5 + 0.5 * Math.sin((agora / 1000) * IDLE_VEL * 2.2 - k * 0.32));
      }
      const novo = l.peso * sm + alvo * (1 - sm);
      if (Math.abs(novo - l.peso) > 0.05) {
        l.peso = novo;
        const t = clamp01((novo - b.base) / (PESO_MAX - b.base));
        l.el.style.fontVariationSettings = `'wght' ${novo.toFixed(1)}`;
        l.el.style.fontStyle = t > 0.02 ? `oblique ${(t * OBLIQUO_MAX).toFixed(1)}deg` : '';
      }
    });
  }
  requestAnimationFrame(quadro);
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** troca o texto de um bloco já usado (ex.: info do card): refaz as letras e entra de novo com o Text Appear */
export function reescrever(el: HTMLElement, texto: string) {
  const b = blocos.get(el);
  if (b) {
    clearTimeout(b.timer);
    blocos.delete(el);
  }
  el.classList.remove('tx', 'is-visivel');
  el.textContent = texto;
  preparar(el);
  medir();
  requestAnimationFrame(() => requestAnimationFrame(() => revelar(el, true)));
}

export function prepararTipografia() {
  document.querySelectorAll<HTMLElement>('[data-tx]').forEach(preparar);
  document.fonts?.ready.then(medir);
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(medir, 150);
  });
  if (mouse && !reduzir && !rodando) {
    rodando = true;
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'mouse') {
          mx = e.clientX;
          my = e.clientY;
          ultimoMove = performance.now();
        }
      },
      { passive: true },
    );
    requestAnimationFrame(quadro);
  }
}

/** mostra/esconde o texto (dispara o Text Appear); a pressão só liga quando a entrada termina */
export function revelar(el: HTMLElement, on: boolean) {
  const b = blocos.get(el);
  if (!b || el.classList.contains('is-visivel') === on) return;
  el.classList.toggle('is-visivel', on);
  clearTimeout(b.timer);
  if (on && el.hasAttribute('data-sem-pressao')) b.ativo = false; // só entrada, sem a pressão de peso
  else if (on) b.timer = window.setTimeout(() => (b.ativo = true), reduzir ? 0 : b.total + 600 + Number(el.dataset.txAtraso ?? 0));
  else {
    b.ativo = false;
    for (const l of b.letras) {
      l.peso = b.base;
      l.el.style.fontVariationSettings = '';
      l.el.style.fontStyle = '';
    }
  }
}
