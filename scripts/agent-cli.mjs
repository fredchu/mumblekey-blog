#!/usr/bin/env node
// 給本地 AI agent 用的唯讀 CLI（inner-loop 路徑，比 MCP 省 token）
// 用法：npx github:fredchu/mumblekey-blog <command>
//   search <query> [--lang zh-TW|en]   全文搜尋
//   get <slug> [--lang zh-TW|en]       抓整篇 Markdown
//   list [--lang zh-TW|en]             列出全部文章

const SITE = 'https://blog.mumblekey.com';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') args.lang = argv[++i];
    else args._.push(argv[i]);
  }
  return args;
}

async function loadIndex() {
  const res = await fetch(`${SITE}/search-index.json`);
  if (!res.ok) throw new Error(`index fetch failed: ${res.status}`);
  return (await res.json()).entries;
}

function search(entries, query, lang) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const entry of entries) {
    if (lang && entry.lang !== lang) continue;
    let score = 0;
    for (const term of terms) {
      if (entry.title.toLowerCase().includes(term)) score += 5;
      if (entry.description.toLowerCase().includes(term)) score += 3;
      if (entry.tags.join(' ').toLowerCase().includes(term)) score += 4;
      score += Math.min(entry.body.toLowerCase().split(term).length - 1, 5);
    }
    if (score > 0) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

try {
  if (command === 'search' && args._[1]) {
    const entries = await loadIndex();
    const hits = search(entries, args._.slice(1).join(' '), args.lang);
    if (!hits.length) console.log('no results');
    for (const { entry } of hits) {
      console.log(`${entry.title}\n  ${entry.url}${entry.mdUrl ? `\n  md: ${entry.mdUrl}` : ''}\n  ${entry.description}\n`);
    }
  } else if (command === 'get' && args._[1]) {
    const lang = args.lang === 'en' ? 'en' : 'zh';
    const res = await fetch(`${SITE}/${lang}/posts/${args._[1]}.md`);
    if (!res.ok) throw new Error(`post not found: ${args._[1]} (${lang})`);
    console.log(await res.text());
  } else if (command === 'list') {
    const entries = await loadIndex();
    for (const entry of entries) {
      if (args.lang && entry.lang !== args.lang) continue;
      console.log(`${entry.pubDate}\t[${entry.lang}]\t${entry.slug}\t${entry.title}`);
    }
  } else {
    console.log('usage: mumblekey-blog search <query> [--lang zh-TW|en] | get <slug> [--lang] | list [--lang]');
    process.exit(command ? 1 : 0);
  }
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
