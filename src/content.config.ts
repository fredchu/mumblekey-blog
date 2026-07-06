import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  // 成對雙語文章共用同一串 giscus 留言的 key；預設用 slug
  discussionTerm: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
  schema: postSchema,
});

const demos = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/demos' }),
  schema: postSchema.extend({
    sourceUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
  }),
});

export const collections = { blog, demos };
