import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ── Team ─────────────────────────────────────────────────────────────────────
const team = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/team' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    role: z.string(),
    focus: z.string(),
    bio: z.string(),
    photo: z.string(),
    credentials: z.array(
      z.object({
        label: z.string(),
        detail: z.string().optional(),
        year: z.number().optional(),
      })
    ),
    links: z.object({
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      website: z.string().url().optional(),
      email: z.string().email().optional(),
    }),
    order: z.number(),
  }),
});

// ── Work ─────────────────────────────────────────────────────────────────────
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    client: z.string(),
    type: z.string(),
    problem: z.string(),
    built: z.string(),
    outcome: z.string(),
    year: z.number(),
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    publishPermission: z.boolean().default(false),
  }),
});

// ── Services ─────────────────────────────────────────────────────────────────
const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    order: z.number(),
  }),
});

export const collections = { team, work, services };
