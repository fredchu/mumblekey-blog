import type { Lang } from './lib/i18n';

export const SITE_URL = 'https://blog.mumblekey.com';

export const SITE_TITLE: Record<Lang, string> = {
  zh: 'MumbleKey Blog',
  en: 'MumbleKey Blog',
};

export const SITE_DESC: Record<Lang, string> = {
  zh: 'Fred Chu 的技術與投資交易筆記：AI agent 工程、一人公司自動化、週期倉位框架。',
  en: 'Fred Chu on AI agent engineering, one-person-company automation, and cycle-based trading.',
};

export const AUTHOR = {
  name: 'Fred Chu',
  github: 'https://github.com/fredchu',
  aboutPath: '/en/about/',
};

export const ORG = {
  name: 'MumbleKey',
  url: 'https://mumblekey.com',
};

export const REPO_URL = 'https://github.com/fredchu/mumblekey-blog';

export const GISCUS = {
  repo: 'fredchu/mumblekey-blog',
  repoId: 'R_kgDOTOy-ag',
  category: 'Announcements',
  categoryId: 'DIC_kwDOTOy-as4DAlkk',
};
