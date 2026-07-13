---
title: Nobody performs for a coding agent, so I let one read six months of my logs
description: "6 months, 7580 prompts, 'verify' typed 438 times, the same correction repeated 5 times. A friend sent me a prompt from Twitter; I ran it on my own session logs, got one line that stopped me cold, and open-sourced it as a skill the same day."
pubDate: 2026-07-13
tags: [ai-agents, claude-code, session-mirror, open-source]
draft: false
discussionTerm: session-mirror
---

A friend sent me a prompt he found on Twitter. It opens like this:

> People lie in journals. They perform in therapy. Nobody performs for a coding agent.

Which is true. When I'm telling an agent to fix something at 11pm I am not curating an image. Nobody types "please" on the third retry. So the prompt's claim: the session logs sitting on your machine are the closest thing to an honest autobiography you will ever produce. It lays out six phases to excavate that record and tell you who you actually are.

Sounded like fortune-cookie territory. I ran it anyway.

## The numbers first

I pointed Claude at my own history: six months, 7580 prompts. Some numbers it dug up:

- "verify" (驗) appears 438 times, my single most-typed verb
- "bye" typed 50 times, "handoff" 49 times, my end-of-session ritual
- "are you stuck?" asked 10 times
- the same subtitle formatting correction, repeated 5 times
- /usage checked 783 times

Some of these are funny. Some of them shut me up. Repeating the same correction 5 times means my lessons-learned system has a hole in it. Checking quota 783 times means I constantly worry whether the machine has enough left, and never once measured whether I do.

## Then it started asking questions

One at a time, no conclusions, and when my answer contradicted the record it produced the receipt. At the end it held up a mirror, and one line in it stopped me cold:

> You built a fortress that only takes things in, and left "getting out" to luck.

Its evidence: I have automated radars for GitHub trends, market data, cron health. All of them point inward, feeding my own system. Sensors pointing outward, at readers, at users, at anyone who might hire me: zero. Every opportunity I got in six months arrived by accident.

That's not a horoscope. Every word carries a timestamp from my own logs. The prompt said it upfront: advice you can ignore, but a true pattern with your own timestamps on it, you cannot.

## Same day, skillified and open-sourced

Still a bit stunned, I turned the prompt into a skill that same day:

https://github.com/fredchu/session-mirror

Honest credits on how it was built: I supplied opinions, Claude ran the show, Codex did the implementation plus four review rounds, looping until only nitpicks remained. The counting lives in plain Python scripts (zero dependencies), because the same input should produce the same numbers and that is not a job for a language model's creativity. The judgment stays with the model, but the gates are hard-coded: it must show you its mining plan and read nothing until you approve; every output passes secret redaction; config changes ship as diffs you approve one by one.

Privacy, stated bluntly: the scripts are local-only, no network, guaranteed. The model is not. Whatever the agent reads enters model context, and on a hosted model that content reaches your provider. This disclosure is hard-coded into the first gate. Run a local model if you want the whole thing on-machine.

## Attribution

The six-phase concept comes from that unknown Twitter author. I genuinely tried to find them and failed. The three sentences at the top are the only verbatim quote in the repo. If you wrote it, or know who did, please open an issue. I'd love to credit you properly, however you prefer. Thank you for writing it.

Once installed, tell your agent "mirror me" and it runs.

As for me, the mirror came with a 30-day roadmap. Item one: build a radar for the world that might hire me. A fortress could use a few windows.
