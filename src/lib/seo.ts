import { SITE_URL, AUTHOR, ORG } from '../consts';
import type { Lang } from './i18n';
import { HREFLANG, LOCALES, X_DEFAULT } from './i18n';

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

// 成對頁面的 hreflang alternates：self-reference + 雙向對稱 + x-default
export function hreflangLinks(pathByLang: Partial<Record<Lang, string>>) {
  const links: { hreflang: string; href: string }[] = [];
  for (const lang of LOCALES) {
    const path = pathByLang[lang];
    if (path) links.push({ hreflang: HREFLANG[lang], href: absoluteUrl(path) });
  }
  const xDefault = pathByLang[X_DEFAULT] ?? Object.values(pathByLang)[0];
  if (xDefault && links.length > 1) {
    links.push({ hreflang: 'x-default', href: absoluteUrl(xDefault) });
  }
  return links;
}

const personLd = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#author`,
  name: AUTHOR.name,
  url: absoluteUrl(AUTHOR.aboutPath),
  sameAs: [AUTHOR.github],
};

const orgLd = {
  '@type': 'Organization',
  '@id': `${ORG.url}/#org`,
  name: ORG.name,
  url: ORG.url,
};

export function blogPostingLd(opts: {
  title: string;
  description: string;
  url: string;
  lang: Lang;
  pubDate: Date;
  updatedDate?: Date;
  tags: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: opts.url,
    inLanguage: opts.lang === 'zh' ? 'zh-TW' : 'en',
    datePublished: opts.pubDate.toISOString(),
    dateModified: (opts.updatedDate ?? opts.pubDate).toISOString(),
    keywords: opts.tags.join(', '),
    author: personLd,
    publisher: orgLd,
  };
}

export function websiteLd(lang: Lang, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MumbleKey Blog',
    url: SITE_URL,
    description,
    inLanguage: lang === 'zh' ? 'zh-TW' : 'en',
    author: personLd,
    publisher: orgLd,
  };
}
