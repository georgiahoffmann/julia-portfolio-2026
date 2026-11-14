// Carrosséis da galeria: cada lâmina repousa 800 ms e a próxima entra em fade de 600 ms (CSS em PostTile.astro),
// na esfera e na visão de galeria. Cartões, cópias da esfera e o card expandido ficam sincronizados pelo id do post.
// Clicar no card (esfera ou galeria) para a passagem automática daquele carrossel; a partir daí só as setas
// (ou ← →) do card expandido trocam de lâmina. prefers-reduced-motion: nunca passa sozinho.
const REPOUSO = 800;
const TRANSICAO = 600; // casa com a transição em CSS
const indice = new Map<string, number>();
const parados = new Set<string>();
const fimAnt = new Map<string, number>();

const grupos = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-slides="${CSS.escape(id)}"]`)];

/** começa a baixar a lâmina i nos cards (as lâminas 2+ nascem sem src, ver PostTile.astro). Devolve se ela já está pronta. */
function carregar(id: string, i: number) {
  let pronta = true;
  for (const g of grupos(id)) {
    const img = g.querySelectorAll<HTMLImageElement>(':scope > img')[i];
    if (!img) continue;
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      if (img.dataset.src) img.src = img.dataset.src;
      delete img.dataset.srcset;
      delete img.dataset.src;
    }
    if (!img.closest('.modal') && (!img.complete || !img.naturalWidth)) pronta = false; // o card expandido carrega só ao abrir (modal.ts)
  }
  return pronta;
}

function ir(id: string, passo: number) {
  const gs = grupos(id);
  const n = gs[0]?.querySelectorAll(':scope > img').length ?? 0;
  if (n < 2) return;
  const atual = indice.get(id) ?? 0;
  const i = (atual + passo + n) % n;
  // a próxima lâmina só entra quando já foi baixada (sem fade de imagem vazia); a seguinte já começa a baixar
  if (!carregar(id, i)) return;
  carregar(id, (i + passo + n) % n);
  indice.set(id, i);
  for (const g of gs) {
    const imgs = g.querySelectorAll<HTMLElement>(':scope > img');
    imgs.forEach((img) => img.classList.remove('is-ant'));
    imgs[atual].classList.remove('is-on');
    imgs[atual].classList.add('is-ant'); // a anterior segue opaca por baixo até a nova terminar o fade
    imgs[i].classList.add('is-on');
  }
  for (const ponto of document.querySelectorAll(`[data-pontos="${CSS.escape(id)}"] > span`)) {
    ponto.classList.toggle('is-on', ponto === ponto.parentElement!.children[i]);
  }
  clearTimeout(fimAnt.get(id));
  fimAnt.set(
    id,
    window.setTimeout(() => {
      for (const g of grupos(id)) g.querySelectorAll(':scope > img').forEach((img) => img.classList.remove('is-ant'));
    }, TRANSICAO),
  );
}

function ciclo() {
  if (!document.hidden) {
    const ids = new Set<string>();
    for (const g of document.querySelectorAll<HTMLElement>('[data-slides]')) ids.add(g.dataset.slides!);
    for (const id of ids) if (!parados.has(id)) ir(id, 1);
  }
  window.setTimeout(ciclo, REPOUSO + TRANSICAO);
}

document.addEventListener('carrossel:parar', (e) => parados.add((e as CustomEvent<string>).detail));
document.addEventListener('carrossel:ir', (e) => {
  const { id, passo } = (e as CustomEvent<{ id: string; passo: number }>).detail;
  parados.add(id);
  ir(id, passo);
});

// depois da abertura, em ociosidade e escalonado, baixa a 2ª lâmina de cada carrossel (uma por vez, sem competir com a abertura)
const ids0 = () => [...new Set([...document.querySelectorAll<HTMLElement>('[data-slides]')].map((g) => g.dataset.slides!))];
const pre = (fila: string[]) => {
  const id = fila.shift();
  if (!id) return;
  carregar(id, 1);
  window.setTimeout(() => pre(fila), 350);
};
const iniciarPre = () => pre(ids0());
if (document.readyState === 'complete') window.setTimeout(iniciarPre, 1500);
else addEventListener('load', () => window.setTimeout(iniciarPre, 1500), { once: true });

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) window.setTimeout(ciclo, REPOUSO);
