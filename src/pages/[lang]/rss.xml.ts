import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { LOCALES, slugFromId, type Lang } from '../../lib/i18n';
import { publishedEntries } from '../../lib/content';
import { renderMarkdown } from '../../lib/markdown';
import { SITE_TITLE, SITE_DESC, SITE_URL } from '../../consts';

export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export const GET: APIRoute = async ({ params }) => {
  const lang = params.lang as Lang;
  const posts = await publishedEntries('blog', lang);
  return rss({
    title: SITE_TITLE[lang],
    description: SITE_DESC[lang],
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/${lang}/posts/${slugFromId(post.id)}/`,
      categories: post.data.tags,
      // 全文 RSS：agent 與 reader 都吃得到完整內容
      content: renderMarkdown(post.body ?? ''),
    })),
    customData: `<language>${lang === 'zh' ? 'zh-tw' : 'en'}</language>`,
  });
};
