import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';
import { langFromId, slugFromId, LOCALES } from './i18n';

type Coll = 'blog' | 'demos';

export async function publishedEntries<C extends Coll>(
  collection: C,
  lang?: Lang,
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection, ({ id, data }) => {
    if (import.meta.env.PROD && data.draft) return false;
    return lang ? langFromId(id) === lang : true;
  });
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 同 slug 在各語言實際存在的頁面路徑（給 hreflang / 語言切換） */
export async function pairPaths(
  collection: Coll,
  slug: string,
  base: 'posts' | 'demos',
): Promise<Partial<Record<Lang, string>>> {
  const entries = await getCollection(collection, ({ id, data }) => {
    if (import.meta.env.PROD && data.draft) return false;
    return slugFromId(id) === slug;
  });
  const paths: Partial<Record<Lang, string>> = {};
  for (const entry of entries) {
    const lang = langFromId(entry.id);
    paths[lang] = `/${lang}/${base}/${slug}/`;
  }
  return paths;
}

/** 首頁等索引頁固定成對 */
export function indexPaths(pathTemplate: (lang: Lang) => string) {
  const paths: Partial<Record<Lang, string>> = {};
  for (const lang of LOCALES) paths[lang] = pathTemplate(lang);
  return paths;
}
