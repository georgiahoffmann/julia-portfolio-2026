// Primeira seção do sobre no mobile (tela abaixo de 768px):
//  - as imagens são adesivos: qualquer pessoa pode arrastá-las dentro da tela (a posição volta ao padrão ao recarregar);
//  - em /?editar, também os versos, e o painel salva as posições como o novo padrão.
// Arrastar uma imagem muda --dxm/--dym (unidades k, a partir da cabeça). Tamanho e giro não mudam.
// Salvar: no `npm run dev` grava src/data/coisas-mobile.json; fora dele copia o JSON para colar no chat.
const editando = new URLSearchParams(location.search).has('editar');
const painel = document.querySelector<HTMLElement>('[data-editor-coisas]');
const estrela = document.querySelector<HTMLElement>('.estrela');
const palco = document.querySelector<HTMLElement>('.palco');
const movel = matchMedia('(max-width: 767px)');
// imagens: adesivos que qualquer pessoa pode arrastar no mobile; versos: só no modo de edição
const coisas = [...document.querySelectorAll<HTMLElement>('.estrela [data-coisa]')].filter((c) => editando || c.classList.contains('coisa'));

if (palco && coisas.length) {
  const num = (el: HTMLElement, v: string) => parseFloat(el.style.getPropertyValue(v));
  const lerPos = () => Object.fromEntries(coisas.map((c) => [c.dataset.coisa!, { dx: num(c, '--dxm'), dy: num(c, '--dym') }]));
  const inicial = lerPos();
  // rascunho: no modo de edição as posições ficam guardadas no navegador, para não se perderem se a página recarregar
  const RASCUNHO = 'rascunho-coisas-mobile';
  const guardar = () => {
    if (!editando) return;
    try {
      localStorage.setItem(RASCUNHO, JSON.stringify(lerPos()));
    } catch {
      /* sem armazenamento: segue sem rascunho */
    }
  };
  if (editando) {
    try {
      const r = JSON.parse(localStorage.getItem(RASCUNHO) ?? 'null');
      if (r) {
        for (const c of coisas) {
          const p = r[c.dataset.coisa!];
          if (p && Number.isFinite(p.dx) && Number.isFinite(p.dy)) {
            c.style.setProperty('--dxm', String(p.dx));
            c.style.setProperty('--dym', String(p.dy));
          }
        }
      }
    } catch {
      /* rascunho inválido: ignora */
    }
  }
  const msg = (t: string) => {
    const el = painel?.querySelector<HTMLElement>('[data-coisas-msg]');
    if (el) el.textContent = t;
  };
  // (modo de edição) o painel só aparece quando o GIF da seção está na tela
  if (editando && painel && estrela) {
    const mostrar = () => painel.classList.toggle('is-on', movel.matches && estrela.classList.contains('is-gif'));
    new MutationObserver(mostrar).observe(estrela, { attributes: true, attributeFilter: ['class'] });
    movel.addEventListener('change', mostrar);
    mostrar();
  }

  for (const c of coisas) {
    c.addEventListener('pointerdown', (e) => {
      if (!movel.matches) return;
      e.preventDefault();
      e.stopPropagation();
      c.setPointerCapture(e.pointerId);
      const k = palco.getBoundingClientRect().width / 63; // px por unidade k
      const x0 = e.clientX;
      const y0 = e.clientY;
      const dx0 = num(c, '--dxm');
      const dy0 = num(c, '--dym');
      c.style.zIndex = '2'; // por cima do selo enquanto arrasta
      const mover = (m: PointerEvent) => {
        c.style.setProperty('--dxm', (dx0 + (m.clientX - x0) / k).toFixed(1));
        c.style.setProperty('--dym', (dy0 + (m.clientY - y0) / k).toFixed(1));
        // a imagem não sai da tela (nem da área em que dá para pegá-la): se passar, volta para dentro
        const r = c.getBoundingClientRect();
        const M = 4;
        let ex = 0;
        let ey = 0;
        if (r.left < M) ex = M - r.left;
        else if (r.right > innerWidth - M) ex = innerWidth - M - r.right;
        if (r.top < M) ey = M - r.top;
        else if (r.bottom > innerHeight - M) ey = innerHeight - M - r.bottom;
        if (ex) c.style.setProperty('--dxm', (num(c, '--dxm') + ex / k).toFixed(1));
        if (ey) c.style.setProperty('--dym', (num(c, '--dym') + ey / k).toFixed(1));
        msg('');
      };
      const fim = () => {
        c.removeEventListener('pointermove', mover);
        c.removeEventListener('pointerup', fim);
        c.removeEventListener('pointercancel', fim);
        c.style.zIndex = '';
        guardar();
      };
      c.addEventListener('pointermove', mover);
      c.addEventListener('pointerup', fim);
      c.addEventListener('pointercancel', fim);
    });
  }

  painel?.querySelector('[data-coisas-desfazer]')?.addEventListener('click', () => {
    for (const c of coisas) {
      const p = inicial[c.dataset.coisa!];
      c.style.setProperty('--dxm', String(p.dx));
      c.style.setProperty('--dym', String(p.dy));
    }
    try {
      localStorage.removeItem(RASCUNHO);
    } catch {
      /* ok */
    }
    msg('Voltou às posições salvas');
  });
  painel?.querySelector('[data-coisas-salvar]')?.addEventListener('click', async () => {
    const pos = lerPos();
    try {
      const r = await fetch('/__salvar-coisas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pos) });
      if (r.ok) {
        try {
          localStorage.removeItem(RASCUNHO);
        } catch {
          /* ok */
        }
        return msg('Salvo nos arquivos ✓');
      }
    } catch {
      /* sem servidor de desenvolvimento: cai no copiar */
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(pos, null, 2));
      msg('Posições copiadas: cole no chat');
    } catch {
      msg('Não consegui salvar nem copiar');
    }
  });
}

// Adesivo coisas-12 da seção do grid (mobile): arrastável por todas as seções do "sobre" (a pilha inteira).
// A posição volta ao padrão ao recarregar.
const adesivo = document.querySelector<HTMLElement>('.sobre-pilha > .foto-seq__sticker');
const pilha = adesivo?.parentElement;
if (adesivo && pilha) {
  adesivo.addEventListener('pointerdown', (e) => {
    if (!movel.matches) return;
    e.preventDefault();
    e.stopPropagation(); // não deixa a página rolar enquanto arrasta
    adesivo.setPointerCapture(e.pointerId);
    const pr = pilha.getBoundingClientRect();
    const ar = adesivo.getBoundingClientRect();
    const w = adesivo.offsetWidth;
    const h = adesivo.offsetHeight;
    // distância entre o ponteiro e o centro do adesivo (o giro é em torno do centro)
    const ox = e.clientX - (ar.left + ar.width / 2);
    const oy = e.clientY - (ar.top + ar.height / 2);
    const mover = (m: PointerEvent) => {
      const cx = m.clientX - ox - pr.left;
      const cy = m.clientY - oy - pr.top;
      const x = Math.min(pr.width - w, Math.max(0, cx - w / 2));
      const y = Math.min(pr.height - h, Math.max(0, cy - h / 2));
      adesivo.style.left = `${((x / pr.width) * 100).toFixed(2)}%`;
      adesivo.style.top = `${y.toFixed(1)}px`;
    };
    const fim = () => {
      adesivo.removeEventListener('pointermove', mover);
      adesivo.removeEventListener('pointerup', fim);
      adesivo.removeEventListener('pointercancel', fim);
    };
    adesivo.addEventListener('pointermove', mover);
    adesivo.addEventListener('pointerup', fim);
    adesivo.addEventListener('pointercancel', fim);
  });
}
