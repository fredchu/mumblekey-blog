export const LOCALES = ['zh', 'en'] as const;
export type Lang = (typeof LOCALES)[number];

export const HREFLANG: Record<Lang, string> = { zh: 'zh-tw', en: 'en' };
export const OG_LOCALE: Record<Lang, string> = { zh: 'zh_TW', en: 'en_US' };
export const HTML_LANG: Record<Lang, string> = { zh: 'zh-Hant-TW', en: 'en' };
export const X_DEFAULT: Lang = 'en';

export function isLang(value: string): value is Lang {
  return (LOCALES as readonly string[]).includes(value);
}

// content collection entry id 形如 "zh/my-post"，取語言與 slug
export function langFromId(id: string): Lang {
  const head = id.split('/')[0];
  if (!isLang(head)) throw new Error(`content id 缺少語言前綴: ${id}`);
  return head;
}

export function slugFromId(id: string): string {
  return id.split('/').slice(1).join('/');
}

export function otherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}

const strings = {
  zh: {
    'nav.posts': '文章',
    'nav.demos': '展示',
    'nav.about': '關於',
    'home.latest': '最新文章',
    'home.demos': '互動展示',
    'home.viewAll': '全部文章',
    'home.viewAllDemos': '全部展示',
    'post.published': '發布於',
    'post.updated': '更新於',
    'post.tags': '標籤',
    'post.markdown': 'Markdown 原文',
    'post.comments': '留言',
    'post.pair': 'Read in English',
    'post.bilingual': '中英對照閱讀',
    'post.newer': '較新一篇',
    'post.older': '較舊一篇',
    'post.related': '相關文章',
    'demos.source': '原始碼',
    'demos.embedNote': '此展示元件也可嵌入文章。',
    'tags.title': '標籤',
    'tags.taggedWith': '含標籤',
    'footer.rss': 'RSS',
    'footer.builtWith': '以 Astro 建置，源碼公開於',
    'disclaimer.trading':
      '本文為個人筆記與經驗分享，非投資建議。交易有風險，請自行研究並承擔決策責任。',
    'a11y.themeToggle': '切換深淺色主題',
    'a11y.langSwitch': '切換語言',
  },
  en: {
    'nav.posts': 'Posts',
    'nav.demos': 'Demos',
    'nav.about': 'About',
    'home.latest': 'Latest posts',
    'home.demos': 'Interactive demos',
    'home.viewAll': 'All posts',
    'home.viewAllDemos': 'All demos',
    'post.published': 'Published',
    'post.updated': 'Updated',
    'post.tags': 'Tags',
    'post.markdown': 'View as Markdown',
    'post.comments': 'Comments',
    'post.pair': '閱讀繁體中文版',
    'post.bilingual': 'Bilingual view',
    'post.newer': 'Newer post',
    'post.older': 'Older post',
    'post.related': 'Related posts',
    'demos.source': 'Source code',
    'demos.embedNote': 'This demo component can also be embedded in posts.',
    'tags.title': 'Tags',
    'tags.taggedWith': 'Tagged with',
    'footer.rss': 'RSS',
    'footer.builtWith': 'Built with Astro. Source on',
    'disclaimer.trading':
      'These are personal notes, not investment advice. Trading involves risk; do your own research.',
    'a11y.themeToggle': 'Toggle color theme',
    'a11y.langSwitch': 'Switch language',
  },
} as const;

export type UiKey = keyof (typeof strings)['zh'];

export function t(lang: Lang, key: UiKey): string {
  return strings[lang][key];
}
