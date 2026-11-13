// Experiência de entrada (home). Uma linha do tempo, em ms desde o início:
//   0 – 800        Juju vermelha; cards soltos flutuam ao redor dela (sem tapá-la)
//   800 – 2400     cada card entra no computador dela
//   a navbar só entra (de leve) quando a esfera aparece; a seta dupla pula a abertura
//   2000 – 4100    saem enfileirados, na horizontal (80% da largura), num novo viewport; a câmera desce
//   2600 – 6800    o fundo vai do off white ao vermelho
//   4300 – 9700    zoom + travelling: a câmera passa por cada card da fila
//   9700 – 11400   a câmera recua e a fila explode numa esfera feita de cards alinhados
//   depois         a esfera gira sozinha; arrastar gira; clicar expande o card; ctrl+roda/pinça aproximam
//   rolar          1ª rolagem: a esfera diminui de leve; a estrela offwhite sobe de baixo, tapando a esfera aos poucos;
//                  a estrela cresce até cobrir 100% da tela (a estrela ocupa 60% da altura), o offwhite toma a tela (fade temporal) e o GIF surge no centro; na galeria vale o mesmo, depois do fim da lista
//                  (os viewports de frase e projetos ficam para depois: componentes mantidos, fora da home)
// Tudo é 2D (posição + escala por card, com profundidade calculada à mão): sem CSS 3D, sem cortes entre cards.
import { prepararTipografia, revelar, reescrever, medir, liberarLarguras } from './tipografia.ts';

const camera = document.querySelector<HTMLElement>('[data-camera]');
const linhas = document.querySelector<HTMLElement>('[data-linhas]');
const pular = document.querySelector<HTMLElement>('[data-pular]');
const esfera = document.querySelector<HTMLElement>('[data-esfera]');
import { paleta } from './paleta';
const jujuImg = document.querySelector<HTMLElement>('[data-juju]');
const area = document.querySelector<HTMLElement>('.page--canvas');
const estrela = document.querySelector<HTMLElement>('[data-estrela]');
const mundo = document.querySelector<HTMLElement>('[data-mundo]');
const secao = document.querySelector<HTMLElement>('.sobre-seq');
type Cor = [number, number, number];
const OFF: Cor = [249, 255, 225];
const RED: Cor = [127, 22, 22];
const LBLUE: Cor = [190, 245, 252];
const misturar = (a: Cor, b: Cor, t: number): Cor => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css3 = (c: Cor) => `rgb(${c.map(Math.round).join(' ')})`;
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.nav__link[href^="/#"]')];
let navSecao = '';
// posições em cache (em relação ao mundo, sem a translação): evita getBoundingClientRect/getComputedStyle a cada quadro
let tyAtual = 0;
let SUPER = 1; // fator de super-resolução dos cards (ver layout da esfera)
let dprPx = Math.max(1, window.devicePixelRatio || 1); // a rolagem cai em pixels físicos: sem emendas de meio pixel entre as seções
const medidas = new Map<HTMLElement, { base: number; w: number; h: number }>();
const medirMovel = () => {
  for (const el of document.querySelectorAll<HTMLElement>('.foto-seq__fig, .proj__img, [data-tx="proj"]')) {
    const r = el.getBoundingClientRect();
    medidas.set(el, { base: r.top - tyAtual, w: r.width, h: r.height });
  }
};
let camH = 0;
const secSobre = document.querySelector<HTMLElement>('.sobre-seq');
const secRod = document.querySelector<HTMLElement>('.rod-seq');
const secProj = document.querySelector<HTMLElement>('.proj-seq');
const secFoto = document.querySelector<HTMLElement>('.foto-seq');
const fotos = [...document.querySelectorAll<HTMLElement>('.foto-seq__fig')];
const imagensMov = [...fotos, ...document.querySelectorAll<HTMLElement>('.proj__img')];
const fotoTxt = document.querySelector<HTMLElement>('.foto-seq__texto:not(.foto-seq__texto--m)');
const fotoTxtM = document.querySelector<HTMLElement>('.foto-seq__texto--m');
// os textos grandes da seção da foto usam o maior tamanho que cabe no quadro definido no grid (o de baixo acompanha o principal)
function caber(el: HTMLElement, max: number) {
  const caixa = el.parentElement;
  if (!caixa) return 12;
  let lo = 12;
  let hi = max;
  while (hi - lo > 0.5) {
    const m = (lo + hi) / 2;
    el.style.fontSize = `${m}px`;
    if (el.scrollHeight <= caixa.clientHeight + 0.5 && el.scrollWidth <= caixa.clientWidth + 0.5) lo = m;
    else hi = m;
  }
  el.style.fontSize = `${lo}px`;
  return lo;
}
function ajustarTextoFoto() {
  if (!fotoTxt) return;
  liberarLarguras();
  const t = caber(fotoTxt, 140);
  if (fotoTxtM) caber(fotoTxtM, t);
  // --tam-titulo (títulos das seções) agora vem do CSS, igual ao texto principal do /teste-grid
  // os textos principais da seção ficam 2px menores que o máximo que cabe
  fotoTxt.style.fontSize = `${t - 2}px`;
  if (fotoTxtM) fotoTxtM.style.fontSize = `${parseFloat(fotoTxtM.style.fontSize) - 2}px`;
  medir(); // as larguras fixas das palavras dependem do tamanho da fonte
}
ajustarTextoFoto();
document.fonts?.ready.then(ajustarTextoFoto);
addEventListener('resize', ajustarTextoFoto);
addEventListener('load', ajustarTextoFoto);
addEventListener('load', medirMovel);
document.fonts?.ready.then(medirMovel);

if (camera && esfera && jujuImg && area && linhas) {
  const linhasTras = linhas.querySelector('[data-linhas-tras]')!;
  const linhasFrente = linhas.querySelector('[data-linhas-frente]')!;
  const tiles = [...esfera.querySelectorAll<HTMLElement>('[data-ar]')];
  const n = tiles.length; // originais (as cópias entram depois)
  const root = document.documentElement;
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // os cards soltos precisam estar prontos já na abertura: sem carregamento preguiçoso
  for (const img of esfera.querySelectorAll<HTMLImageElement>('.tile img')) img.loading = 'eager';

  // a expansão do card usa position: fixed, que não funciona dentro de ancestrais transformados
  for (const m of document.querySelectorAll<HTMLElement>('.esfera .modal')) area.append(m);

  // ---------- util ----------
  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const prog = (t: number, ini: number, dur: number) => clamp((t - ini) / dur);
  const inOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
  const inOutSine = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2;
  const outCubic = (p: number) => 1 - (1 - p) ** 3;
  const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
  // ---- sensação da rolagem (ajuste fino) ----
  // TAU_ROLAGEM: constante de tempo (ms) com que a imagem alcança o gesto. Menor = mais imediato (antes: ~230 ms a 60 Hz, variando com o monitor).
  const TAU_ROLAGEM = 110;
  const TAU_GALERIA = 120; // idem, rolagem interna da galeria
  // CURVA_SCROLL: 0 = linear (acompanha o dedo), 1 = smoothstep. A suavização já vem do seguimento acima; o cúbico antigo somava uma segunda camada de atraso.
  const CURVA_SCROLL = 0.35;
  const curva = (p: number) => lerp(p, p * p * (3 - 2 * p), CURVA_SCROLL);
  const hex = (v: string) => {
    const h = v.trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const css = getComputedStyle(root);
  const corA = hex(css.getPropertyValue('--color-off-white') || '#f9ffe1');
  const corB = hex(css.getPropertyValue('--color-red') || '#7f1616');
    let seed = 7;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- tempos ----------
  const T_ENTRA = 800;
  const T_SAI = 2000;
  const T_CAMERA = 2000;
  const T_FUNDO = 2600;
  const T_ZOOM = 4300;
  const T_TRAVELLING = 5200;
  const DUR_TRAVELLING = 4500;
  const T_RECUA = T_TRAVELLING + DUR_TRAVELLING;
  const T_EXPLODE = T_RECUA + 200;
  const FIM = T_EXPLODE + 200 + 1400;

  // ---------- geometria (refeita ao redimensionar) ----------
  type Card = {
    ar: number;
    orig: number; // índice do card original (cópias seguem o original na fila)
    sx: number; // solto (relativo ao centro do viewport 2)
    sy: number;
    rz: number;
    slot: number; // x na fila
    base: [number, number, number]; // posição na esfera, sem rotação
    eu: [number, number, number]; // tangentes da superfície (largura e altura do card)
    ev: [number, number, number];
    atraso: number;
  };
  let vw = 0;
  let vh = 0;
  let hs = 0; // altura dos cards na esfera
  let sSolto = 1; // escala dos cards soltos
  let sFila = 1; // escala dos cards na fila
  let hFila = 0;
  let zoomFila = 1; // escala da câmera sobre a fila
  let R = 0;
  let lapX = 0; // computador da Juju (relativo ao centro do viewport 2, no viewport 1)
  let lapY = 0;
  let dados: Card[] = [];
  let camAtual = 0;
  // visualização: 'esfera' ou 'galeria' (grade com rolagem vertical); mix leva de uma à outra com suavidade
  let modo: 'esfera' | 'galeria' = 'esfera';
  let mix = 0;
  let galAlvo = 0; // rolagem vertical da galeria
  let galAtual = 0;
  let galMax = 0;
  let galPos: { x: number; y: number }[] = [];
  let galSuave: { x: number; y: number }[] = []; // posição exibida (desliza até galPos quando a ordem muda)
  let arrasto: { id: number; i: number; px: number; py: number; dx: number; dy: number } | null = null; // card arrastado no modo de edição
  let relayoutGaleria: (snap: boolean) => void = () => {};
  // ordem da galeria: índices dos cards (na ordem do DOM = ordem web) na sequência exibida. Web = ordem do DOM; mobile = `data-ordem-mobile`.
  const idDe = (i: number) => tiles[i].dataset.postId!;
  const ordemInicial = (modoOrdem: 'web' | 'mobile') =>
    Array.from({ length: n }, (_, i) => i).sort((a, b) =>
      modoOrdem === 'web' ? a - b : Number(tiles[a].dataset.ordemMobile) - Number(tiles[b].dataset.ordemMobile) || a - b,
    );
  const ordens = { web: ordemInicial('web'), mobile: ordemInicial('mobile') };
  const iniciais = { web: [...ordens.web], mobile: [...ordens.mobile] };
  const editando = new URLSearchParams(location.search).has('editar'); // /?editar: reordenar a galeria arrastando
  let ordemModo: 'web' | 'mobile' = innerWidth < 768 ? 'mobile' : 'web';
  let perm = ordens[ordemModo];
  // rascunho do editor: a ordem em edição fica guardada no navegador, para não se perder se a página recarregar
  const RASCUNHO_ORDEM = 'rascunho-ordem-galeria';
  let mobileTocado = false;
  if (editando) {
    try {
      const r = JSON.parse(localStorage.getItem(RASCUNHO_ORDEM) ?? 'null');
      const ids = tiles.slice(0, n).map((_t, i) => idDe(i));
      const paraIdx = (l: unknown) => (Array.isArray(l) ? l.map((id) => ids.indexOf(id)) : []);
      for (const k of ['web', 'mobile'] as const) {
        const l = paraIdx(r?.[k]);
        if (l.length === n && new Set(l).size === n && !l.includes(-1)) ordens[k].splice(0, n, ...l);
      }
      mobileTocado = !!r?.mobileTocado;
    } catch {
      /* rascunho inválido: ignora */
    }
  }
  let sGaleria = 1;
  let galMostra: boolean[] = []; // card aparece na lista da galeria (false: só web, post fora da lista)
  let galEsc: number[] = []; // escala de cada card na galeria (no mobile cada linha tem a sua altura)
  let navAtual = 68;
  let secH = 0; // altura da seção da foto
  let sobreH = 0;
  // Repouso por seção: um trecho de rolagem (em ef; 0,6 ef = 1 viewport) em que a seção fica inteira e estável, sem a anterior em cima nem a próxima entrando.
  // Não é snap nem interceptação: a rolagem segue livre, só não avança a página durante o trecho. Cada seção tem o seu, conforme o conteúdo.
  const P1 = 0.3; // GIF (0,5 vh)
  const P_FOTO = 0.3; // grid de fotos, com bastante texto (0,5 vh)
  const P_TRAB = 0.2; // cavalo / "trabalho com": pouco texto (0,33 vh)
  const P_PROJ = 0.2; // projetos, no topo (0,33 vh)
  const P_PROJ_FIM = 0; // contato: sem repouso
  const platos = (): [number, number][] => [[0.8, P1], [1.4, P_FOTO], [E2, P_TRAB], [E3, P_PROJ], [E3 + extraEf, P_PROJ_FIM]];
  const totalPlato = () => platos().reduce((a, [, l]) => a + l, 0);
  // rolagem (r) em que a seção está no repouso: início do trecho (meio = true: o meio dele, usado nas âncoras)
  const rDe = (e: number, meio = false) => {
    let acc = 0;
    for (const [pos, len] of platos()) {
      if (pos < e - 1e-6) acc += len;
      else if (Math.abs(pos - e) < 1e-6) return e + acc + (meio ? len / 2 : 0);
    }
    return e + acc;
  };
  const FOOT = 64; // altura do rodapé fixo de contatos na galeria
  let topoGal = 0; // y onde a grade da galeria começa (12px abaixo do texto/toggle do topo)
  let footH = 0;
  let rodH = 0;
  let extraEf = 0; // rolagem extra (em ef) para ver a seção dos projetos inteira
  // limites (em rolagem efetiva) proporcionais à altura de cada seção: a velocidade em px é a mesma em toda a página
  let S2 = 0.6;
  let S3 = 0.6;
  let S4 = 0.6;
  let E2 = 2.0; // fim da subida da foto (início do 'trabalho com' subindo)
  let E3 = 2.6; // projetos no topo
  let EEND = 3.2; // ef do fim: a seção de contato é a última
  let RMAX = EEND + 1.15;
  let projH = 0;
  const g8 = 8; // espaço mínimo entre os cards soltos

  /** anéis de latitude: devolve a configuração com cards do maior tamanho que cabe (ou o mais perto de `teto`) */
  const anelar = (N: number, ars: number[], gap: number, teto?: number) => {
    const arMedio = ars.reduce((a, b) => a + b, 0) / N;
    let melhor: { k: number; d: number; h: number; cont: number[]; nota: number } | null = null;
    for (let k = 3; k <= 22; k++) {
      for (let d = 0.95; d >= 0.1; d -= 0.01) {
        const lat = (j: number) => (j - (k - 1) / 2) * d;
        if (Math.abs(lat(0)) > 1.25 || Math.abs(lat(0)) < 0.95) continue; // os anéis cobrem a esfera toda, de polo a polo
        const h = R * d - gap;
        if (h < 6 || (teto && (h > teto || h < teto * 0.82))) continue;
        const pesos = Array.from({ length: k }, (_, j) => Math.cos(lat(j)));
        const soma = pesos.reduce((a, b) => a + b, 0);
        const bruto = pesos.map((p) => (p / soma) * N);
        const cont = bruto.map(Math.floor);
        const falta = N - cont.reduce((a, b) => a + b, 0);
        [...bruto.keys()]
          .sort((x, y) => bruto[y] - Math.floor(bruto[y]) - (bruto[x] - Math.floor(bruto[x])))
          .slice(0, falta)
          .forEach((j) => cont[j]++);
        const cabe = cont.every((c, j) => c >= 1 && c * (arMedio * h + gap) <= 2 * Math.PI * R * Math.cos(lat(j)) * 0.97);
        if (!cabe) continue;
        // espaço horizontal médio entre cards parecido com o vertical: grade uniforme
        const gapH = cont.reduce((s, c, j) => s + (2 * Math.PI * R * Math.cos(lat(j)) - c * arMedio * h) / c, 0) / k;
        const nota = teto ? Math.abs(gapH - (R * d - h)) - h * 0.01 : -h;
        if (!melhor || nota < melhor.nota) melhor = { k, d, h, cont, nota };
        if (!teto) break; // sem teto: o primeiro d viável (maior) de cada k já é o melhor dele
      }
    }
    return melhor ?? { k: 5, d: 0.5, h: R * 0.5 - gap, cont: Array.from({ length: 5 }, (_, i) => Math.round(N / 5) + (i === 2 ? N - 5 * Math.round(N / 5) : 0)), nota: 0 };
  };

  const D = 2.7; // perspectiva da esfera (em raios): quanto menor, mais arredondada e 3D (os cards da frente crescem, os de trás encolhem)

  const montar = () => {
    vw = innerWidth;
    if (!editando) {
      ordemModo = innerWidth < 768 ? 'mobile' : 'web';
      perm = ordens[ordemModo];
    }
    vh = innerHeight;
    const nav = parseFloat(css.getPropertyValue('--h-nav-atual')) || 68;
    navAtual = nav;
    const m = n; // originais (tiles também guarda as cópias)
    const arsO = tiles.slice(0, m).map((t) => Number(t.dataset.ar));

    // ----- esfera: 12px de folga nas laterais; a perspectiva a deixa ~6% maior que R
    // a perspectiva e a altura dos cards fazem a esfera parecer ~40% maior que R; os anéis ocupam a área sob a navbar
    const arsN = [...arsO, ...arsO]; // cada card aparece duas vezes (volume)
    const base: Card['base'][] = new Array(m * 2);
    const eu: Card['eu'][] = new Array(m * 2);
    const ev: Card['ev'][] = new Array(m * 2);
    R = Math.min((vw - 24) / 2 / 1.12, (vh - nav - 24) / 2 / 1.4); // lateral: 12px de folga; vertical: sob a navbar
    const gapE = Math.max(4, R * 0.035);
    const grande = anelar(m, arsO, gapE); // tamanho que os cards teriam sem as cópias
    const cfg = anelar(m * 2, arsN, gapE, grande.h * 0.5); // metade do tamanho
    hs = cfg.h;
    // nitidez: no mobile o card nasce SUPER vezes maior no layout e a matriz o reduz (o Chrome rasteriza `will-change: transform` no tamanho de layout: com 1x as capas ficavam borradas ao ampliar)
    SUPER = vw < 768 ? 3 : 1;
    esfera.style.setProperty('--card-h', `${hs * SUPER}px`);

    let idx = 0;
    cfg.cont.forEach((c, j) => {
      const lat = (j - (cfg.k - 1) / 2) * cfg.d;
      const raio = R * Math.cos(lat);
      const ids = Array.from({ length: c }, (_, q) => idx + q);
      idx += c;
      const largs = ids.map((i) => arsN[i] * hs);
      const g = (2 * Math.PI * raio - largs.reduce((a, b) => a + b, 0)) / c; // mesmo espaço entre os cards do anel
      let acum = j * 0.9; // anéis defasados entre si
      ids.forEach((i, q) => {
        const phi = acum + largs[q] / 2 / raio;
        base[i] = [Math.sin(phi) * raio, R * Math.sin(lat), Math.cos(phi) * raio];
        eu[i] = [Math.cos(phi), 0, -Math.sin(phi)];
        ev[i] = [-Math.sin(lat) * Math.sin(phi), Math.cos(lat), -Math.sin(lat) * Math.cos(phi)];
        acum += (largs[q] + g) / raio;
      });
    });


    // ----- fila horizontal (só os originais): 80% da largura
    const espaco = 0.12;
    hFila = (vw * 0.8) / (arsO.reduce((a, b) => a + b, 0) + (m - 1) * espaco);
    sFila = hFila / hs;
    const largFila = arsO.map((a) => a * hFila);
    let x = -(vw * 0.8) / 2;
    const slots = largFila.map((w) => {
      const c = x + w / 2;
      x += w + espaco * hFila;
      return c;
    });
    zoomFila = Math.max(1, Math.min((vh * 0.55) / hFila, (vw * 0.8) / Math.max(...largFila)));

    // ----- soltos: ao redor da Juju (centralizada), sem tapá-la e com ≥ 8px entre os cards;
    // o tamanho é o maior em que os cards cabem nas células livres
    seed = 7;
    const r = jujuImg.getBoundingClientRect();
    const topo = r.top + camAtual;
    const eX0 = r.left + r.width * 0.08 - g8;
    const eX1 = r.right - r.width * 0.08 + g8;
    const eY0 = topo + r.height * 0.14 - g8;
    const eY1 = topo + r.height * 0.86 + g8;
    const reg = { x: 12, y: nav + 8, w: vw - 24, h: vh - nav - 20 };
    const arMax = Math.max(...arsO);
    type Cel = { x: number; y: number; w: number; h: number };
    let celulas: Cel[] = [];
    let hSolto = 20;
    for (let h = Math.min(vh * 0.2, 170); h >= 20; h -= 2) {
      const cw = arMax * h + g8;
      const ch = h * 1.1 + g8;
      const cols = Math.floor(reg.w / cw);
      const rows = Math.floor(reg.h / ch);
      const ox = reg.x + (reg.w - cols * cw) / 2;
      const oy = reg.y + (reg.h - rows * ch) / 2;
      const lista: Cel[] = [];
      for (let q = 0; q < rows; q++)
        for (let p = 0; p < cols; p++) {
          const c = { x: ox + p * cw, y: oy + q * ch, w: cw, h: ch };
          const livreJuju = c.x + c.w <= eX0 || c.x >= eX1 || c.y + c.h <= eY0 || c.y >= eY1;
          const livreSeta = c.x + c.w <= vw - 20 - 48 - g8 || c.y + c.h <= vh - 20 - 48 - g8; // canto da seta dupla
          if (livreJuju && livreSeta) lista.push(c);
        }
      if (lista.length >= m) {
        celulas = lista;
        hSolto = h;
        break;
      }
    }
    celulas.sort(() => rnd() - 0.5);
    sSolto = hSolto / hs;

    lapX = r.left + r.width * 0.5 - vw / 2;
    lapY = topo + r.height * 0.65 - vh * 1.5;

    dados = tiles.map((_t, i) => {
      const o = i % m;
      const c = celulas[o % Math.max(1, celulas.length)] ?? { x: 12, y: nav + 8, w: 60, h: 60 };
      const w = arsN[i] * hSolto;
      const sx = c.x + c.w / 2 + (rnd() - 0.5) * Math.max(0, c.w - g8 - w);
      const sy = c.y + c.h / 2 + (rnd() - 0.5) * Math.max(0, c.h - g8 - hSolto);
      return {
        ar: arsN[i],
        orig: o,
        sx: sx - vw / 2,
        sy: sy - vh * 1.5,
        rz: (rnd() - 0.5) * 3,
        slot: slots[o],
        base: base[i] as unknown as Card['base'],
        eu: eu[i] as unknown as Card['eu'],
        ev: ev[i] as unknown as Card['ev'],
        atraso: rnd() * 180,
      };
    });

    // ----- galeria: grade com rolagem vertical; mesma altura, linhas alinhadas, 32px entre os cards (`snap`: sem deslizar)
    const layoutGaleria = (snap: boolean) => {
      const movel = vw < 768;
      // mobile: exatamente 24px entre os cards (horizontal e vertical); cada linha é escalada para preencher a largura
      const gapG = movel ? 24 : parseFloat(css.getPropertyValue('--card-gap')) || 32;
      const hG = movel ? 170 : Math.min(260, Math.max(190, vw * 0.17)); // no mobile: altura-base, só decide quantos cards cabem por linha
      sGaleria = hG / hs;
      galPos = new Array(tiles.length);
      galEsc = new Array(n).fill(hG / hs);
      galMostra = tiles.slice(0, n).map((t) => movel || t.dataset.semListaWeb === undefined);
      let hAnt = 0;
      // web: cards marcados com data-sem-lista-web não entram na lista (continuam na esfera e no mobile)
      const foraDaLista = (i: number) => !movel && tiles[i].dataset.semListaWeb !== undefined;
      const lista = perm.filter((i) => !foraDaLista(i));
      const mm = lista.length;
      const oq = (q: number) => lista[q]; // card que ocupa a posição q da lista (a ordem vem de `perm`)
      // alinhamento: bordas esquerda/direita = margens da navbar (logo e "sobre"); linhas completas se justificam entre as duas
      const margem = parseFloat(getComputedStyle(document.querySelector('.nav') ?? document.body).paddingLeft) || gapG;
      const larg = vw - 2 * margem;
      let linhaIni = 0;
      let linhaW = 0;
      const topoDir = document.querySelector<HTMLElement>('.topo-dir');
      topoGal = Math.max(nav + gapG, (topoDir?.getBoundingClientRect().bottom ?? nav) + 12);
      root.style.setProperty('--topo-gal', `${topoGal}px`);
      let y0 = topoGal;
      const fecha = (fim: number, ultima: boolean) => {
        const cnt = fim - linhaIni;
        const sobra = larg - linhaW;
        let gapL = gapG + (!ultima && cnt > 1 ? sobra / (cnt - 1) : 0);
        let hL = hG;
        if (movel) {
          gapL = gapG;
          let somaAr = 0;
          for (let q = linhaIni; q < fim; q++) somaAr += arsO[oq(q)];
          hL = (larg - (cnt - 1) * gapG) / somaAr;
          if (ultima && hAnt) hL = Math.min(hL, hAnt); // a última linha não estica além das outras
          hAnt = hL;
        }
        let xx = margem;
        for (let q = linhaIni; q < fim; q++) {
          galPos[oq(q)] = { x: xx + (arsO[oq(q)] * hL) / 2, y: y0 + hL / 2 }; // centro do card
          galEsc[oq(q)] = hL / hs;
          xx += arsO[oq(q)] * hL + gapL;
        }
        y0 += hL + gapG;
      };
      for (let q = 0; q < mm; q++) {
        const w = arsO[oq(q)] * hG;
        const novo = linhaW === 0 ? w : linhaW + gapG + w;
        if (novo > larg && q > linhaIni) {
          fecha(q, false);
          linhaIni = q;
          linhaW = w;
        } else linhaW = novo;
      }
      fecha(mm, true);
      for (let i = 0; i < m; i++) if (foraDaLista(i)) galPos[i] = galPos[lista[mm - 1]]; // fora da lista: sem posição própria (ficam ocultos)
      for (let q = m; q < tiles.length; q++) galPos[q] = galPos[q - m]; // cópias seguem os originais (ficam ocultas)
      galMax = Math.max(0, y0 - gapG - (vh - FOOT));
      galAlvo = clamp(galAlvo, 0, galMax);
      if (snap || galSuave.length !== tiles.length) galSuave = galPos.map((g) => ({ ...g })); // reordenar (editor) desliza; redimensionar não
    };
    relayoutGaleria = layoutGaleria;
    layoutGaleria(true);
    // alturas das seções em múltiplos de pixel físico: as divisas caem sempre em pixel inteiro (sem meio pixel de emenda com zoom 90%/110%/125%)
    const dp = Math.max(1, window.devicePixelRatio || 1);
    dprPx = dp;
    const alt = (el: HTMLElement | null) => {
      if (!el) return vh;
      el.style.height = '';
      const h = Math.ceil(el.getBoundingClientRect().height * dp - 0.01) / dp;
      el.style.height = `${h}px`;
      return h;
    };
    secH = alt(secFoto); // altura da seção da foto: quanto o "trabalho com" sobe depois dela
    sobreH = alt(secSobre);
    projH = alt(secProj);
    extraEf = (Math.max(0, projH - vh) / vh) * 0.6;
    rodH = alt(secRod);
    camH = camera.offsetHeight;
    medirMovel();
    S2 = (secH / vh) * 0.6;
    S3 = (sobreH / vh) * 0.6;
    S4 = (rodH / vh) * 0.6;
    E2 = 1.4 + S2;
    E3 = E2 + S3;
    EEND = E3 + extraEf + S4;
    RMAX = EEND + totalPlato();
  };
  // cópias dos cards (volume da esfera): clones sem o modal; clicar abre o mesmo conteúdo
  const originais = [...tiles];
  for (const o of originais) {
    const cp = o.cloneNode(true) as HTMLElement;
    cp.dataset.copia = '';
    cp.removeAttribute('id');
    esfera.append(cp);
    tiles.push(cp);
  }
  montar();
  addEventListener('resize', montar);

// ---------- interação com a esfera ----------
  let rx = -0.12; // inclinação (limitada: os anéis continuam quase horizontais)
  let ry = 0;
  let vry = 0;
  let zoom = 1.2; // aproximar/afastar (tamanho natural: 20% maior)
  let zoomAlvo = 1.2;
  let rolagem = 0; // alvo da rolagem (0 = esfera; 0–0.45 ela diminui; 0.45–1 vai para o próximo viewport)
  let rolagemAtual = 0;
  let tomarP = 0; // progresso (tempo) da transição do offwhite sobre a tela
  let moveu = false;
  let pronta = false;
  const ativos = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  let pinca: { d: number; z: number } | null = null;
  const modalAberto = () => root.classList.contains('is-modal-open');
  // rolagem total: 0 = esfera/galeria; 0–0.8: a estrela cresce até cobrir 100% da tela; 0.8–RMAX: segue a sequência "sobre"
  // PLAT: "trava" extra ao chegar no viewport do GIF: é preciso rolar mais um pouco para sair dele, para os dois lados
  // 0.8–1.4: a seção da foto sobe; 1.4–2.0: o "trabalho com" sobe. Platô no GIF (ef 0.8) e na foto (ef 1.4)
  // 2.0–2.6: a seção dos projetos sobe (platô antes, no "trabalho com"); depois, a rolagem corre pelo conteúdo dos projetos
  const efetiva = (r: number) => {
    let acc = 0;
    for (const [pos, len] of platos()) {
      const r0 = pos + acc;
      if (r < r0) return r - acc;
      if (r <= r0 + len) return pos;
      acc += len;
    }
    return r - acc;
  };
  const R_CONT = () => RMAX; // contato: última seção
  const R_PROJ = () => rDe(E3, true); // rolagem em que a seção dos projetos está no topo
  // na galeria, primeiro corre a lista; chegando ao fim, a rolagem segue para a estrela (e volta na ordem inversa)
  const rolarPor = (d: number, k: number) => {
    if (modo === 'galeria') {
      if (d > 0) {
        if (galAlvo < galMax - 0.5) galAlvo = clamp(galAlvo + d, 0, galMax);
        else rolagem = clamp(rolagem + d / (k * 1.25), 0, RMAX);
      } else if (rolagem > 0) rolagem = clamp(rolagem + d / (rolagem < 0.8 + P1 ? k * 1.25 : k), 0, RMAX);
      else galAlvo = clamp(galAlvo + d, 0, galMax);
      return;
    }
    rolagem = clamp(rolagem + d / (rolagem < 0.8 + P1 ? k * 1.25 : k), 0, RMAX); // saída da esfera e GIF: mais firme, menos erro
  };

  area.addEventListener('pointerdown', (e) => {
    moveu = false;
    if (!pronta || modalAberto() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as Element).closest('[data-midia], .modal__link, .modal__pontos, .visao, .pular, .contato-esf, .editor')) return;
    if (editando && (e.target as Element).closest('[data-coisa]')) return; // editor das coisas do sobre
    if (editando && modo === 'galeria' && mix > 0.9 && !arrasto) {
      const t = (e.target as Element).closest<HTMLElement>('[data-ar]');
      const i = t ? tiles.indexOf(t) : -1;
      if (i >= 0 && i < n) {
        const g = galSuave[i] ?? galPos[i];
        arrasto = { id: e.pointerId, i, px: e.clientX, py: e.clientY, dx: g.x - e.clientX, dy: g.y - (e.clientY + galAtual) };
        e.preventDefault();
        return;
      }
    }
    ativos.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    vry = 0;
    if (ativos.size === 2) {
      const [a, b] = [...ativos.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoomAlvo };
      moveu = true;
    }
  });
  addEventListener('pointermove', (e) => {
    if (arrasto && e.pointerId === arrasto.id) {
      arrasto.px = e.clientX;
      arrasto.py = e.clientY;
      return;
    }
    const p = ativos.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ativos.size >= 2 && pinca) {
      const [a, b] = [...ativos.values()];
      zoomAlvo = clamp(pinca.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinca.d), 1.2, 2.2);
      return;
    }
    if (!moveu && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 6) return;
    moveu = true;
    vry = dx * 0.006;
    if (modo !== 'galeria') ry += vry;
    if (!modalAberto()) rolarPor(-dy, vh * 0.8); // arrastar para cima = rolar
  });
  const soltar = (e: PointerEvent) => {
    if (arrasto && e.pointerId === arrasto.id) {
      arrasto = null; // o card desliza até a sua posição
      if (editando) guardarOrdem();
    }
    if (!ativos.delete(e.pointerId)) return;
    if (ativos.size < 2) pinca = null;
  };
  addEventListener('pointerup', soltar);
  addEventListener('pointercancel', soltar);
  addEventListener(
    'click',
    (e) => {
      if ((moveu || !pronta) && !(e.target as Element).closest('.pular, .visao, .contato-esf')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        moveu = false;
      }
    },
    true,
  );
  area.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (!pronta || modalAberto()) return;
      if (modo === 'galeria') {
        rolarPor(clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -110, 110), vh * 1.1);
        return;
      }
      if (e.ctrlKey || e.metaKey) zoomAlvo = clamp(zoomAlvo * Math.exp(-e.deltaY * 0.01), 1.2, 2.2);
      else rolarPor(clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -110, 110), vh * 1.1); // limita o passo de cada evento: um giro forte do mouse não pula seções
    },
    { passive: false },
  );

  // ---------- tipografia (Text Appear + Text Pressure) ----------
  prepararTipografia();
  const textos = [...document.querySelectorAll<HTMLElement>('[data-tx]')];

  // ---------- linha do tempo ----------
  // tempo virtual: a seta dupla acelera a linha do tempo até a esfera (sem corte seco)
  let vt = 0;
  let quadroAnterior = performance.now();
  let pulando = false;
  let pendente: number | null = null; // destino da navbar a aplicar quando a esfera estiver pronta
  pular?.addEventListener('click', () => {
    if (vt < FIM) pulando = true;
  });



  // pontos da estrutura (em unidades de R): 8 meridianos (círculos máximos), 7 paralelos e o contorno
  const MERIDIANOS = 8;
  const PARALELOS = [-3, -2, -1, 0, 1, 2, 3].map((k) => (k * Math.PI) / 8);
  const PASSOS = 72;
  const curvas: [number, number, number][][] = [];
  for (let m = 0; m < MERIDIANOS; m++) {
    const phi = (m * Math.PI) / MERIDIANOS;
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= PASSOS; k++) {
      const th = (k / PASSOS) * 2 * Math.PI; // volta completa: o círculo passa pelos dois polos
      pts.push([Math.cos(th) * Math.sin(phi), Math.sin(th), Math.cos(th) * Math.cos(phi)]);
    }
    curvas.push(pts);
  }
  for (const lat of PARALELOS) {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= PASSOS; k++) {
      const th = (k / PASSOS) * 2 * Math.PI;
      pts.push([Math.cos(lat) * Math.sin(th), Math.sin(lat), Math.cos(lat) * Math.cos(th)]);
    }
    curvas.push(pts);
  }
  const desenharLinhas = (rodar: (v: [number, number, number]) => readonly [number, number, number], raio: number) => {
    let frente = '';
    let tras = '';
    for (const pts of curvas) {
      let ant: { x: number; y: number; f: boolean } | null = null;
      for (const p of pts) {
        const [x, y, z] = rodar([p[0] * raio, p[1] * raio, p[2] * raio]);
        const k = D / (D - z / raio);
        const cur = { x: x * k, y: y * k, f: z >= 0 };
        if (ant) {
          const seg = `M${ant.x.toFixed(1)} ${ant.y.toFixed(1)}L${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`;
          if (ant.f && cur.f) frente += seg;
          else tras += seg;
        }
        ant = cur;
      }
    }
    // contorno: silhueta da esfera sob perspectiva
    const rs = (raio * D) / Math.sqrt(D * D - 1);
    frente += `M${-rs} 0a${rs} ${rs} 0 1 0 ${2 * rs} 0a${rs} ${rs} 0 1 0 ${-2 * rs} 0`;
    linhasFrente.setAttribute('d', frente);
    linhasTras.setAttribute('d', tras);
  };

  // ---------- modo de edição da galeria (/?editar) ----------
  // Arrastar uma capa na galeria troca a posição dela na lista; a ordem Web e a Mobile são independentes.
  // Salvar: no `npm run dev` grava nos arquivos de src/content/posts; fora dele, copia a ordem para colar no chat.
  const editor = document.querySelector<HTMLElement>('[data-editor]');
  const mobileSegueWeb = iniciais.web.every((v, k) => v === iniciais.mobile[k]);
  const sincMobile = () => {
    if (mobileSegueWeb && !mobileTocado) ordens.mobile.splice(0, n, ...ordens.web);
  };
  const dica = (txt: string) => {
    const el = editor?.querySelector<HTMLElement>('[data-editor-msg]');
    if (el) el.textContent = txt;
  };
  /** troca de lugar com o card mais próximo do que está sendo arrastado (a própria vaga conta, para não oscilar) */
  const reordenarArrasto = () => {
    if (!arrasto) return;
    const cx = arrasto.px + arrasto.dx;
    const cy = arrasto.py + galAtual + arrasto.dy;
    let melhor = -1;
    let dmin = Infinity;
    for (let j = 0; j < n; j++) {
      const d = Math.hypot(galPos[j].x - cx, galPos[j].y - cy);
      if (d < dmin) {
        dmin = d;
        melhor = j;
      }
    }
    if (melhor < 0 || melhor === arrasto.i) return;
    const de = perm.indexOf(arrasto.i);
    const para = perm.indexOf(melhor);
    perm.splice(de, 1);
    perm.splice(para, 0, arrasto.i);
    if (ordemModo === 'mobile') mobileTocado = true;
    dica('');
    relayoutGaleria(false);
  };
  const guardarOrdem = () => {
    try {
      localStorage.setItem(RASCUNHO_ORDEM, JSON.stringify({ web: ordens.web.map(idDe), mobile: ordens.mobile.map(idDe), mobileTocado }));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  };
  if (editando && editor) {
    root.classList.add('is-editando');
    const segs = [...editor.querySelectorAll<HTMLElement>('[data-ordem]')];
    const marcar = () => segs.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ordem === ordemModo)));
    marcar();
    for (const b of segs) {
      b.addEventListener('click', () => {
        ordemModo = b.dataset.ordem === 'mobile' ? 'mobile' : 'web';
        if (ordemModo === 'mobile') sincMobile();
        perm = ordens[ordemModo];
        marcar();
        dica('');
        relayoutGaleria(false);
      });
    }
    editor.querySelector('[data-editor-desfazer]')?.addEventListener('click', () => {
      perm.splice(0, n, ...iniciais[ordemModo]);
      if (ordemModo === 'mobile') mobileTocado = false;
      guardarOrdem();
      dica('Voltou à ordem salva');
      relayoutGaleria(false);
    });
    editor.querySelector('[data-editor-salvar]')?.addEventListener('click', async () => {
      sincMobile();
      const web = ordens.web.map(idDe);
      const mobile = ordens.mobile.map(idDe);
      try {
        const r = await fetch('/__salvar-ordem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ web, mobile }) });
        if (r.ok) {
          try {
            localStorage.removeItem(RASCUNHO_ORDEM);
          } catch {
            /* ok */
          }
          return dica('Salvo nos arquivos ✓');
        }
      } catch {
        /* sem servidor de desenvolvimento: cai no copiar */
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify({ web, mobile }, null, 2));
        dica('Ordem copiada: cole no chat');
      } catch {
        dica('Não consegui salvar nem copiar');
      }
    });
  }

  // fundo da página + cor das barras do Safari (iOS): html, wrapper (--color-galeria-bg) e <meta theme-color> sempre juntos
  const metaTema = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const secoesBg = ['.foto-seq', '.sobre-seq', '.proj-seq', '.rod-seq'].map((q) => document.querySelector<HTMLElement>(q));
  let bgAtual = '';
  let bgT = 0;
  const paraHex = (c: string) => {
    const m = c.match(/\d+(\.\d+)?/g);
    return m && m.length >= 3 ? '#' + m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('') : c;
  };
  const setBg = (cor: string) => {
    const c = paraHex(cor);
    if (c === bgAtual) return;
    bgAtual = c;
    root.style.backgroundColor = c;
    metaTema?.setAttribute('content', c);
  };
  // cor sob as barras: a da seção que ocupa o centro da tela (ou o offwhite do campo da estrela); senão, o fundo da galeria
  const corDoFundo = (galeria: string) => {
    if (document.body.classList.contains('cursor-offwhite')) return getComputedStyle(root).getPropertyValue('--color-off-white').trim() || '#f9ffe1';
    for (const sec of secoesBg) {
      if (!sec) continue;
      const r = sec.getBoundingClientRect();
      if (r.top <= vh / 2 && r.bottom > vh / 2) {
        const bgSec = getComputedStyle(sec).backgroundColor;
        if (bgSec && bgSec !== 'rgba(0, 0, 0, 0)' && bgSec !== 'transparent') return bgSec;
      }
    }
    return galeria;
  };

  const quadro = (agora: number) => {
    // tela de aviso do mobile (AvisoMobile): a abertura espera
    if (document.body.classList.contains('is-aviso')) {
      if (agora - bgT > 150) setBg('#f9ffe1'); // o aviso é offwhite: as barras também
      quadroAnterior = agora;
      requestAnimationFrame(quadro);
      return;
    }
    const dt = Math.min(64, agora - quadroAnterior);
    quadroAnterior = agora;
    if (pulando && vt >= FIM) pulando = false;
    vt += dt * (pulando ? 9 : 1);
    const t = reduzir ? FIM + 1 : vt;

    // a navbar e o botão de visualização só aparecem na esfera
    document.body.classList.toggle('is-intro', t < T_EXPLODE + 500);

    // câmera e fundo
    mix += ((modo === 'galeria' ? 1 : 0) - mix) * 0.07;
    if (arrasto) {
      // arrastando perto da borda: a lista rola sozinha
      if (arrasto.py < navAtual + 90) galAlvo = clamp(galAlvo - 12, 0, galMax);
      else if (arrasto.py > vh - 90) galAlvo = clamp(galAlvo + 12, 0, galMax);
      reordenarArrasto();
    }
    galAtual += (galAlvo - galAtual) * (1 - Math.exp(-dt / TAU_GALERIA));
    rolagemAtual += (rolagem - rolagemAtual) * (1 - Math.exp(-dt / TAU_ROLAGEM)); // por tempo: igual em 30, 60 ou 120 Hz
    const fase1 = curva(clamp(rolagemAtual / 0.45)) * (1 - mix); // a esfera diminui
    const camP = inOut(prog(t, T_CAMERA, 1500));
    camAtual = vh * camP;
    camera.style.transform = `translate3d(0, ${-camAtual.toFixed(2)}px, 0)`;
    // galeria: os cards só aparecem entre o texto do topo (+12px) e o rodapé fixo de contatos; a grade rola dentro dessa janela
    // mobile, em lista e ainda na galeria (sem ter rolado para as próximas seções): o topo fica fixo sobre fundo vermelho
    root.classList.toggle('is-topo-fixo', modo === 'galeria' && mix > 0.9 && rolagemAtual < 0.02 && t >= T_EXPLODE + 500);
    if (mix > 0.005) {
      const topoClip = lerp(-400, topoGal + camAtual, mix);
      const baseClip = lerp(-400, camH - (vh - FOOT + camAtual), mix);
      camera.style.clipPath = `inset(${topoClip.toFixed(1)}px 0 ${baseClip.toFixed(1)}px 0)`;
    } else camera.style.clipPath = '';
    // estrela: aparece no centro e cresce com a rolagem (proporcional, em escala geométrica) até cobrir 100% da tela
    const ef = efetiva(rolagemAtual);
    const g = clamp((ef - 0.04) / 0.76);
    const gE = lerp(g, inOutSine(g), 0.5);
    const wMin = vh * 0.12;
    const wMax = Math.hypot(vw, vh) * 2.3; // a estrela precisa de ~2,2× a diagonal para cobrir qualquer proporção de tela
    // o GIF surge (tempo) quando a tela já está toda offwhite
    tomarP = clamp(tomarP + (dt / 900) * (g > 0.985 ? 1 : -1));
    const gifV = inOut(tomarP);
    const campo = clamp((g - 0.9) / 0.1);
    if (estrela) {
      estrela.style.setProperty('--w', `${(wMin * (wMax / wMin) ** gE).toFixed(1)}px`);
      estrela.style.setProperty('--op', clamp(g / 0.06).toFixed(3));
      estrela.style.setProperty('--campo', campo.toFixed(3));
      estrela.style.setProperty('--gif', gifV.toFixed(4));
      estrela.classList.toggle('is-gif', gifV > 0.9);
      estrela.style.visibility = g > 0.001 ? 'visible' : 'hidden';
    }
    const sobreP = clamp((ef - 0.8) / 0.6); // GIF → foto (linear: a página acompanha a mão, sem aceleração nas bordas)
    const sobreP2 = clamp((ef - 1.4) / S2); // foto → "trabalho com"
    const sobreP3 = clamp((ef - E2) / S3); // "trabalho com" → projetos
    const extraPx = clamp((ef - E3) / 0.6, 0, extraEf / 0.6) * vh; // rolagem pelo conteúdo dos projetos
    const sobreP4 = clamp((ef - E3 - extraEf) / S4); // projetos → rodapé
    // translação do mundo neste quadro (também usada para localizar elementos sem ler o layout)
    const ty = -sobreP * vh - sobreP2 * (secH || vh) - sobreP3 * (sobreH || vh) - extraPx - sobreP4 * (rodH || vh);
    tyAtual = ty;
    if (mundo) mundo.style.transform = `translate3d(0, ${(Math.round(ty * dprPx) / dprPx).toFixed(3)}px, 0)`;
    // progressos do ALVO (o que o usuário pediu), sem o atraso do seguimento: gatilhos e indicadores respondem à intenção
    const efT = efetiva(rolagem);
    const pT1 = clamp((efT - 0.8) / 0.6);
    const pT2 = clamp((efT - 1.4) / S2);
    const pT3 = clamp((efT - E2) / S3);
    const pT4 = clamp((efT - E3 - extraEf) / S4);
    // Text Appear: cada grupo de texto é revelado quando o seu viewport está à vista
    // Text Appear a cada entrada no viewport: o texto some ao sair (com histerese, para não piscar na fronteira) e entra de novo ao voltar
    const alterna = (el: HTMLElement, ligar: boolean, desligar: boolean) => {
      if (ligar) revelar(el, true);
      else if (desligar) revelar(el, false);
    };
    for (const el of textos) {
      const k = el.dataset.tx;
      if (k === 'sobre') {
        alterna(el, pT2 > 0.4 && pT3 < 0.5, pT2 < 0.2 || pT3 > 0.7);
      } else if (k === 'foto') {
        alterna(el, pT1 > 0.5 && pT2 < 0.5, pT1 < 0.25 || pT2 > 0.7);
      } else if (k === 'proj') {
        // cada texto entra quando chega à tela (o conteúdo é mais alto que o viewport) e reinicia quando sai dela
        const m = medidas.get(el);
        if (m) {
          const topo = m.base + ty;
          alterna(el, pT3 > 0.15 && topo < vh * 0.92 && topo + m.h > 0, pT3 < 0.05 || topo > vh * 1.02 || topo + m.h < -vh * 0.02);
        }
      } else if (k === 'rot') {
        // palavra que gira: a primeira entra com a seção; as trocas são feitas por rotativa.ts
        if (pT2 > 0.4 && pT3 < 0.5) {
          if (el.classList.contains('is-ativa')) revelar(el, true);
        } else if (pT2 < 0.2 || pT3 > 0.7) revelar(el, false);
      } else if (k === 'rod') {
        alterna(el, pT4 > 0.4, pT4 < 0.2);
      } else if (k === 'micro') {
        // microtextos do topo da esfera/galeria: entram quando a esfera aparece
        revelar(el, !document.body.classList.contains('is-intro') && !document.body.classList.contains('is-estrela'));
      } else revelar(el, gifV > 0.35 && sobreP < 0.6);
    }
    // histerese: evita piscar quando a rolagem oscila perto do limite
    if (sobreP2 > 0.92) secao?.classList.add('is-pronta');
    else if (sobreP2 < 0.8) secao?.classList.remove('is-pronta');
    // cores ligadas à rolagem: cada seção parte da cor da anterior e chega à sua, aos poucos (sem degraus nas bordas)
    if (secao && sobreP > 0) {
      const ss = (v: number, a: number, b: number) => {
        const x = clamp((v - a) / (b - a));
        return x * x * (3 - 2 * x);
      };
      const e1 = ss(sobreP2, 0.3, 1);
      const sobreBg = misturar(OFF, paleta.bg, e1);
      const sobreFg = misturar(RED, paleta.fg, e1);
      secao.style.setProperty('--fundo-vivo', css3(sobreBg));
      secao.style.setProperty('--fg-vivo', css3(sobreFg));
    }
    if (!reduzir) {
      // imagens: cantos bem arredondados ao entrar, endireitando até ficarem quadrados no meio da tela e arredondando de novo ao sair
      for (const f of imagensMov) {
        const m = medidas.get(f);
        if (!m) continue;
        const dist = Math.abs(m.base + ty + m.h / 2 - vh / 2);
        const zona = 0.2 * vh;
        const x = clamp((dist - zona) / Math.max(1, vh / 2 + m.h / 2 - zona));
        const e = x * x * (3 - 2 * x);
        f.style.borderRadius = `${(e * Math.min(m.w, m.h) * 0.45).toFixed(1)}px`;
      }
    }
    // navbar: sublinha a seção à vista (gif, grid e cavalo são todos "sobre")
    const NOMES = ['galeria', 'sobre', 'projetos', 'contato'];
    const LIMS = [0.42, E2 + S3 / 2, E3 + extraEf + S4 / 2]; // pontos médios das passagens, em rolagem efetiva do alvo
    let idx = NOMES.indexOf(navSecao);
    if (idx < 0) idx = efT > LIMS[2] ? 3 : efT > LIMS[1] ? 2 : efT > LIMS[0] ? 1 : 0;
    while (idx < 3 && efT > LIMS[idx] + 0.04) idx++; // histerese: não pisca na fronteira
    while (idx > 0 && efT < LIMS[idx - 1] - 0.04) idx--;
    const atual = document.body.classList.contains('is-intro') ? '' : NOMES[idx];
    if (atual !== navSecao) {
      navSecao = atual;
      for (const a of navLinks) a.classList.toggle('is-atual', a.hash.slice(1) === atual);
    }
    document.body.classList.toggle('is-estrela', g > 0.05); // esconde o toggle de visualização
    document.body.classList.toggle('cursor-offwhite', campo > 0.7); // cursor próprio do viewport offwhite
    const bg = inOut(prog(t, T_FUNDO, 4200));
    root.style.setProperty('--grao-bg', bg.toFixed(3)); // grão preto no fundo claro, offwhite no escuro
    const cor = corA.map((v, k) => lerp(v, corB[k], bg));
    
    const corGaleria = `rgb(${cor.map(Math.round).join(' ')})`;
    root.style.setProperty('--color-galeria-bg', corGaleria);
    if (agora - bgT > 120) {
      bgT = agora; // no máx. ~8 atualizações/s: o Safari reavalia as barras a cada mudança de theme-color
      setBg(corDoFundo(corGaleria));
    }

    // câmera sobre a fila: zoom, travelling de card em card, recuo
    const zIn = inOut(prog(t, T_ZOOM, 900));
    const trav = inOutSine(prog(t, T_TRAVELLING, DUR_TRAVELLING));
    const rec = inOut(prog(t, T_RECUA, 1000));
    const primeiro = dados[0]?.slot ?? 0;
    const ultimo = dados[n - 1]?.slot ?? 0;
    const foco = lerp(lerp(0, primeiro, zIn), ultimo, trav) * (1 - rec);
    const escalaCam = lerp(lerp(1, zoomFila, zIn), 1, rec);
    const vida = zIn * (1 - rec); // câmera na mão: deriva e leve inclinação
    const fy = Math.sin(t * 0.0021) * hFila * 0.12 * vida;
    const roll = Math.sin(t * 0.0009) * 0.7 * vida;
    const girar = t > FIM;
    if (girar && pendente !== null && !modalAberto()) {
      rolagem = pendente;
      pendente = null;
    }
    pronta = girar;
    esfera.classList.toggle('is-pronta', girar);

    if (girar && !modalAberto()) {
      if (ativos.size === 0) {
        ry += vry;
        vry *= 0.95;
        ry += 0.00264 * (1 - Math.min(1, Math.abs(vry) * 80));
      }
      zoom += (zoomAlvo - zoom) * 0.12;
    }
    if (info && girar) info.style.setProperty('--esfera-d', `${((R * D) / Math.sqrt(D * D - 1) * 2 * zoom).toFixed(0)}px`);
    // o zoom da esfera entra junto com a explosão (antes só valia depois dela: a esfera dava um salto de tamanho ao fim da abertura)
    const explode = outCubic(prog(t, T_EXPLODE, 1400));
    const sc = escalaCam * lerp(lerp(1, zoom * lerp(1, 0.8, fase1), explode), 1, mix);
    esfera.style.transform = `rotate(${roll.toFixed(3)}deg) translate(${(-foco * escalaCam).toFixed(2)}px, ${(-fy * escalaCam).toFixed(2)}px) scale(${sc.toFixed(4)})`;

    const cy = Math.cos(ry);
    const sy_ = Math.sin(ry);
    const cx = Math.cos(rx);
    const sx_ = Math.sin(rx);
    const gira = (v: [number, number, number]) => {
      const x1 = v[0] * cy + v[2] * sy_;
      const z1 = -v[0] * sy_ + v[2] * cy;
      return [x1, v[1] * cx - z1 * sx_, v[1] * sx_ + z1 * cx] as const;
    };

    tiles.forEach((el, i) => {
      const d = dados[i];
      const copia = i >= n;
      const o = d.orig;
      const a = inOut(prog(t, T_ENTRA + o * 30, 900)); // entra no computador
      const e = inOut(prog(t, T_SAI + o * 45, 1100)); // sai enfileirado
      const c = outCubic(prog(t, T_EXPLODE + d.atraso, 1400)); // explode

      let x: number;
      let y: number;
      let s: number;
      let rz = 0;
      let op: number;
      if (t < T_SAI + o * 45) {
        const boia = (1 - a) * Math.sin(t * 0.0011 + i * 1.7) * 5;
        x = lerp(d.sx, lapX, a);
        y = lerp(d.sy, lapY, a) + boia;
        s = lerp(sSolto, 0.1 * sSolto, a);
        rz = d.rz * (1 - a);
        op = 1 - clamp((a - 0.55) / 0.45);
      } else {
        x = lerp(lapX, d.slot, e);
        y = lerp(lapY, 0, e); // fila no centro do viewport 2 (y = 0 local)
        s = lerp(0.1 * sSolto, sFila, e);
        op = clamp(e / 0.3);
      }
      if (copia) op = 0; // as cópias só aparecem na explosão

      // matriz do card: na fila é escala uniforme; na esfera, os eixos do card seguem a superfície
      let ma = s * Math.cos((rz * Math.PI) / 180);
      let mb = s * Math.sin((rz * Math.PI) / 180);
      let mc = -mb;
      let md = ma;
      let z = 0;
      let alvo = 0; // pode receber clique
      let xf = 0; // posição e eixos do card já na esfera (c = 1): o ajuste dos polos é calculado sobre eles, não sobre o voo
      let yf = 0;
      let mf: number[] = [1, 0, 0, 1];
      if (c > 0) {
        const [bx, by, bz] = gira(d.base);
        const f = D / (D - bz / R);
        const u = gira(d.eu);
        const v = gira(d.ev);
        const fa = f * u[0];
        const fb = f * u[1];
        const fc = f * v[0];
        const fd = f * v[1];
        xf = bx * f;
        yf = by * f;
        mf = [fa, fb, fc, fd];
        const frente = bz / R; // -1 (atrás) … 1 (de frente)
        const sm = clamp((frente + 0.15) / 0.35);
        const opEsfera = lerp(0.3, 1, sm * sm * (3 - 2 * sm)); // as de trás aparecem de leve: volume
        x = lerp(x, bx * f, c);
        y = lerp(y, by * f, c);
        ma = lerp(ma, fa, c);
        mb = lerp(mb, fb, c);
        mc = lerp(mc, fc, c);
        md = lerp(md, fd, c);
        op = lerp(copia ? 0 : op, opEsfera, c);
        z = 1 + Math.round((frente + 1) * 500 * c);
        alvo = frente > 0.05 && Math.abs(fa * fd - fb * fc) > 0.12 ? 1 : 0;
      }
      if (c > 0.01) {
        // pontas nos polos: o card encolhe o bastante para ficar dentro da silhueta da esfera (sem cortar nem arredondar)
        const lim = (R * D) / Math.sqrt(D * D - 1) * 0.985;
        const dc = Math.hypot(xf, yf);
        const hw = (d.ar * hs) / 2;
        const hh = hs / 2;
        const cantos = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([p, q]) => [mf[0] * p * hw + mf[2] * q * hh, mf[1] * p * hw + mf[3] * q * hh]);
        let kk = 1;
        for (let it = 0; it < 3; it++) {
          const mx = Math.max(...cantos.map(([ox, oy]) => Math.hypot(xf + kk * ox, yf + kk * oy)));
          if (mx <= lim || mx - dc < 1) break;
          kk = Math.max(0.5, (kk * (lim - dc)) / (mx - dc));
        }
        const kc = lerp(1, kk, c); // o ajuste entra junto com a explosão, sem salto no fim dela
        ma *= kc;
        mb *= kc;
        mc *= kc;
        md *= kc;
      }
      if (mix > 0.001) {
        // galeria: posição na grade (coordenadas da tela → locais da esfera), escala uniforme, só os originais
        const gs = galSuave[i] ?? galPos[i];
        const alvoG = galPos[i];
        if (arrasto && arrasto.i === i && !copia) {
          // card sendo arrastado: gruda no ponteiro (coordenadas de conteúdo da galeria)
          gs.x = arrasto.px + arrasto.dx;
          gs.y = arrasto.py + galAtual + arrasto.dy;
        } else if (!copia) {
          const k = 1 - Math.exp(-dt / 70);
          gs.x += (alvoG.x - gs.x) * k;
          gs.y += (alvoG.y - gs.y) * k;
        }
        const gp = copia ? (galSuave[i % n] ?? alvoG) : gs;
        const gx = gp.x - vw / 2;
        const gy = gp.y - galAtual - vh / 2 - navAtual / 2;
        x = lerp(x, gx, mix);
        y = lerp(y, gy, mix);
        const sg = galEsc[i % n] ?? sGaleria;
        ma = lerp(ma, sg, mix);
        mb = lerp(mb, 0, mix);
        mc = lerp(mc, 0, mix);
        md = lerp(md, sg, mix);
        op = lerp(op, copia || !galMostra[i % n] ? 0 : 1, mix);
        if (mix > 0.5) z = 1;
        if (mix > 0.5 && !copia) alvo = 1;
      }
      el.style.transform = `matrix(${ma.toFixed(4)}, ${mb.toFixed(4)}, ${mc.toFixed(4)}, ${md.toFixed(4)}, ${x.toFixed(2)}, ${y.toFixed(2)}) scale(${1 / SUPER}) translate(-50%, -50%)`;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = String(z);
      el.style.visibility = op < 0.01 ? 'hidden' : '';
      el.style.pointerEvents = girar && alvo && op > 0.6 && rolagemAtual < 0.6 ? 'auto' : 'none';
    });
    // estrutura da esfera: meridianos e paralelos de 0,8px, girando junto com os cards
    const we = outCubic(prog(t, T_EXPLODE, 1400));
    linhas.style.opacity = (we * (1 - mix)).toFixed(3);
    if (we > 0 && mix < 0.99) desenharLinhas(gira, R);

    requestAnimationFrame(quadro);
  };

  // ---------- alterar visualização ----------
  const opcoes = [...document.querySelectorAll<HTMLElement>('[data-modo]')];
  for (const o of opcoes) {
    o.addEventListener('click', () => {
      modo = o.dataset.modo === 'galeria' ? 'galeria' : 'esfera';
      document.querySelector('[data-info]')?.classList.toggle('info--gal', modo === 'galeria');
      editor?.classList.toggle('is-on', editando && modo === 'galeria');
      if (modo === 'galeria') {
        rolagem = 0; // volta ao 1º viewport antes de trocar
        galAlvo = 0;
      }
      for (const p of opcoes) p.setAttribute('aria-checked', String(p === o));
    });
  }
  // telas de toque: tocar no selo abre/fecha as coisas que saem da cabeça (no desktop é ao pairar, em CSS)
  const alvo = document.querySelector<HTMLElement>('[data-alvo]');
  if (alvo && matchMedia('(hover: none)').matches) alvo.addEventListener('click', () => alvo.closest('.palco')?.classList.toggle('is-aberto'));

  // ---------- informações do card ao pairar ----------
  const info = document.querySelector<HTMLElement>('[data-info]');
  const infoTitulo = info?.querySelector<HTMLElement>('[data-info-titulo]');
  const infoFuncao = info?.querySelector<HTMLElement>('[data-info-funcao]');
  const infoLink = info?.querySelector<HTMLAnchorElement>('[data-info-link]');
  let infoTimer = 0;
  const esconderInfo = () => {
    clearTimeout(infoTimer);
    infoTimer = window.setTimeout(() => {
      if (modalAberto()) return; // com o card aberto, o texto permanece
      info?.classList.remove('is-visivel');
      if (infoTitulo) infoTitulo.dataset.atual = ''; // ao reabrir o mesmo card o texto reaparece
      for (const t of [infoTitulo, infoFuncao, infoLink]) if (t) revelar(t, false);
    }, 450); // dá tempo de chegar ao link
  };
  if (info && infoTitulo && infoFuncao && infoLink && matchMedia('(hover: hover)').matches) {
    info.addEventListener('pointerenter', () => clearTimeout(infoTimer));
    let modalEstava = false;
    new MutationObserver(() => {
      const agora = modalAberto();
      if (modalEstava && !agora) esconderInfo(); // só quando o modal fecha: o texto some em seguida
      modalEstava = agora;
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
    info.addEventListener('pointerleave', esconderInfo);
    for (const el of tiles) {
      if (!el.dataset.titulo) continue;
      el.addEventListener('pointerenter', () => {
        if (modo !== 'esfera' || modalAberto()) return;
        clearTimeout(infoTimer);
        infoTitulo.dataset.atual = el.dataset.titulo ?? '';
        reescrever(infoTitulo, el.dataset.titulo ?? '');
        reescrever(infoFuncao, el.dataset.funcao ?? '');
        infoLink.hidden = true; // "Ver post" só aparece ao clicar no card
        info.classList.add('is-visivel');
      });
      el.addEventListener('pointerleave', esconderInfo);
      el.addEventListener('click', () => {
        clearTimeout(infoTimer);
        if (infoTitulo.dataset.atual !== el.dataset.titulo) {
          infoTitulo.dataset.atual = el.dataset.titulo ?? '';
          reescrever(infoTitulo, el.dataset.titulo ?? '');
          reescrever(infoFuncao, el.dataset.funcao ?? '');
        }
        if (el.dataset.link) {
          infoLink.href = el.dataset.link;
          infoLink.hidden = false;
          reescrever(infoLink, 'Ver post →');
        } else infoLink.hidden = true;
        info.classList.add('is-visivel');
      });
    }
  }

  // ---------- navegação pela navbar ----------
  // #galeria → viewport da esfera; #sobre → 1º viewport do sobre (GIF). O logo recarrega a home (abertura completa).
  const irPara = (destino: string) => {
    if (modalAberto()) return;
    if (modo === 'galeria') opcoes.find((o) => o.dataset.modo === 'esfera')?.click();
    if (vt < FIM) pulando = true;
    pendente = destino === 'sobre' ? rDe(0.8, true) : destino === 'projetos' ? R_PROJ() : destino === 'contato' ? R_CONT() : 0; // 1.0 cai no platô do GIF
    if (vt >= FIM) {
      rolagem = pendente;
      pendente = null;
    }
  };
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.nav__link[href^="/#"]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const d = a.hash.slice(1);
      history.replaceState(null, '', a.hash);
      irPara(d);
    });
  }
  // chegou de outra página já com #galeria / #sobre: pula a abertura
  const inicial = location.hash.slice(1);
  if (inicial === 'galeria' || inicial === 'sobre' || inicial === 'trabalho' || inicial === 'foto' || inicial === 'projetos' || inicial === 'contato') {
    vt = FIM + 1;
    pendente = inicial === 'sobre' ? rDe(0.8, true) : inicial === 'foto' ? rDe(1.4, true) : inicial === 'trabalho' ? rDe(E2, true) : inicial === 'projetos' ? R_PROJ() : inicial === 'contato' ? R_CONT() : 0; // #trabalho: viewport do "trabalho com"
  }

  // "Ignorar nas próximas vezes" no aviso mobile: segue direto para a galeria, sem a abertura
  addEventListener('aviso-ignorado', () => {
    if (vt < FIM) vt = FIM + 1;
    pendente = null;
    rolagem = 0;
  });

  requestAnimationFrame(quadro);
}
