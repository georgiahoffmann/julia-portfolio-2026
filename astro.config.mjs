// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Só no `npm run dev`: o modo de edição da galeria (`/?editar`) salva a nova ordem direto nos arquivos de
// src/content/posts (`ordem` = web, `ordemMobile` = mobile). No site publicado esta rota não existe.
const ID = /^[a-z0-9-]+$/;
const num = '-?\\d+(?:\\.\\d+)?';
const salvarOrdem = {
  name: 'salvar-ordem-galeria',
  hooks: {
    /** @param {{ server: import('vite').ViteDevServer }} ctx */
    'astro:server:setup': ({ server }) => {
      // posições das coisas do "sobre" no mobile: src/data/coisas-mobile.json (só as chaves que já existem)
      server.middlewares.use('/__salvar-coisas', (req, res) => {
        if (req.method !== 'POST') return void res.writeHead(405).end();
        let corpo = '';
        req.on('data', (c) => (corpo += c));
        req.on('end', () => {
          try {
            const arquivo = fileURLToPath(new URL('./src/data/coisas-mobile.json', import.meta.url));
            const atual = JSON.parse(readFileSync(arquivo, 'utf8'));
            const novo = JSON.parse(corpo);
            const chaves = Object.keys(atual);
            const ok = (/** @type {any} */ p) => p && Number.isFinite(p.dx) && Number.isFinite(p.dy) && Math.abs(p.dx) < 300 && Math.abs(p.dy) < 300;
            if (Object.keys(novo).length !== chaves.length || !chaves.every((k) => ok(novo[k]))) throw new Error('posições inválidas');
            writeFileSync(arquivo, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, { dx: novo[k].dx, dy: novo[k].dy }])), null, 2) + '\n');
            res.writeHead(200).end('ok');
          } catch (e) {
            res.writeHead(400).end(String(e));
          }
        });
      });
      server.middlewares.use('/__salvar-ordem', (req, res) => {
        if (req.method !== 'POST') return void res.writeHead(405).end();
        let corpo = '';
        req.on('data', (c) => (corpo += c));
        req.on('end', () => {
          try {
            const { web, mobile } = JSON.parse(corpo);
            const arq = (/** @type {string} */ id) => fileURLToPath(new URL(`./src/content/posts/${id}.md`, import.meta.url));
            const valido = (/** @type {unknown} */ l) => Array.isArray(l) && l.length > 0 && l.every((id) => typeof id === 'string' && ID.test(id) && existsSync(arq(id)));
            if (!valido(web) || !valido(mobile) || new Set(web).size !== web.length || [...web].sort().join() !== [...mobile].sort().join()) throw new Error('lista inválida');
            const textos = Object.fromEntries(web.map((/** @type {string} */ id) => [id, readFileSync(arq(id), 'utf8')]));
            // os mesmos números de `ordem` que já existiam, redistribuídos na nova sequência
            const pool = web.map((/** @type {string} */ id) => Number(new RegExp(`^ordem: *(${num}) *$`, 'm').exec(textos[id])?.[1])).sort((/** @type {number} */ a, /** @type {number} */ b) => a - b);
            if (pool.some(Number.isNaN)) throw new Error('post sem ordem');
            const igual = web.join() === mobile.join();
            web.forEach((/** @type {string} */ id, /** @type {number} */ i) => {
              let t = textos[id].replace(new RegExp(`^ordem: *${num} *$`, 'm'), `ordem: ${pool[i]}`).replace(/^ordemMobile: .*\n/m, '');
              const j = mobile.indexOf(id);
              if (!igual) t = t.replace(/^(ordem: .*)$/m, `$1\nordemMobile: ${pool[j]}`);
              writeFileSync(arq(id), t);
            });
            res.writeHead(200).end('ok');
          } catch (e) {
            res.writeHead(400).end(String(e));
          }
        });
      });
    },
  },
};

// Site estático (output padrão do Astro): o Vercel detecta sozinho, sem adapter nem vercel.json.
export default defineConfig({
  site: 'https://juliapedo.com',
  integrations: [salvarOrdem],
});
