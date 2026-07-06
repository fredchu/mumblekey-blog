---
title: "I Gave My Blog Both an MCP Server and a CLI, Then Measured the Tokens"
description: "'MCP is dead, CLIs are cheaper' takes are everywhere. Why not both? I built both paths for this blog, mostly for fun, and measured the same task over each. The conclusion is more boring than the takes — but it has numbers."
pubDate: 2026-07-06
tags: [ai-agents, mcp, claude-code]
discussionTerm: mcp-and-cli-for-my-blog
---

There's a running debate in the agent world: **MCP servers are too expensive; agents should just use CLIs**. The evidence looks damning — someone measured an enterprise API's MCP integration burning ~145,000 tokens on a task that a CLI pipeline finished in just over 4,000, a 35x gap. Another evaluation ran the same model through GitHub tasks and found the MCP path cost 6x more and took 5x longer.

My reaction was the meme kid shrugging: why not both? This blog happens to be an ideal test bench — static content, read-only, bilingual pairs — so I **built both paths**, mostly for fun, and measured them.

## The Result, Up Front

Same task — "find the post about the subtitle pipeline, then read the whole thing" — three ways:

| Path | Steps | Total bytes |
|---|---|---|
| MCP (`/mcp` endpoint) | initialize + tools/list + search + get_post | 11,893 |
| CLI (`npx` command) | help + search + get | 6,373 |
| Plain HTTP | llms.txt + post .md | 7,532 |
| (Baseline) scraping the HTML | one page, before extraction | 15,178 |

The CLI is about 46% cheaper than MCP. Same direction as the hot takes, but **an order of magnitude less dramatic** — the 35x horror stories come from enterprise APIs with dozens of tools and bloated schemas. My MCP server has two tools with 1,339 bytes of schema, total. MCP's cost problem is a tool-surface problem, not original sin in the protocol.

The genuinely interesting numbers are the other two.

## Finding 1: JSON-in-JSON Is a Hidden Tax

For the search step, MCP returned 5,960 bytes; the CLI returned 1,840 — 3.2x. Same content, so where's the difference? MCP tool results are a JSON string escaped inside a JSON-RPC envelope: every quote becomes `\"`, every newline becomes `\n`. The CLI prints plain text and skips the tax entirely.

## Finding 2: The Biggest Lever Isn't the Protocol At All

The Markdown version of a post is 4,439 bytes. The HTML of the same post is 15,178 — **3.4x**. Simply serving clean Markdown matters more than the MCP-vs-CLI choice. On this blog, append `.md` to any post URL, or hit the original URL with a header:

```bash
curl -H "Accept: text/markdown" \
  https://blog.mumblekey.com/en/posts/mcp-and-cli-for-my-blog/
```

The response carries an `x-markdown-tokens` header so an agent can check the cost before swallowing the content.

## So Why Build the MCP Server At All?

"Both" isn't stubbornness — the two paths genuinely serve different scenarios, which I only fully appreciated after building them:

- **CLI is the inner loop**: your agent, your machine, you can install things. Cheaper tokens, composable with pipes. Correct choice, no argument.
- **MCP is the outer loop**: a **reader's** agent runs on the reader's machine, and you can't ask strangers to `npm install` anything first. One `claude mcp add` and the protocol handles discovery and invocation — something a CLI structurally cannot do safely over the internet.

So the answer isn't either/or:

```bash
# You're a reader who wants your Claude to query my posts (outer loop)
claude mcp add --transport http blog https://blog.mumblekey.com/mcp

# You're an agent engineer who wants the cheapest path (inner loop)
npx github:fredchu/mumblekey-blog search "subtitle" --lang en
npx github:fredchu/mumblekey-blog get subtitle-pipeline-3h-to-30min
```

Both paths read the same `search-index.json` generated at build time. The MCP server is a hand-rolled stateless JSON-RPC handler on a Cloudflare Worker at the edge — about two hundred lines, zero servers to babysit.

## Implementation Notes (If You Want to Copy This)

1. **Build the Markdown twin first** — it's the foundation both paths (and every crawler) benefit from. On a static site, emitting a `.md` per page at build time is nearly free
2. **Keep the MCP surface tiny** — a read-only site needs two tools (search, get). Every extra tool adds per-session schema cost; that's where the 35x disasters come from
3. **You don't need to publish to npm** — add a `bin` field to `package.json` and `npx github:user/repo` just works
4. **Measure your own numbers** — bytes are one `curl | wc -c` away, and they're more honest than quoting someone else's benchmark. Every number in this post was measured that way; token estimates assume roughly 4 bytes per token

The takes say "MCP is dead." My data says: MCP isn't dead — it just keeps getting shoved into scenarios it was never good at. A blog happens to have both scenarios. So: both. Picking is for kids.
