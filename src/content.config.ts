import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Retângulo em unidades de canvas (unidades do layout original). Desktop: canvas de 1024. Mobile: canvas de 320.
const rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

// POSTS — cada post da galeria é um arquivo. `mobile` ausente = não aparece no layout mobile (como no original).
// Ficam em src/content/posts/carrosseis/ (com `slides`) e src/content/posts/avulsos/; o id é só o nome do arquivo.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts', generateId: ({ entry }) => entry.split('/').pop()!.replace(/\.md$/, '') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tipo: z.enum(['imagem', 'pendente', 'pendente-video']),
      image: image().optional(),
      alt: z.string().optional(),
      slides: z.array(image()).optional(), // demais lâminas de um carrossel (a capa é `image`): passam em loop no card
      link: z.string().url().optional(),
      funcao: z.string().optional(), // papel dela na criação do card (aparece ao pairar na esfera)
      video: z.string().optional(), // vídeo de um carrossel (arquivo em public/)
      desktop: rect,
      mobile: rect.optional(),
      ordem: z.number(), // ordem na galeria (web)
      ordemMobile: z.number().optional(), // ordem na galeria no mobile; ausente = a mesma da web
    }),
});

// PROJETOS — cada projeto é um arquivo. `imagem` ausente = mostra o nome do projeto como pendência.
const projetos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projetos' }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string(),
      subtitulo: z.string(),
      chamada: z.string(),
      link: z.string().url().optional(),
      imagem: image().optional(),
      selo: z.string().optional(),
      ordem: z.number(),
      desktop: z.object({ texto: rect, imagem: rect, selo: rect.optional(), linha: z.number() }),
      mobile: z.object({ texto: rect, imagem: rect, selo: rect.optional(), linha: z.number() }),
    }),
});

// SOBRE — contato, título/descrição/imagem de compartilhamento do site, as 3 fotos da seção "sobre mim" e as coisas da cabeça.
// Editado pela Júlia no Pages CMS (.pages.yml).
const sobre = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sobre' }),
  schema: ({ image }) =>
    z.object({
      email: z.string(),
      instagram: z.string(),
      linkedin: z.string(), // só o usuário: linkedin.com/in/<usuário>
      site: z.object({
        titulo: z.string(),
        descricao: z.string(),
        imagem: image(), // prévia ao compartilhar o link (recortada em 1200×630)
        imagemAlt: z.string().optional(),
      }),
      fotos: z.object({
        grande: image(), // foto grande à esquerda
        grandeAlt: z.string().optional(),
        topo: image(), // foto do canto superior direito
        topoAlt: z.string().optional(),
        centro: image(), // foto do meio
        centroAlt: z.string().optional(),
      }),
      // coisas que saem da cabeça dela ao pairar no GIF (posição e tamanho ficam no código: index.astro)
      coisas: z.object({
        esquerdaAlto: image(),
        esquerdaLonge: image(),
        esquerdaBaixo: image(),
        direitaAlto: image(),
        direitaLonge: image(),
        direitaBaixo: image(), // também é o adesivo da seção de fotos
      }),
    }),
});

export const collections = { posts, projetos, sobre };
