// Palavra em rotação do "sobre": troca a cada 2,5 s por timer (não depende do scroll).
// Não pausa no hover; só pausa com foco do teclado e enquanto a seção não está à vista.
// prefers-reduced-motion: sem rotação, fica o primeiro item parado.
import { paleta } from './paleta';
import { revelar } from './tipografia';
const raiz = document.querySelector<HTMLElement>('[data-rotativa]');
const itens = raiz ? [...raiz.querySelectorAll<HTMLElement>('.rotativa__item')] : [];

if (raiz && itens.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const INTERVALO = 2500;
  const SAIDA = 400; // casa com a transição em CSS
  // pares de cor (fundo / texto) da seção: mudam a cada troca de palavra e a cada hover
  const secao = raiz.closest<HTMLElement>('.sobre-seq');
  const RGB: Record<string, [number, number, number]> = {
    '--color-off-white': [249, 255, 225],
    '--color-red': [127, 22, 22],
    '--color-light-blue': [190, 245, 252],
    '--color-black': [13, 12, 12],
    '--color-yellow': [255, 255, 113],
  };
  const DUR_COR = 1800; // troca de cor suave, em JS (a home lê `paleta` a cada quadro)
  let animCor = 0;
  const animarCor = (bg: [number, number, number], fg: [number, number, number]) => {
    cancelAnimationFrame(animCor);
    const bg0 = [...paleta.bg] as [number, number, number];
    const fg0 = [...paleta.fg] as [number, number, number];
    const t0 = performance.now();
    const passo = (agora: number) => {
      const x = Math.min(1, (agora - t0) / DUR_COR);
      const e = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; // easeInOutQuad
      for (let k = 0; k < 3; k++) {
        paleta.bg[k] = bg0[k] + (bg[k] - bg0[k]) * e;
        paleta.fg[k] = fg0[k] + (fg[k] - fg0[k]) * e;
      }
      if (x < 1) animCor = requestAnimationFrame(passo);
    };
    animCor = requestAnimationFrame(passo);
  };
  const PARES = [
    ['--color-off-white', '--color-red'],
    ['--color-red', '--color-light-blue'],
    ['--color-light-blue', '--color-black'],
    ['--color-yellow', '--color-black'],
    ['--color-red', '--color-yellow'],
  ];
  let par = 0;
  // cada palavra tem o seu par fixo (índice da palavra); hover não muda cor
  const aplicarPar = (i: number) => {
    par = i % PARES.length;
    if (secao) secao.dataset.fundo = PARES[par][0] === '--color-red' ? 'claro' : 'escuro'; // grão offwhite em fundo escuro
    animarCor(RGB[PARES[par][0]], RGB[PARES[par][1]]);
  };
  let atual = 0;
  let foco = false;

  const trocar = () => {
    const ant = itens[atual];
    atual = (atual + 1) % itens.length;
    ant.classList.replace('is-ativa', 'is-saindo');
    itens[atual].classList.add('is-ativa');
    revelar(itens[atual], true); // Text Appear da palavra que entra
    setTimeout(() => revelar(ant, false), SAIDA); // a que saiu volta ao estado inicial, pronta para a próxima vez
    aplicarPar(atual);
    setTimeout(() => ant.classList.remove('is-saindo'), SAIDA);
  };
  setInterval(() => {
    if (!foco && secao?.classList.contains('is-pronta')) trocar(); // só roda com a seção à vista
  }, INTERVALO);

  raiz.addEventListener('focusin', () => (foco = true));
  raiz.addEventListener('focusout', () => (foco = false));
}
