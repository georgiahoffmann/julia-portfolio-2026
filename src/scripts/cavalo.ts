// Cavalo correndo em dither (viewport entre o GIF e o "sobre").
// 12 quadros-chave de um galope (folha em /cavalo/cavalos.png, 3 × 4 quadros de 640 × 440), cada um transformado em dither
// (densidade da silhueta + limiar de matriz Bayer 8×8, 1 bit, células de 3 px). Os quadros correm em sequência,
// com uma pausa entre eles e um rastro (after delay): os dois quadros anteriores permanecem esmaecendo, em pontilhado.
// A espiral áurea (dither, estática, em difference) está guardada aqui, desligada: ver cvAurea.
// Só anima com o viewport à vista; com prefers-reduced-motion mostra um quadro parado.
const cvCavalo = document.querySelector<HTMLCanvasElement>('[data-cavalo]');
// A espiral áurea é opcional: só é desenhada se existir um <canvas data-aurea> (guardada para uso futuro).
const cvAurea = document.querySelector<HTMLCanvasElement>('[data-aurea]');

if (cvCavalo) {
  const PIX = 3; // lado da célula do dither (px de CSS)
  const QW = 640;
  const QH = 440;
  const N = 12;
  const HOLD = 90; // ms que cada quadro-chave permanece (≈ 1,1 s por ciclo)
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OFF = [249, 255, 225]; // #f9ffe1
  
  const bayer = new Float32Array(64);
  const gerar = (n: number): number[][] => {
    if (n === 2) return [[0, 2], [3, 1]];
    const m = gerar(n / 2);
    const s = n / 2;
    const r: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const v = m[y][x] * 4;
        r[y][x] = v;
        r[y][x + s] = v + 2;
        r[y + s][x] = v + 3;
        r[y + s][x + s] = v + 1;
      }
    return r;
  };
  gerar(8).forEach((lin, y) => lin.forEach((v, x) => (bayer[y * 8 + x] = (v + 0.5) / 64)));
  const pack = (c: number[]) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; // ABGR (little-endian)

  // ruído de valor + fbm (3 oitavas)
  const hash = (i: number, j: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = (x - xi) * (x - xi) * (3 - 2 * (x - xi));
    const fy = (y - yi) * (y - yi) * (3 - 2 * (y - yi));
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x: number, y: number) => 0.55 * vn(x, y) + 0.3 * vn(x * 2.1 + 5, y * 2.1 + 3) + 0.15 * vn(x * 4.3 + 11, y * 4.3 + 7);

  const sheet = new Image();
  sheet.src = '/cavalo/cavalos.png';
  let quadros: Float32Array[] = [];
  let cols = 1;
  let rows = 1;
  let img32: Uint32Array | null = null;
  let imgData: ImageData | null = null;
  let visivel = false;
  let rodando = false;
  let t0 = -1;

  const dimensionar = (cv: HTMLCanvasElement) => {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(8, Math.round(r.width / PIX));
    cv.height = Math.max(8, Math.round(r.height / PIX));
  };

  /** densidade de cada quadro-chave na grade do dither */
  const prepararQuadros = () => {
    dimensionar(cvCavalo);
    cols = cvCavalo.width;
    rows = cvCavalo.height;
    const ctx = cvCavalo.getContext('2d')!;
    imgData = ctx.createImageData(cols, rows);
    img32 = new Uint32Array(imgData.data.buffer);
    const aux = document.createElement('canvas');
    aux.width = cols;
    aux.height = rows;
    const ax = aux.getContext('2d', { willReadFrequently: true })!;
    ax.imageSmoothingQuality = 'high';
    quadros = [];
    for (let i = 0; i < N; i++) {
      ax.clearRect(0, 0, cols, rows);
      ax.drawImage(sheet, (i % 3) * QW, Math.floor(i / 3) * QH, QW, QH, 0, 0, cols, rows);
      const px = ax.getImageData(0, 0, cols, rows).data;
      const f = new Float32Array(cols * rows);
      for (let k = 0; k < f.length; k++) f[k] = px[k * 4 + 3] / 255;
      quadros.push(f);
    }
  };

  let campoN = new Float32Array(0);
  const desenharCavalo = (i: number, u: number, tt = 0) => {
    if (!img32 || !imgData || !quadros.length) return;
    const cur = quadros[i % N];
    const p1 = quadros[(i + N - 1) % N];
    const p2 = quadros[(i + N - 2) % N];
    const w1 = 0.7 * (1 - u * 0.8); // rastro (after delay): os quadros anteriores esmaecem
    const w2 = 0.4 * (1 - u * 0.8);
    const cor = pack(OFF);
    // campo de movimento interno (como o Dither): ruído fractal em domínio distorcido, que corre devagar
    const G = 4; // o ruído é calculado numa grade 4× mais grossa e interpolado
    const gw = Math.ceil(cols / G) + 2;
    const gh = Math.ceil(rows / G) + 2;
    if (campoN.length !== gw * gh) campoN = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++)
      for (let i2 = 0; i2 < gw; i2++) {
        const px = i2 * 0.2;
        const py = j * 0.2;
        const w1n = vn(px * 0.7 + tt * 0.5, py * 0.7 - tt * 0.3);
        const w2n = vn(px * 0.7 - tt * 0.35 + 9.1, py * 0.7 + tt * 0.45 + 4.3);
        campoN[j * gw + i2] = fbm(px + w1n * 1.6 + tt * 0.25, py + w2n * 1.6);
      }
    for (let y = 0; y < rows; y++) {
      const gy = y / G;
      const j0 = Math.floor(gy);
      const fy = gy - j0;
      for (let x = 0; x < cols; x++) {
        const k = y * cols + x;
        const dMax = Math.max(cur[k], p1[k] * w1, p2[k] * w2);
        if (dMax < 0.02) {
          img32[k] = 0;
          continue;
        }
        const gx = x / G;
        const i0 = Math.floor(gx);
        const fx = gx - i0;
        const a = campoN[j0 * gw + i0];
        const b = campoN[j0 * gw + i0 + 1];
        const c = campoN[(j0 + 1) * gw + i0];
        const d = campoN[(j0 + 1) * gw + i0 + 1];
        const n = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
        // dentro da silhueta o preenchimento é vazado: densidade baixa que oscila com o campo
        const f = dMax * (0.2 + 0.775 * n); // +25% de densidade
        img32[k] = f > bayer[(y & 7) * 8 + (x & 7)] * 0.94 + 0.03 ? cor : 0;
      }
    }
    cvCavalo.getContext('2d')!.putImageData(imgData, 0, 0);
  };

  /** espiral áurea (retângulo + quadrados + arcos) em dither: linhas grossas = cheias; grade = pontilhada */
  const desenharAurea = () => {
    if (!cvAurea) return;
    dimensionar(cvAurea);
    const w = cvAurea.width;
    const h = cvAurea.height;
    const aux = document.createElement('canvas');
    aux.width = w;
    aux.height = h;
    const a = aux.getContext('2d', { willReadFrequently: true })!;
    const Wr = w - 2;
    const Hr = Wr / 1.618;
    const oy = (h - Hr) / 2;
    let x = 1;
    let y = oy;
    let ww = Wr;
    let hh = Hr;
    a.lineCap = 'round';
    a.strokeStyle = '#000';
    // grade: retângulo e quadrados (densidade média = pontilhado)
    a.globalAlpha = 0.6;
    a.lineWidth = 0.7;
    a.strokeRect(x, y, ww, hh);
    const arcos: [number, number, number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const k = i % 4;
      let s: number;
      if (k === 0) {
        s = hh;
        a.strokeRect(x, y, s, s);
        arcos.push([x + s, y + s, s, Math.PI, 1.5 * Math.PI]);
        x += s;
        ww -= s;
      } else if (k === 1) {
        s = ww;
        a.strokeRect(x, y, s, s);
        arcos.push([x, y + s, s, 1.5 * Math.PI, 2 * Math.PI]);
        y += s;
        hh -= s;
      } else if (k === 2) {
        s = hh;
        a.strokeRect(x + ww - s, y, s, s);
        arcos.push([x + ww - s, y, s, 0, 0.5 * Math.PI]);
        ww -= s;
      } else {
        s = ww;
        a.strokeRect(x, y + hh - s, s, s);
        arcos.push([x + ww, y + hh - s, s, 0.5 * Math.PI, Math.PI]);
        hh -= s;
      }
      if (s < 2) break;
    }
    // espiral: cheia
    a.globalAlpha = 1;
    a.lineWidth = 0.95;
    for (const [cx, cy, r, a0, a1] of arcos) {
      a.beginPath();
      a.arc(cx, cy, r, a0, a1);
      a.stroke();
    }
    const px = a.getImageData(0, 0, w, h).data;
    const ctx = cvAurea.getContext('2d')!;
    const dados = ctx.createImageData(w, h);
    const out = new Uint32Array(dados.data.buffer);
    const cor = pack(OFF);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const d = px[(yy * w + xx) * 4 + 3] / 255;
        out[yy * w + xx] = d > bayer[(yy & 7) * 8 + (xx & 7)] * 0.94 + 0.03 ? cor : 0;
      }
    ctx.putImageData(dados, 0, 0);
  };

  const quadro = (agora: number) => {
    if (!visivel) {
      rodando = false;
      return;
    }
    if (t0 < 0) t0 = agora;
    const t = Math.max(0, agora - t0);
    const i = Math.floor(t / HOLD);
    const u = (t % HOLD) / HOLD;
    desenharCavalo(i, u, t / 1000);
    requestAnimationFrame(quadro);
  };
  const iniciar = () => {
    if (!visivel || rodando || !quadros.length) return;
    if (reduzir) {
      desenharCavalo(4, 1);
      return;
    }
    rodando = true;
    t0 = -1;
    requestAnimationFrame(quadro);
  };
  const tudo = () => {
    if (!sheet.complete || !sheet.naturalWidth) return;
    prepararQuadros();
    desenharAurea();
    if (!rodando && visivel) desenharCavalo(4, 1);
    iniciar();
  };

  sheet.onload = tudo;
  new ResizeObserver(tudo).observe(cvCavalo);
  new IntersectionObserver(
    ([e]) => {
      visivel = e.isIntersecting;
      if (visivel) iniciar();
    },
    { threshold: 0.15 },
  ).observe(cvCavalo);
}
