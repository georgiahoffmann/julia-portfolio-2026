import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Retângulo em unidades de canvas (unidades do layout original). Desktop: canvas de 1024. Mobile: canvas de 320.
const rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

// POSTS — cada post da galeria é um arquivo. `mobile` ausente = não aparece no layout mobile (como no original).
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tipo: z.enum(['imagem', 'pendente', 'pendente-video']),
      image: image().optional(),
      alt: z.string().optional(),
      link: z.string().url().optional(),
      funcao: z.string().optional(), // papel dela na criação do card (aparece ao pairar na esfera)
      video: z.string().optional(), // vídeo de um carrossel (arquivo em public/)
      desktop: rect,
      mobile: rect.optional(),
      ordem: z.number(),
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

// SOBRE — textos institucionais (corpo em Markdown = parágrafo longo da intro).
const sobre = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sobre' }),
  schema: ({ image }) =>
    z.object({
    nome: z.string(),
    funcao: z.string(),
    resumo: z.string(),
    email: z.string(),
    instagram: z.string(),
    linkedin: z.string(),
  }),
});

export const collections = { posts, projetos, sobre };
