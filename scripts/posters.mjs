// Gera o primeiro quadro (webp estático) da capa GIF de cada projeto (campo `imagem` em src/content/projetos/*.md).
// O poster sai com o id do projeto (nome do .md) em src/assets/projetos-posters/.
// Os GIFs só rodam quando são o projeto mais visível; os outros mostram este quadro parado.
// Roda sozinho antes do dev e do build (só refaz o que mudou).
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import sharp from 'sharp';

const conteudo = 'src/content/projetos';
const destino = 'src/assets/projetos-posters';
mkdirSync(destino, { recursive: true });
for (const md of readdirSync(conteudo).filter((n) => /\.md$/i.test(n))) {
  const caminho = /^imagem:\s*["']?(.+?)["']?\s*$/m.exec(readFileSync(join(conteudo, md), 'utf8'))?.[1];
  if (!caminho || !/\.gif$/i.test(caminho)) continue;
  const entrada = resolve(dirname(join(conteudo, md)), caminho);
  if (!existsSync(entrada)) continue;
  const saida = join(destino, `${basename(md, '.md')}.webp`);
  if (existsSync(saida) && statSync(saida).mtimeMs >= statSync(entrada).mtimeMs) continue;
  await sharp(entrada, { animated: false }).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(saida);
  console.log(`poster: ${saida}`);
}
