---
title: 我幫部落格同時做了 MCP 和 CLI，然後量了 token
description: 「MCP 已死 CLI 省 token」吵翻天。不是啊，小孩子才做選擇，大人我全都要——部落格兩個都做，玩玩看實測。結論比戰文無聊，但有數字。
pubDate: 2026-07-06
tags: [ai-agents, mcp, claude-code]
discussionTerm: mcp-and-cli-for-my-blog
---

最近 agent 圈有一場辯論：**MCP server 太貴了，agent 用 CLI 就好**。證據看起來很嚇人——有人量到某企業 API 的 MCP 服務一個任務燒掉 14.5 萬 tokens，換成 CLI 管線只要 4 千出頭，35 倍差距；另一份評測讓同一個模型跑 GitHub 任務，MCP 路徑成本 6 倍、耗時 5 倍。

看完我的反應是：不是啊，小孩子才做選擇，大人我全都要不就好了嗎？剛好這個部落格是理想的實驗場——內容靜態、唯讀、雙語成對——乾脆**兩條路都做出來**，玩玩看順便量一量。

## 先講結論

同一個任務——「找到講字幕 pipeline 的文章，然後讀完整篇」——三條路的實際傳輸量：

| 路徑 | 步驟 | 總 bytes |
|---|---|---|
| MCP（`/mcp` endpoint） | initialize＋tools/list＋search＋get_post | 11,893 |
| CLI（`npx` 指令） | help＋search＋get | 6,373 |
| 純 HTTP | llms.txt＋文章 .md | 7,532 |
| （對照組）直接抓 HTML | 單頁未抽取 | 15,178 |

CLI 比 MCP 省約 46%。方向跟戰文一致，但**幅度差了一個數量級**——35 倍的慘案來自幾十個工具、schema 肥大的企業 API；我的 MCP 只有兩個工具，schema 總共 1,339 bytes。MCP 的成本問題是「工具面太大」的問題，不是協定本身的原罪。

真正有趣的是另外兩個數字。

## 發現一：JSON-in-JSON 是隱形稅

搜尋這一步，MCP 回 5,960 bytes，CLI 只回 1,840——3.2 倍。內容明明一樣，差在哪？MCP 的工具回傳是「JSON-RPC 信封裡包一層跳脫過的 JSON 字串」，每個引號都變成 `\"`，每個換行都變成 `\n`。CLI 直接印純文字，沒有這層稅。

## 發現二：最大的槓桿根本不是協定

文章的 Markdown 版本 4,439 bytes，同一篇的 HTML 是 15,178——**3.4 倍**。也就是說，「提供乾淨的 Markdown」這一件事，比「選 MCP 還是 CLI」影響大得多。這個部落格每篇文章的網址加上 `.md` 就是純 Markdown，或者直接對原網址帶 header：

```bash
curl -H "Accept: text/markdown" \
  https://blog.mumblekey.com/zh/posts/mcp-and-cli-for-my-blog/
```

回應會附一個 `x-markdown-tokens` header 告訴你這篇大概多少 tokens，agent 可以先看成本再決定要不要吞。

## 那為什麼還要做 MCP？

全都要不是賭氣，是兩條路服務的場景真的不同——這點做完才真正體會：

- **CLI 是 inner loop**：你自己的 agent、你自己的機器、你裝得了東西。省 token、可以用 pipe 組合，怎麼看都是對的。
- **MCP 是 outer loop**：**讀者**的 agent 在讀者的機器上，你不能要求人家先 `npm install` 什麼。一行 `claude mcp add` 接上，協定處理好發現與呼叫，這是 CLI 結構上做不到的。

所以答案不是二選一：

```bash
# 你是讀者，想讓你的 Claude 查我的文章（outer loop）
claude mcp add --transport http blog https://blog.mumblekey.com/mcp

# 你是 agent 工程師，想要最省的路（inner loop）
npx github:fredchu/mumblekey-blog search "subtitle" --lang en
npx github:fredchu/mumblekey-blog get subtitle-pipeline-3h-to-30min
```

兩條路吃同一份 build 時產生的 `search-index.json`，MCP server 是手刻的 stateless JSON-RPC，跑在 Cloudflare Worker 邊緣，總共兩百多行、零常駐伺服器。

## 實作備忘（想抄的人看這段）

1. **Markdown twin 先做**——這是地基，兩條路（和所有爬蟲）都受益。靜態站在 build 時多產一份 `.md` 幾乎零成本
2. **MCP 保持極簡**——唯讀站兩個工具就夠（search、get）。工具愈多，每個 session 的 schema 固定成本愈高，那才是 35 倍慘案的來源
3. **CLI 不用發 npm**——`package.json` 加個 `bin`，`npx github:user/repo` 直接跑
4. **量測自己的數字**——bytes 用 `curl | wc -c` 就量得到，比轉述別人的 benchmark 誠實。本文所有數字都是這樣來的，token 換算按每 4 bytes 約 1 token 粗估

戰文說「MCP 已死」。我的數據說：MCP 沒死，它只是常被塞進不擅長的場景。部落格這種東西剛好兩個場景都有——那就都要，小孩子才做選擇。
