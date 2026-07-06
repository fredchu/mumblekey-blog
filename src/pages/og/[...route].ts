import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { SITE_TITLE, SITE_DESC } from '../../consts';

const published = ({ data }: { data: { draft: boolean } }) =>
  !(import.meta.env.PROD && data.draft);

const posts = await getCollection('blog', published);
const demos = await getCollection('demos', published);

const pages: Record<string, { title: string; description: string }> = {
  'default/zh': { title: SITE_TITLE.zh, description: SITE_DESC.zh },
  'default/en': { title: SITE_TITLE.en, description: SITE_DESC.en },
};
for (const post of posts) {
  pages[`posts/${post.id}`] = { title: post.data.title, description: post.data.description };
}
for (const demo of demos) {
  pages[`demos/${demo.id}`] = { title: demo.data.title, description: demo.data.description };
}

const route = await OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    logo: undefined,
    bgGradient: [
      [15, 20, 25],
      [18, 40, 63],
    ],
    border: { color: [88, 166, 255], width: 12, side: 'inline-start' },
    padding: 72,
    font: {
      title: {
        size: 60,
        lineHeight: 1.35,
        families: ['Noto Sans TC'],
        weight: 'Bold',
        color: [255, 255, 255],
      },
      description: {
        size: 30,
        lineHeight: 1.6,
        families: ['Noto Sans TC'],
        color: [151, 163, 174],
      },
    },
    fonts: ['./src/assets/fonts/NotoSansTC.ttf'],
  }),
});

export const getStaticPaths = route.getStaticPaths;
export const GET = route.GET;
