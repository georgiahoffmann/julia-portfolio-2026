// @ts-check
import { defineConfig } from 'astro/config';

// Site estático (output padrão do Astro): o Vercel detecta sozinho, sem adapter nem vercel.json.
export default defineConfig({
  site: 'https://juliapedo.com',
});
