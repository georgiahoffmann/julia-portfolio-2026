// Expansão dos cards da galeria: a mídia clicada cresce da posição do card até o centro da tela
// (sem painel nem bordas); o fundo perde a saturação. Dá para arrastar a mídia pela tela.
// Fecha clicando fora, com Esc, ou ao rolar até o card original sair da tela.
// Não usa <dialog> para que o cursor customizado (z-index próprio) continue visível por cima.
let aberto: HTMLElement | null = null;
let origem: HTMLElement | null = null;
let ocupado = false;

const midiaDe = (modal: HTMLElement) => modal.querySelector<HTMLElement>('[data-midia]')!;
const figuraDe = (modal: HTMLElement) => modal.querySelector<HTMLElement>('[data-figura]')!;

/** transform que leva a mídia (na posição atual) de volta ao retângulo do card */
function deltaAteCard(midia: HTMLElement, card: HTMLElement) {
  const a = card.getBoundingClientRect();
  const b = midia.getBoundingClientRect();
  const k = a.width / b.width;
  return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${k})`;
}

/** carrega a imagem grande antes de animar, para a expansão nunca "pular" */
function preparar(modal: HTMLElement) {
  const img = modal.querySelector<HTMLImageElement>('img');
  if (img) img.loading = 'eager';
  return img;
}

async function abrir(modal: HTMLElement, gatilho: HTMLElement) {
  if (ocupado) return;
  ocupado = true;
  const img = preparar(modal);
  if (img && !img.complete) {
    await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
  }
  aberto = modal;
  origem = gatilho;
  const midia = midiaDe(modal);
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('is-modal-open');

  // começa no tamanho/posição do card, sem transição, e então expande
  midia.style.transition = 'none';
  midia.style.transform = deltaAteCard(midia, gatilho);
  void midia.offsetWidth;
  gatilho.classList.add('is-origem');
  midia.style.transition = '';
  midia.style.transform = 'none';
  modal.classList.add('is-shown');
  ocupado = false;
}

function fechar() {
  if (!aberto || !origem) return;
  const modal = aberto;
  const card = origem;
  const midia = midiaDe(modal);
  aberto = null;
  origem = null;
  ocupado = true;
  modal.classList.remove('is-shown');
  modal.querySelector('video')?.pause();
  modal.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('is-modal-open'); // a saturação volta junto
  midia.style.transform = deltaAteCard(midia, card);

  let feito = false;
  const fim = () => {
    if (feito) return;
    feito = true;
    midia.removeEventListener('transitionend', fim);
    modal.classList.remove('is-open');
    card.classList.remove('is-origem');
    figuraDe(modal).style.transform = '';
    midia.style.transform = 'none';
    ocupado = false;
  };
  midia.addEventListener('transitionend', fim);
  window.setTimeout(fim, 1100); // garantia
}

// aquece a imagem grande assim que o ponteiro chega no card
const aquecer = (e: Event) => {
  const gatilho = (e.target as Element | null)?.closest<HTMLElement>('[data-modal]');
  const modal = gatilho && document.getElementById(gatilho.dataset.modal!);
  if (modal) preparar(modal);
};
document.addEventListener('pointerover', aquecer);
document.addEventListener('touchstart', aquecer, { passive: true });

document.addEventListener('click', (e) => {
  const alvo = e.target as Element | null;
  const gatilho = alvo?.closest<HTMLElement>('[data-modal]');
  if (gatilho) {
    if (aberto) return;
    const modal = document.getElementById(gatilho.dataset.modal!);
    if (modal) abrir(modal, gatilho);
    return;
  }
  // clicar em qualquer lugar fora da mídia e do link fecha
  if (aberto && !alvo?.closest('[data-midia], .modal__link') && alvo?.closest('.modal')) fechar();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fechar();
});

// rolou o bastante para o card original sair da tela: a mídia volta suavemente ao lugar
window.addEventListener('galeria:pan', () => {
  if (!aberto || !origem) return;
  const r = origem.getBoundingClientRect();
  if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) fechar();
});

// arrastar a mídia expandida pela tela (mouse e toque)
let arrasto: { id: number; x: number; y: number; ox: number; oy: number } | null = null;
document.addEventListener('pointerdown', (e) => {
  if (!aberto) return;
  const alvo = e.target as Element;
  const midia = alvo.closest<HTMLElement>('[data-midia]');
  if (!midia || !aberto.contains(midia)) return;
  const video = alvo.closest('video');
  if (video && e.clientY > video.getBoundingClientRect().bottom - 56) return; // deixa os controles livres
  const figura = figuraDe(aberto);
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(figura.style.transform);
  arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: m ? +m[1] : 0, oy: m ? +m[2] : 0 };
});
window.addEventListener('pointermove', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id || !aberto) return;
  figuraDe(aberto).style.transform = `translate(${arrasto.ox + e.clientX - arrasto.x}px, ${arrasto.oy + e.clientY - arrasto.y}px)`;
});
const largar = (e: PointerEvent) => {
  if (arrasto && e.pointerId === arrasto.id) arrasto = null;
};
window.addEventListener('pointerup', largar);
window.addEventListener('pointercancel', largar);
