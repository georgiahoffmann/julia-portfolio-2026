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

function ir(id: string, passo: number) {
  const gs = grupos(id);
  const n = gs[0]?.querySelectorAll(':scope > img').length ?? 0;
  if (n < 2) return;
  const atual = indice.get(id) ?? 0;
  const i = (atual + passo + n) % n;
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

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) window.setTimeout(ciclo, REPOUSO);
