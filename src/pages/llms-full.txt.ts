import type { APIRoute } from 'astro';
import { langFromId, slugFromId } from '../lib/i18n';
import { publishedEntries } from '../lib/content';
import { stripMdx } from '../lib/markdown';
import { SITE_URL } from '../consts';

// 全站文章串接的純 Markdown（llms-full.txt 慣例）
export const GET: APIRoute = async () => {
  const posts = await publishedEntries('blog');
  const sections = posts.map((post) => {
    const lang = langFromId(post.id);
    const slug = slugFromId(post.id);
    return [
      `# ${post.data.title}`,
      '',
      `> ${post.data.description}`,
      `> Language: ${lang === 'zh' ? 'zh-TW' : 'en'} · Published: ${post.data.pubDate
        .toISOString()
        .slice(0, 10)} · Canonical: ${SITE_URL}/${lang}/posts/${slug}/`,
      '',
      stripMdx(post.body ?? ''),
    ].join('\n');
  });
  return new Response(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
