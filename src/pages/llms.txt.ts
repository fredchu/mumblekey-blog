import type { APIRoute } from 'astro';
import { langFromId, slugFromId } from '../lib/i18n';
import { publishedEntries } from '../lib/content';
import { SITE_URL } from '../consts';

// https://llmstxt.org/ — 給 LLM/agent 的站台導覽
export const GET: APIRoute = async () => {
  const posts = await publishedEntries('blog');
  const demos = await publishedEntries('demos');

  const lines: string[] = [
    '# MumbleKey Blog',
    '',
    '> Fred Chu on AI agent engineering, one-person-company automation, and cycle-based trading.',
    '> Bilingual: Traditional Chinese (zh-TW, primary) and English. Paired posts share a slug:',
    `> ${SITE_URL}/zh/posts/<slug>/ and ${SITE_URL}/en/posts/<slug>/.`,
    '> Every post has a plain-Markdown version at the same URL with a .md suffix (drop the trailing slash).',
    '',
    '## Posts',
    '',
  ];
  for (const post of posts) {
    const lang = langFromId(post.id);
    const slug = slugFromId(post.id);
    lines.push(
      `- [${post.data.title}](${SITE_URL}/${lang}/posts/${slug}.md): ${post.data.description}`,
    );
  }
  lines.push('', '## Demos', '');
  for (const demo of demos) {
    const lang = langFromId(demo.id);
    const slug = slugFromId(demo.id);
    lines.push(
      `- [${demo.data.title}](${SITE_URL}/${lang}/demos/${slug}/): ${demo.data.description}`,
    );
  }
  lines.push(
    '',
    '## Feeds',
    '',
    `- [RSS zh-TW](${SITE_URL}/zh/rss.xml): full-content feed, Traditional Chinese`,
    `- [RSS en](${SITE_URL}/en/rss.xml): full-content feed, English`,
    `- [Full content](${SITE_URL}/llms-full.txt): all posts concatenated as Markdown`,
    '',
  );
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
