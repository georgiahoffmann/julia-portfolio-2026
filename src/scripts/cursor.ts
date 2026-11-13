// Cursor customizado (só com mouse): a estrela segue o ponteiro.
const cursor = document.querySelector<HTMLElement>('[data-anim="cursor"]');

if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.documentElement.classList.add('has-custom-cursor');

  // na abertura o cursor só surge quando o Juju pisca
  const waiting = () => document.querySelector('[data-anim="splash"][data-state="inicio"]') !== null;

  window.addEventListener(
    'mousemove',
    (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      cursor.classList.toggle('is-visible', !waiting());
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
}
