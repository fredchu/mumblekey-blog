---
title: CLAUDE.md 是樂譜：一人公司的 AI 指揮家模式
description: 我沒有請員工，也沒有訂閱一堆 SaaS。我把工作重組成一套 AI agent 系統：兩台 Mac、一份會長大的規則檔、四個各司其職的 agent 角色。這篇講架構跟踩過的坑。
pubDate: 2026-07-06
tags: [ai-agents, claude-code, one-person-company]
discussionTerm: claude-md-as-score
---

Reid Hoffman 在一次訪談裡說：

> "I'm more of a conductor than I am a violin player or a piano player."

這句話我聽進去了。大部分人說「我有在用 AI」，意思是拿 AI 加速某個步驟——翻譯快一點、code 補全快一點。真正的分水嶺不在這裡，而在**把工作本身重組成 AI 可以接手的結構**。這篇文章講我怎麼做，以及一年下來系統長成什麼樣子。

## 兩台機器，兩種角色

我的系統跑在兩台 Mac 上：

- **MacBook Pro（M1 Max）**：互動主力。我在這裡跟 Claude Code 對話、開發、做決策。
- **Mac mini（M1, 8GB）**：無人值守。跑排程任務——每週一早上抓流動性指標、每天掃排程健康狀態、盤前更新期貨點位，異常直接推 Discord 通知我。

兩台機器各有一個 Claude Code agent（我叫它們 Pro CC 和 Mini CC），透過共用的 handoff 筆記交接工作狀態。我睡覺的時候，Mini CC 在工作；我坐到桌前，Pro CC 從 handoff 摘要接手上一場的進度。

## CLAUDE.md 是樂譜

指揮家不拉小提琴，但譜架上有總譜。我的總譜是一份叫 `CLAUDE.md` 的 Markdown 檔——每次會話自動載入，定義這個 agent 能做什麼、曾經在哪裡跌倒、怎麼避免再跌一次。

重點不是寫規則，是**讓規則會長大**。每次踩坑，教訓就寫回系統：

```markdown
## F-0. Git 操作紀律（hard rule，pack 吞噬事故後新增）

- 禁止 `git add -A`、`git add .` — 一律明確 pathspec
- 原因：雲端同步工具會把 .git/objects/pack/*.pack hardlink
  進 worktree，全量 add 會吞 pack 造成 repo 指數膨脹
  （本 repo 曾脹到 2.0TB）
```

這條規則來自一次真實事故：雲端同步工具跟 git 打架，repo 膨脹到 2TB。修復之後，教訓變成一條 hard rule，從此每個 agent 會話都不會再犯。用得愈久，系統愈懂我——這比任何模型升級都值錢。

## 記憶分三層

單一大檔案會爆 token，所以記憶按重用性分層：

1. **情節記憶**：帶日期的會話紀錄，追查「那天發生什麼」用
2. **語義記憶**：跨會話可重用的知識，按主題整理
3. **強制規則**：不管什麼情境都必須遵守的約束

情節記憶累積到一定程度，蒸餾成語義記憶；語義記憶再往上凝結成 wiki 文章。加上懶加載（會話啟動只讀核心身份檔，其他模組按需載入），token 消耗比單一大檔少了七成。

## 四個角色，各有邊界

開發 iPhone 鍵盤 app 的時候，我把 agent 拆成四個角色：PM 分析需求寫 spec、Designer 出設計稿、Engineer 實作、QA 審查把關。關鍵是**邊界用制度鎖死**：PM 不碰程式碼，Engineer 才能 commit，QA 擋 release。

這不是角色扮演遊戲。邊界存在的理由跟人類團隊一樣：寫 code 的人不該自己驗收自己的 code。我的驗證紀律裡有一條鐵律——「驗證不自驗」，實作者的產出必須由另一個獨立 agent 或我本人用真實輸入跑過才算數。

## 這套系統實際產出什麼

- **商業產出**：客戶的影片字幕，從每支 2-3 小時人工校正壓到 15-30 分鐘自動化（這條 pipeline 值得單獨一篇，[已經寫了](/zh/posts/subtitle-pipeline-3h-to-30min/)）
- **日常生產力**：行事曆、提醒事項、email 摘要、每日規劃，全部是 Claude Code 黏著原生 Apple app，零 SaaS 訂閱
- **投資基礎設施**：券商 API 串接、持倉異常掃描、選擇權籌碼快照，跑在排程上

沒請員工，沒買 SaaS。系統的邊際成本是每月的 Claude 訂閱費。

## 如果你想開始

不用一次建完。我的建議順序：

1. 先寫一份最小的 `CLAUDE.md`：你是誰、專案在哪、有什麼絕對不能做
2. 每次 AI 犯錯，把教訓寫回去（這一步是複利的來源）
3. 檔案變大之後再拆層：規則、記憶、wiki
4. 最後才是多機、多角色

Hoffman 那段訪談還有一句："Even most people who say 'Oh yeah I'm using AI' are not using it seriously enough." 認真用的意思，不是 prompt 寫得多漂亮，是願意把工作結構打掉重組。
