---
title: "CLAUDE.md Is a Score: Running a One-Person Company as an AI Conductor"
description: "I don't have employees, and I don't pay for a pile of SaaS. I restructured my work into a system of AI agents: two Macs, one rule file that keeps growing, and four agent roles that each stay in their lane. Here's the architecture and the traps I hit."
pubDate: 2026-07-06
tags: [ai-agents, claude-code, one-person-company]
discussionTerm: claude-md-as-score
---

In an interview, Reid Hoffman said:

> "I'm more of a conductor than I am a violin player or a piano player."

That line stuck with me. When most people say "I'm using AI," they mean they're using it to speed up a step: translate a bit faster, autocomplete code a bit faster. That's not where the real dividing line is. The line is whether you **restructure the work itself into something an AI can take over**. This post is how I do that, and what the system has grown into after a year.

## Two Machines, Two Roles

My system runs on two Macs:

- **MacBook Pro (M1 Max)**: the interactive workhorse. This is where I talk to Claude Code, build things, and make decisions.
- **Mac mini (M1, 8GB)**: unattended. It runs scheduled jobs — pulling liquidity indicators every Monday morning, sweeping the health of my cron jobs daily, updating futures price levels before the open, and pushing anything anomalous straight to Discord.

Each machine has its own Claude Code agent (I call them Pro CC and Mini CC), and they hand off work state through a shared handoff note. While I sleep, Mini CC is working; when I sit down at my desk, Pro CC picks up where the last session left off from the handoff summary.

## CLAUDE.md Is a Score

A conductor doesn't play the violin, but there's a full score on the stand. My score is a Markdown file called `CLAUDE.md` — loaded automatically at the start of every session, defining what this agent can do, where it has tripped before, and how to avoid tripping again.

The point isn't writing rules. The point is **making the rules grow**. Every time I hit a trap, the lesson gets written back into the system:

```markdown
## F-0. Git Discipline (hard rule, added after the pack-swallowing incident)

- Forbidden: `git add -A`, `git add .` — always use an explicit pathspec
- Reason: the cloud-sync tool hardlinks .git/objects/pack/*.pack
  into the worktree, so a blanket add swallows the pack and makes
  the repo balloon exponentially (this repo once hit 2.0TB)
```

This rule came out of a real incident: a cloud-sync tool got into a fight with git, and the repo ballooned to 2TB. After I fixed it, the lesson became a hard rule, and no agent session repeats the mistake. The longer I use it, the better the system understands me — and that's worth more than any model upgrade.

## Memory in Three Layers

A single giant file blows up your token budget, so memory is layered by reusability:

1. **Episodic memory**: dated session logs, for tracing "what happened that day"
2. **Semantic memory**: knowledge reusable across sessions, organized by topic
3. **Hard rules**: constraints that hold no matter the context

Once episodic memory piles up enough, it gets distilled into semantic memory; semantic memory then condenses upward into wiki articles. Add lazy loading (a session only reads the core-identity file at startup, and loads other modules on demand), and token consumption drops about 70% compared to one big file.

## Four Roles, Each With a Boundary

When I was building an iPhone keyboard app, I split the agent into four roles: PM analyzes requirements and writes the spec, Designer produces the mockups, Engineer implements, QA reviews and gatekeeps. The key is that **the boundaries are locked in by policy**: the PM never touches code, only the Engineer can commit, QA blocks the release.

This isn't a role-playing game. The boundaries exist for the same reason they do on a human team: the person who wrote the code shouldn't sign off on their own code. One of the iron laws in my verification discipline is "the author never verifies their own work" — an implementer's output only counts once another independent agent, or I myself, has run it against real input.

## What This System Actually Produces

- **Commercial output**: a client's video subtitles, squeezed from 2-3 hours of manual correction per video down to 15-30 minutes of automation (that pipeline deserves its own post, which [I've already written](/en/posts/subtitle-pipeline-3h-to-30min/))
- **Daily productivity**: calendar, reminders, email summaries, daily planning — all of it Claude Code gluing native Apple apps together, zero SaaS subscriptions
- **Investment infrastructure**: brokerage API integrations, position-anomaly scans, options positioning snapshots, all running on schedule

No employees, no SaaS purchases. The marginal cost of the system is my monthly Claude subscription.

## If You Want to Start

You don't have to build it all at once. The order I'd suggest:

1. Write a minimal `CLAUDE.md` first: who you are, where your projects live, and what must never happen
2. Every time the AI screws up, write the lesson back in (this step is where the compounding comes from)
3. Once the file gets big, split it into layers: rules, memory, wiki
4. Multiple machines and multiple roles come last

There's one more line from that Hoffman interview: "Even most people who say 'Oh yeah I'm using AI' are not using it seriously enough." Using it seriously doesn't mean writing prettier prompts. It means being willing to tear your work down and rebuild its structure.
