// Cursor customizado (só com mouse): a estrela segue o ponteiro.
//  - A partir da seção "sobre" o cursor troca de SVG (body.cursor-offwhite, definido em experiencia.ts).
//  - Nas seções do grid e do cavalo (web) o cursor é o mouse-10.svg em difference (body.cursor-escuro) e não deixa rasto.
//  - Nas demais (sobre/gif e contato) o mouse deixa um rasto de giz em azul que some devagar.
//  - Em projetos o cursor é a estrela (body.cursor-estrela), em difference e com opacidade total, sem rasto.
const cursor = document.querySelector<HTMLElement>('[data-anim="cursor"]');
const tela = document.querySelector<HTMLCanvasElement>('[data-anim="cursor-rasto"]');

// ---- rasto de giz ----
const COR_RASTRO = '#2b4cff'; // azul do rasto
const LARGURA = 2.8; // px de cada risco (60% mais fino que os 7px de antes)
const RISCOS = [-2.8, 0, 2.8]; // deslocamento (px) de cada risco, perpendicular ao movimento: 3 riscos paralelos como no giz
const DURACAO = 1500; // ms até o rasto sumir
const DIST_MIN = 3; // px entre pontos do rasto
const GRAO = 0.6; // escala da textura de giz (/cursors/giz.png)

if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.documentElement.classList.add('has-custom-cursor');

  // na abertura o cursor só surge quando o Juju pisca
  const waiting = () => document.querySelector('[data-anim="splash"][data-state="inicio"]') !== null;

  // seções em que o cursor é o escuro e não há rasto: o grid e o cavalo
  const secoesEscuras = ['.foto-seq', '.sobre-seq'].map((q) => document.querySelector<HTMLElement>(q));
  const mouse = { x: -1, y: -1, dentro: false };
  const secProj = document.querySelector<HTMLElement>('.proj-seq');
  type Modo = 'estrela' | 'escuro' | 'rasto' | 'projetos';
  let modo: Modo = 'estrela';
  const calcularModo = (): Modo => {
    if (!document.body.classList.contains('cursor-offwhite')) return 'estrela'; // antes da seção "sobre"
    for (const s of secoesEscuras) {
      if (!s) continue;
      const r = s.getBoundingClientRect();
      if (mouse.y >= r.top && mouse.y <= r.bottom && r.height > 0) return 'escuro';
    }
    if (secProj) {
      const r = secProj.getBoundingClientRect();
      if (mouse.y >= r.top && mouse.y <= r.bottom && r.height > 0) return 'projetos'; // projetos: cursor de estrela, sem rasto
    }
    return 'rasto';
  };

  // ---- canvas do rasto ----
  const ctx = tela && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? tela.getContext('2d') : null;
  type Ponto = { x: number; y: number; t: number };
  let pontos: Ponto[] = [];
  let rodando = false;
  let dpr = 1;
  const ajustar = () => {
    if (!tela) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    tela.width = Math.round(innerWidth * dpr);
    tela.height = Math.round(innerHeight * dpr);
  };
  ajustar();
  addEventListener('resize', ajustar);

  // textura de giz (alfa) tingida de azul; dois padrões com deslocamentos diferentes dão mais cobertura sem repetir tão visivelmente
  let padroes: CanvasPattern[] = [];
  const giz = new Image();
  giz.src = '/cursors/giz.png';
  giz.onload = () => {
    if (!ctx) return;
    const t = document.createElement('canvas');
    t.width = giz.width;
    t.height = giz.height;
    const c = t.getContext('2d')!;
    c.drawImage(giz, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = COR_RASTRO;
    c.fillRect(0, 0, t.width, t.height);
    padroes = [0, 1].map((k) => {
      const p = ctx.createPattern(t, 'repeat')!;
      p.setTransform(new DOMMatrix().scale(GRAO).translate(k * 37, k * 53));
      return p;
    });
  };

  const desenhar = (agora: number) => {
    if (!ctx || !tela) return;
    pontos = pontos.filter((p) => agora - p.t < DURACAO);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tela.width, tela.height);
    if (pontos.length < 2) {
      rodando = false;
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineWidth = LARGURA;
    for (let i = 1; i < pontos.length; i++) {
      const a = pontos[i - 1];
      const b = pontos[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      const v = 1 - (agora - b.t) / DURACAO;
      ctx.globalAlpha = Math.max(0, v) ** 1.2;
      RISCOS.forEach((off, k) => {
        for (const pad of padroes) {
          ctx.strokeStyle = pad;
          ctx.beginPath();
          ctx.moveTo(a.x + nx * off, a.y + ny * off);
          ctx.lineTo(b.x + nx * off, b.y + ny * off);
          ctx.stroke();
        }
        void k;
      });
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(desenhar);
  };

  const rasto = () => {
    const u = pontos[pontos.length - 1];
    if (u && Math.hypot(mouse.x - u.x, mouse.y - u.y) < DIST_MIN) return;
    pontos.push({ x: mouse.x, y: mouse.y, t: performance.now() });
    if (!rodando && padroes.length) {
      rodando = true;
      requestAnimationFrame(desenhar);
    }
  };

  // as seções se movem com a rolagem mesmo com o mouse parado: o modo é reavaliado a cada quadro enquanto o mouse está na janela
  const acompanhar = () => {
    if (mouse.dentro) {
      const novo = waiting() ? 'estrela' : calcularModo();
      if (novo !== modo) {
        modo = novo;
        document.body.classList.toggle('cursor-escuro', modo === 'escuro');
        document.body.classList.toggle('cursor-estrela', modo === 'projetos');
        if (modo !== 'rasto') pontos = [];
      }
    }
    requestAnimationFrame(acompanhar);
  };
  requestAnimationFrame(acompanhar);

  window.addEventListener(
    'mousemove',
    (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.dentro = true;
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      cursor.classList.toggle('is-visible', !waiting());
      if (modo === 'rasto') rasto();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => {
    mouse.dentro = false;
    cursor.classList.remove('is-visible');
    pontos = [];
  });
}
