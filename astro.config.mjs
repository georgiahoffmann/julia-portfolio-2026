// @ts-check
import { defineConfig } from 'astro/config';

// Site estático (output padrão do Astro): o Vercel detecta sozinho, sem adapter nem vercel.json.
export default defineConfig({
  // TODO: trocar pelo domínio final antes de publicar (usado em URLs canônicas e Open Graph)
  site: 'https://TROCAR-PELO-DOMINIO-FINAL.example',
});
