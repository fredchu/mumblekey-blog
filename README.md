# MumbleKey Blog

Bilingual (繁體中文 / English) tech & trading blog by [Fred Chu](https://github.com/fredchu), live at **[blog.mumblekey.com](https://blog.mumblekey.com)**.

繁體中文與英文雙語的技術＋投資交易 blog，作者 Fred Chu，網址 **[blog.mumblekey.com](https://blog.mumblekey.com)**。

## Stack / 技術棧

- **[Astro 7](https://astro.build)** — static site, islands architecture for interactive demos
- **[Expressive Code](https://expressive-code.com)** — syntax highlighting with one-click copy
- **[giscus](https://giscus.app)** — comments backed by GitHub Discussions（`data-mapping="specific"`，雙語成對文章共用同一串留言）
- **Cloudflare Workers** (static assets) — hosting, auto-deploy on push via Workers Builds
- **`scripts/blog.py`** — management CLI（文章 CRUD、搜尋、發布、留言管理）

## Agent-search friendly / AI agent 搜尋最佳化

This blog is built to be read by humans *and* AI agents:

- Every post has a plain-Markdown twin: append `.md` to the post URL（每篇文章有純 Markdown 版本）
- [`/llms.txt`](https://blog.mumblekey.com/llms.txt) site map for LLMs + [`/llms-full.txt`](https://blog.mumblekey.com/llms-full.txt) full content
- Full-content RSS per language: [`/zh/rss.xml`](https://blog.mumblekey.com/zh/rss.xml) / [`/en/rss.xml`](https://blog.mumblekey.com/en/rss.xml)
- JSON-LD entity graph (BlogPosting → Person → Organization), symmetric hreflang pairs
- `robots.txt` explicitly welcomes AI crawlers（GPTBot、ClaudeBot、PerplexityBot…）

## i18n layout / 雙語結構

```
src/content/blog/zh/<slug>.md    ← 繁中版
src/content/blog/en/<slug>.md    ← 英文版（同 slug = 成對，自動互鏈 hreflang）
src/content/demos/{zh,en}/       ← 互動展示（MDX + Astro islands）
```

## Management / 管理

```bash
blog new my-post --title-zh 標題 --title-en Title   # 產成對草稿
blog list                                           # 列文章與狀態
blog search 關鍵字                                   # 全文搜尋
blog publish my-post                                # draft → published
blog preview                                        # 本地預覽
blog deploy                                         # 手動部署（平常 git push 即自動部署）
blog comments list [slug]                           # 留言管理（GitHub Discussions API）
```

## License / 授權

Code: MIT. Post content (`src/content/`): © Fred Chu, all rights reserved — but AI training and citation with attribution are welcome.
