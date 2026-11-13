# Júlia Pedó — portfólio

Site estático do portfólio de Júlia Pedó, designer visual de Porto Alegre. Uma única página (`/`) com abertura animada, esfera e galeria de posts, seção "sobre", projetos e contato.

## Stack

- Astro 7 (saída estática)
- TypeScript nos scripts de interação
- `@lucide/astro` para ícones
- Fontes próprias em `public/fonts` (Manrope e Julia Regular)

## Rodar localmente

Requer Node 22 ou superior (versão de referência em `.nvmrc`).

```
npm install
npm run dev       # servidor local (porta indicada no terminal)
npm run build     # gera a pasta dist/
npm run preview   # serve o resultado do build
```

## Estrutura

- `src/pages/` — páginas (`index.astro` é a home; `404.astro` é a página de erro)
- `src/layouts/Base.astro` — HTML base, metadados e cursor personalizado
- `src/components/` — navbar, cursor, card de post e links de contato
- `src/scripts/` — interações: `experiencia.ts` (abertura, esfera, rolagem), `tipografia.ts` (Text Appear e Text Pressure), `rotativa.ts` (palavra que gira), `cavalo.ts`, `cursor.ts`, `modal.ts`, `paleta.ts`
- `src/styles/` — tokens de design, fontes e estilos globais
- `src/content/` — textos e dados: `posts/`, `projetos/` e `sobre/`
- `src/assets/` — imagens processadas pelo Astro (posts, projetos, seção sobre, Juju)
- `public/` — arquivos servidos como estão: fontes, cursores, sprite do cavalo, vídeo do carrossel, favicon, miniatura de compartilhamento (`miniatura.jpg`, 1200×630) e `robots.txt`

## Editar o conteúdo

- Posts da esfera e da galeria: um arquivo `.md` por post em `src/content/posts/`. A imagem vai em `src/assets/posts/` e é referenciada no campo `image`. O campo `funcao` aparece ao passar o mouse sobre o card.
- Projetos: `src/content/projetos/`. A capa fica em `src/assets/projetos/` (mesmo nome do arquivo do projeto) e o campo `link` aponta para o Behance.
- Contatos (email, Instagram): `src/content/sobre/julia.md`. O link do LinkedIn está em `src/components/ContatoLinks.astro`.
- Textos da seção "sobre" e do grid: diretamente em `src/pages/index.astro`.
- Cores, tamanhos e tempos: `src/styles/tokens.css`.

## Deploy no Vercel

1. Importe o repositório no Vercel.
2. O Vercel detecta o Astro automaticamente: comando `npm run build`, pasta de saída `dist`. Não é preciso `vercel.json` nem adapter.
3. Antes de publicar, troque o valor de `site` em `astro.config.mjs` pelo domínio final (a miniatura e a URL canônica dependem dele).

## Pendências

- Definir `site` em `astro.config.mjs` (domínio final).
- Capa do projeto Guia do Calouro (`src/assets/projetos/`).

## Direitos

Todo o conteúdo (textos, imagens, projetos e identidade visual) pertence a Júlia Pedó. Não há licença de uso aberta.
