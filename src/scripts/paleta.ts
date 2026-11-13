// Cor (fundo / texto) da palavra da vez na seção da rotação. O rotativa.ts anima estes valores em JS
// (sem CSS transition), e a home os lê a cada quadro sem forçar recálculo de estilo.
export const paleta = {
  bg: [249, 255, 225] as [number, number, number], // offwhite
  fg: [127, 22, 22] as [number, number, number], // vermelho
};
