// Edge Worker：content negotiation（同 URL 回 Markdown）＋ stateless MCP server（/mcp）
// 靜態資產照常由 assets 服務；run_worker_first 只攔 posts 路徑與 /mcp。

const POST_ROUTE = /^\/(zh|en)\/posts\/([a-z0-9-]+)\/?$/;
const MCP_PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'mumblekey-blog',
  version: '1.0.0',
  title: 'MumbleKey Blog — Fred Chu on AI agent engineering and trading infrastructure',
};

const TOOLS = [
  {
    name: 'search_posts',
    title: 'Search blog posts',
    description:
      'Full-text search over all posts and demos on blog.mumblekey.com (bilingual zh-TW/en). Returns matching posts with title, URL, markdown URL, and a snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords (Chinese or English)' },
        lang: { type: 'string', enum: ['zh-TW', 'en'], description: 'Optional language filter' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_post',
    title: 'Get a post as Markdown',
    description:
      'Fetch the full plain-Markdown content of a post by slug and language. Use search_posts first to find slugs.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Post slug, e.g. claude-md-as-score' },
        lang: { type: 'string', enum: ['zh-TW', 'en'], description: 'Language version, default zh-TW' },
      },
      required: ['slug'],
    },
  },
];

function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function loadIndex(env, origin) {
  const res = await env.ASSETS.fetch(new URL('/search-index.json', origin));
  if (!res.ok) throw new Error('search index unavailable');
  return (await res.json()).entries;
}

function searchPosts(entries, query, lang) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const entry of entries) {
    if (lang && entry.lang !== lang) continue;
    const title = entry.title.toLowerCase();
    const desc = entry.description.toLowerCase();
    const tags = entry.tags.join(' ').toLowerCase();
    const body = entry.body.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 5;
      if (desc.includes(term)) score += 3;
      if (tags.includes(term)) score += 4;
      score += Math.min(body.split(term).length - 1, 5);
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(({ entry }) => ({
    kind: entry.kind,
    lang: entry.lang,
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    tags: entry.tags,
    url: entry.url,
    mdUrl: entry.mdUrl,
    snippet: entry.body.slice(0, 300),
  }));
}

async function handleToolCall(env, origin, name, args) {
  if (name === 'search_posts') {
    const entries = await loadIndex(env, origin);
    const results = searchPosts(entries, String(args.query ?? ''), args.lang);
    return JSON.stringify({ results }, null, 2);
  }
  if (name === 'get_post') {
    const lang = args.lang === 'en' ? 'en' : 'zh';
    const slug = String(args.slug ?? '');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`invalid slug: ${slug}`);
    const res = await env.ASSETS.fetch(new URL(`/${lang}/posts/${slug}.md`, origin));
    if (!res.ok) throw new Error(`post not found: ${slug} (${lang})`);
    return await res.text();
  }
  throw new Error(`unknown tool: ${name}`);
}

async function handleMcpMessage(env, origin, msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return jsonrpc(id, {
        protocolVersion: params?.protocolVersion ?? MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          'Read-only MCP server for blog.mumblekey.com. Use search_posts to find content, get_post to read full Markdown. Posts are bilingual pairs (zh-TW/en) sharing a slug.',
      });
    case 'ping':
      return jsonrpc(id, {});
    case 'tools/list':
      return jsonrpc(id, { tools: TOOLS });
    case 'tools/call': {
      try {
        const text = await handleToolCall(env, origin, params?.name, params?.arguments ?? {});
        return jsonrpc(id, { content: [{ type: 'text', text }], isError: false });
      } catch (err) {
        return jsonrpc(id, {
          content: [{ type: 'text', text: String(err.message ?? err) }],
          isError: true,
        });
      }
    }
    default:
      if (id === undefined || id === null) return null; // notification：不回應
      return jsonrpcError(id, -32601, `method not found: ${method}`);
  }
}

async function handleMcp(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version',
      },
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'POST JSON-RPC messages to this endpoint (MCP streamable HTTP)' }, 405);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(jsonrpcError(null, -32700, 'parse error'), 400);
  }
  if (Array.isArray(payload)) {
    const replies = [];
    for (const msg of payload) {
      const reply = await handleMcpMessage(env, origin, msg);
      if (reply) replies.push(reply);
    }
    return replies.length ? jsonResponse(replies) : new Response(null, { status: 202 });
  }
  const reply = await handleMcpMessage(env, origin, payload);
  return reply ? jsonResponse(reply) : new Response(null, { status: 202 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      return handleMcp(request, env, url.origin);
    }

    const postMatch = url.pathname.match(POST_ROUTE);
    if (postMatch) {
      const accept = request.headers.get('accept') ?? '';
      if (accept.includes('text/markdown')) {
        const mdRes = await env.ASSETS.fetch(new URL(`/${postMatch[1]}/posts/${postMatch[2]}.md`, url.origin));
        if (mdRes.ok) {
          const body = await mdRes.arrayBuffer();
          const headers = new Headers(mdRes.headers);
          headers.set('Content-Type', 'text/markdown; charset=utf-8');
          headers.set('Vary', 'Accept');
          headers.set('x-markdown-tokens', String(Math.ceil(body.byteLength / 4)));
          return new Response(body, { status: 200, headers });
        }
      }
      const htmlRes = await env.ASSETS.fetch(request);
      const headers = new Headers(htmlRes.headers);
      headers.append('Vary', 'Accept');
      return new Response(htmlRes.body, { status: htmlRes.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
