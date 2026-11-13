// Seção de projetos: só um GIF roda por vez, o da capa que ocupa a maior parte do viewport.
// As outras capas mostram o primeiro quadro (data-poster); o GIF (data-gif) só é carregado quando a capa vira a mais visível.
const capas = [...document.querySelectorAll<HTMLImageElement>('.proj__img img[data-gif]')];

if (capas.length) {
  let ativa: HTMLImageElement | null = null;
  let trocando: HTMLImageElement | null = null;

  const area = (el: Element) => {
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? w * h : 0;
  };

  const tocar = async (img: HTMLImageElement) => {
    trocando = img;
    const pre = new Image();
    pre.src = img.dataset.gif!;
    try {
      await pre.decode(); // só troca quando o GIF já está pronto (sem piscar)
    } catch {
      /* segue mesmo assim */
    }
    if (trocando !== img) return; // outra capa virou a mais visível enquanto carregava
    img.src = img.dataset.gif!; // reinicia o GIF do primeiro quadro
    ativa = img;
  };

  const parar = (img: HTMLImageElement) => {
    if (img.dataset.poster && img.getAttribute('src') !== img.dataset.poster) img.src = img.dataset.poster;
  };

  const tick = () => {
    if (document.hidden) return;
    const areas = capas.map((c) => area(c.closest('.proj__img') ?? c));
    let melhor = 0;
    areas.forEach((a, i) => (a > areas[melhor] ? (melhor = i) : 0));
    const alvo = areas[melhor] > 0 ? capas[melhor] : null;
    // histerese: só troca se a nova ocupar pelo menos 10% mais que a atual
    const iAtual = ativa ? capas.indexOf(ativa) : -1;
    if (alvo && ativa && alvo !== ativa && areas[iAtual] > 0 && areas[melhor] < areas[iAtual] * 1.1) return;
    if (alvo === (trocando ?? ativa)) return;
    trocando = alvo;
    for (const c of capas) if (c !== alvo) parar(c);
    if (alvo) void tocar(alvo);
    else ativa = null;
  };

  setInterval(tick, 200);
  addEventListener('resize', tick);
  document.addEventListener('visibilitychange', tick);
  tick();
}
