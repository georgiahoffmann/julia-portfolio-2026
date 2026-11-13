// Gera o primeiro quadro (webp estático) de cada GIF de capa em src/assets/projetos/.
// Os GIFs só rodam quando são o projeto mais visível; os outros mostram este quadro parado.
// Roda sozinho antes do dev e do build (só refaz o que mudou).
import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';

const origem = 'src/assets/projetos';
const destino = 'src/assets/projetos-posters';
mkdirSync(destino, { recursive: true });
for (const f of readdirSync(origem).filter((n) => /\.gif$/i.test(n))) {
  const entrada = join(origem, f);
  const saida = join(destino, `${basename(f, '.gif')}.webp`);
  if (existsSync(saida) && statSync(saida).mtimeMs >= statSync(entrada).mtimeMs) continue;
  await sharp(entrada, { animated: false }).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(saida);
  console.log(`poster: ${saida}`);
}
