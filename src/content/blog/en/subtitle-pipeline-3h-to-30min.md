---
title: "From 3 Hours to 30 Minutes: My Automated Chinese Subtitle Pipeline"
description: A subtitle production line running on Apple Silicon — local ASR, on-screen term extraction, LLM correction, and a fail-safe quality gate. This post covers the architecture, the term-learning loop, and three lessons that took it from "it runs" to "it's reliable."
pubDate: 2026-07-06
tags: [asr, automation, claude-code]
discussionTerm: subtitle-pipeline-3h-to-30min
---

I make video subtitles for a finance-education creator. A two-hour video used to take 2-3 hours of manual correction; the same work now takes 15-30 minutes — the pipeline runs on its own and I spot-check the result. This post is how I built that production line, and the three lessons that took it from "it runs" to "it's reliable."

## What the Production Line Looks Like

The whole pipeline is triggered by a single skill inside Claude Code, running six stages in sequence:

```text
Download (yt-dlp)
  → On-screen term extraction (OCR / VLM caption, one frame every 60s)
  → ASR (Breeze ASR 25, local inference on Apple Silicon)
  → Preprocessing (sentence-boundary cleanup, mid-word comma repair)
  → LLM correction (dispatch subagents per segment, inject the glossary + on-screen context)
  → Postprocessing (split overlong captions, quality gate, SRT output)
```

ASR runs locally the whole way; only the correction stage uses a cloud model. The hard part of finance content isn't speech recognition itself — it's the **proper nouns**: ticker symbols, ETFs, indicator abbreviations, the speaker's pet phrases. When ASR mishears a company name or shatters "MA30" into fragments, a general-purpose model can't fix those well. It takes domain knowledge.

## The Glossary Is Alive

The core of the system isn't any single model — it's a **glossary that learns**:

1. After each video is corrected, a term-learning pass runs, turning "ASR mistake → correct term" into mechanical substitution rules
2. The next video's ASR output passes through this batch of rules before it goes into LLM correction
3. On-screen slide text (extracted by OCR) adds the new terms for that episode

I quantified the effect once: processing 8 videos in a row, the first learning round added 16 substitution rules, and the automatic corrections on the same video jumped from 0 to 58. After the second round, the correction volume reported by the LLM correction subagent dropped noticeably — because the cheap mistakes were already being eaten upstream by the mechanical rules.

## Lesson 1: Verify the Values, Not Just the Absence of Errors

Once, a correction subagent "over-merged" 300 captions down to 110, producing overlong captions of 10-29 seconds each. The verification at the time only checked "the file exists and the format is valid," so it let them straight through.

The fix was to change verification to **check the numbers**:

```python
ratio = corrected_count / original_count
if ratio < 0.55:
    fail()          # too few entries left — must be over-merging
if ratio < 0.80 and longest_entry_sec > 15:
    fail()          # entry-ratio plus duration symptom, double confirmation
```

The thresholds aren't guesses — they were calibrated against 88 segments from 10 historical videos (zero false positives). The entry ratio alone isn't enough: passages where the speaker talks in fragments are naturally low-ratio, so you have to pair it with the "longest entry duration" symptom to judge.

## Lesson 2: Always Parse Subagent Output Defensively

An LLM subagent will occasionally write its reasoning into the output ("[reads fine, no change]"), or leak the XML tags of a tool call. Worse, the postprocessing split logic will **amplify a single point of contamination into multiple spread-out ones**.

The fail-safe has three layers: the prompt explicitly lists the forbidden output patterns, a strip before merging, and another strip after postprocessing. The principle is a single sentence: **cleanup must happen before slicing — you can't trust the subagent to police itself**.

## Lesson 3: Resource Conflicts Need Orchestration, Not Prayer

A 32GB M1 Max can't run two large models inferring at the same time. After the 20GB vision model finishes, the framework keeps the model resident in memory for a few minutes — start ASR during that window and you OOM outright. The fix is crude but effective: as soon as the caption stage finishes, explicitly issue `ollama stop`, then start the next stage. Small models (the 1.5GB ASR plus the 5GB auxiliary ASR) can actually run in parallel without worry — at worst they contend for the GPU and slow down, but they won't crash.

## Three Designs Worth Stealing

If you're going to build something similar, the parts I think are most worth stealing:

1. **Keep every intermediate artifact.** Save the output of every stage. Calibrating the quality gate's thresholds, and rebuilding after an incident, both rely on this stash of historical data.
2. **Mechanical rules eat the cheap errors, the LLM eats the hard ones.** Once you layer it this way, the expensive model only handles the parts that genuinely need understanding.
3. **Calibrate the gate on real data.** Compute the fail-safe thresholds from historical output, don't guess them.

This pipeline's skill is already open-sourced, alongside its sister skill (turning a recording into an article that stays faithful to the original words) — both are on my GitHub.
