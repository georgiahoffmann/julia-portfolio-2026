// @ts-check
import { defineConfig } from 'astro/config';

// Site estático (output padrão do Astro): o Vercel detecta sozinho, sem adapter nem vercel.json.
export default defineConfig({
  // TODO(domínio): URL provisória da Vercel. Quando a Julia comprar o domínio definitivo, trocar aqui
  // (usado na URL canônica, og:url, og:image e twitter:image) e reconfigurar o domínio no projeto da Vercel.
  site: 'https://julia-portfolio-2026.vercel.app',
});
