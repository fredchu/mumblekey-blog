import type { APIRoute } from 'astro';
import { langFromId, slugFromId } from '../lib/i18n';
import { publishedEntries } from '../lib/content';
import { stripMdx } from '../lib/markdown';
import { SITE_URL } from '../consts';

// 給 edge Worker（MCP search_posts）與 npx CLI 用的全站索引
export const GET: APIRoute = async () => {
  const posts = await publishedEntries('blog');
  const demos = await publishedEntries('demos');
  const entries = [
    ...posts.map((p) => ({ kind: 'post', entry: p })),
    ...demos.map((d) => ({ kind: 'demo', entry: d })),
  ].map(({ kind, entry }) => {
    const lang = langFromId(entry.id);
    const slug = slugFromId(entry.id);
    const base = kind === 'post' ? 'posts' : 'demos';
    return {
      kind,
      lang: lang === 'zh' ? 'zh-TW' : 'en',
      slug,
      title: entry.data.title,
      description: entry.data.description,
      tags: entry.data.tags,
      pubDate: entry.data.pubDate.toISOString().slice(0, 10),
      url: `${SITE_URL}/${lang}/${base}/${slug}/`,
      mdUrl: kind === 'post' ? `${SITE_URL}/${lang}/posts/${slug}.md` : undefined,
      body: stripMdx(entry.body ?? ''),
    };
  });
  return new Response(JSON.stringify({ generated: new Date().toISOString(), entries }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
