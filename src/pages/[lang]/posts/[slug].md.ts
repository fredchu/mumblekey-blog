import type { APIRoute } from 'astro';
import { langFromId, slugFromId } from '../../../lib/i18n';
import { publishedEntries } from '../../../lib/content';
import { absoluteUrl } from '../../../lib/seo';

export async function getStaticPaths() {
  const posts = await publishedEntries('blog');
  return posts.map((post) => ({
    params: { lang: langFromId(post.id), slug: slugFromId(post.id) },
    props: { post },
  }));
}

// 每篇文章的純 Markdown 版本，給 AI agent / LLM 抓取
export const GET: APIRoute = ({ props, params }) => {
  const { post } = props;
  const canonical = absoluteUrl(`/${params.lang}/posts/${params.slug}/`);
  const header = [
    `# ${post.data.title}`,
    '',
    `> ${post.data.description}`,
    `> Author: Fred Chu (MumbleKey) · Published: ${post.data.pubDate.toISOString().slice(0, 10)}`,
    `> Canonical: ${canonical}`,
    '',
  ].join('\n');
  return new Response(header + (post.body ?? ''), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
