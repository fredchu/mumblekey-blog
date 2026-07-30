---
title: "Running a 744B Model on a Laptop, Then Telling the Author Not to Fix That Bug"
description: "colibri claims you can run GLM-5.2, all 744 billion parameters, on about 25GB of RAM. I actually ran it on an M1 Max. Seven seconds per token. Three counterintuitive findings came out of it, and one of them turned my upstream report from \"please fix this bug\" into \"please don't\"."
pubDate: 2026-07-30
tags: [moe, apple-silicon, benchmark, local-llm]
draft: false
discussionTerm: colibri-744b-on-a-laptop
---

A project called colibri just crossed twenty thousand stars, and its opening line is this: with about 25GB of RAM you can run GLM-5.2, a 744-billion-parameter MoE model, on a consumer machine. Pure C, zero dependencies, experts streamed from disk.

My laptop has 32GB. Let's play.

It worked. Seven seconds per token. This post isn't about the slowness, slowness was the expected part. What's interesting is the three counterintuitive things I measured along the way, and how the last one turned my issue to the author from "please fix this bug" into "please don't".

## How it fits at all

The mechanism is worth understanding, because all three findings fall out of it.

Picture a consulting firm with 19456 specialists, each with a folder of about 19MB. The trick with this kind of model is that answering a single token only needs the opinion of 8 of them. In practice it walks 75 floors and asks 8 per floor, so one token pulls around 600 folders. Since you only ever use a handful at a time, you don't need every specialist in the office. Fetch whoever you need from the warehouse next door.

The office is your RAM. The warehouse is that 429GB model file on disk. The manager who assigns the work and can never leave is about 12GB, permanently resident.

That's where it breaks down. The office is 32GB, the manager alone eats 12GB, working space takes more, and there is almost no room left for specialists. So for every token, more than nine out of ten of those 600 folders have to be fetched from the warehouse right now.

That's the whole story. It's slow not because the compute is weak, but because it never stops hauling.

## Confirming it's real

The build is almost comically fast: 5.4 seconds, zero warnings. The Metal kernel tests all pass, error around 1e-6, and the expert top-8 select is bitwise identical between its serial and parallel paths. Tests like that tell you the author knows what he's doing.

429GB downloaded, all 149 files byte-verified. First question:

```text
› What is 2+2?
◆ 2 + 2 = 4

prefill 13 tokens in 74.36s | decode 7 tokens in 58.24s (0.12 tok/s)
expert hit rate 7.6% | RSS 6.29 GB
```

744 billion parameters, on a 32GB laptop, spent two minutes working out that 2+2 is 4.

Then I asked it in Traditional Chinese why MoE models can run on machines with less memory than their parameter count, capped at 128 tokens:

> 要理解這個問題，首先需要釐清一個核心概念：「總參數量」不等於「同時需要載入到記憶體（VRAM）的參數量」。
>
> MoE（Mixture of Experts，混合專家）模型之所以能在記憶體遠小於其總參數量的機器上執行，核心原因在於「稀疏激活」與「動態載入」。

(In English: "To understand this, we first need to clarify a core concept: total parameter count is not the same thing as the number of parameters that must be loaded into memory at once. An MoE model can run on a machine with far less memory than its total parameter count for two main reasons: sparse activation, and loading on demand." I left the original in place because the point of quoting it is that the quantized container still writes clean Traditional Chinese, which a translation would hide.)

Twenty minutes, then cut off at the 128-token cap. The Chinese is good: correct terminology, and it laid out its own headings. This container is a quantized build (weight precision lowered to shrink the file) and its Chinese survived intact.

While I was there I measured the hauling. Diffing `iostat` before and after, those twenty minutes actually read 1621GB off the disk. Working it out from the counters instead, 654.9 experts per token times 18.9MB times 128 tokens, predicts 1585GB. A 2% match.

So "12GB of experts fetched from disk per token" is not a figure of speech. It's literal. Roughly three Blu-ray movies per token.

## Surprise one: GPU acceleration does nothing here

The author ships a Metal backend that puts the expert matmuls on the GPU. On his own 128GB M4 Max it's worth about 40%.

On this machine it's worth 1.2%.

The profile says why:

```text
METAL: GPU blocks 67 | CPU fallback 0 | experts on GPU 411 | gpu-wall 0.98s
```

The generation issues 19456 expert computations. The GPU handled 411 of them, 2%. It was busy for 0.98 seconds out of a 225-second decode.

Back to the office analogy. The Metal path batches the specialists who are already resident in the office, zero-copy straight out of the RAM slabs. Residency here is 8%. The other nine tenths arrive from the warehouse and get computed on the CPU as they land, so there is essentially nothing for the GPU to accelerate.

The counterintuitive part: to make the GPU pay off, what you need is more memory, not a faster GPU. The 128GB M4 Max gets its 40% because its office is big enough to hold specialists. The M5 Max in the docs reaches 2.06 tok/s off a 46.9GB learned pin, same reason. Metal's benefit scales with expert residency, not with GPU throughput.

## Surprise two: the tool's own advice is wrong

There's a `doctor` command that self-checks and emits tuning hints. On this machine it recommends turning speculative decoding off:

```text
auto-tune:
  DRAFT=0    low hit rate: MTP widens expert union, adds disk reads
```

Speculative decoding here works like this: the model ships a small helper that drafts the next token, then the real model verifies two tokens in one forward pass. When the draft is right, you saved a pass. `doctor` reasons that the helper widens the set of folders each token needs, which is a bad trade on a machine whose hit rate is this low.

The first half is correct. Drafting does pull 4.6% more folders per token, 608 versus 581. But following the advice:

```text
                    decode     tokens per forward   acceptance
drafting on         224.92s          2.00              100%
DRAFT=0             262.26s          1.03               --
```

17% slower.

What it missed is the acceptance rate. Pulling 4.6% more folders to get two tokens per forward pass, at 100% acceptance (86% on a longer generation), is clearly worth it. The heuristic looks at hit rate alone and never checks what the drafts actually do.

The author already wrote the right thing in the README: whether speculation is a net win depends on cache warmth, so measure it. He was right. `doctor` just didn't keep up.

## Surprise three: do not fix this bug

This is the good one.

Reading the source, I found an OpenMP tuning block whose job is to keep the worker threads hot instead of letting them sleep. The comment is clear about why: to hold the team warm across the tiny per-expert matmul regions.

The catch is that this tuning only takes effect via a self re-exec, because libgomp reads the environment in its constructor, before `main()`. The comment says so itself: "setenv-in-main is ignored by the already-initialised runtime". And that `execv` has exactly two branches:

```c
#ifdef __linux__
    ... execv("/proc/self/exe", argv);
#endif
#ifdef __FreeBSD__
    ... execv("/proc/curproc/file", argv);
#endif
```

No macOS. It looks like an obvious gap. Add `_NSGetExecutablePath()`, five lines, done.

I didn't conclude that, though. macOS uses LLVM libomp, which initializes lazily at the first parallel region, well after `main()` has run, so in principle the `setenv` calls might be picked up without any re-exec at all. Those two possibilities can only be separated by experiment, not by reading code.

So: A is the shipped behavior, B is me exporting the same four variables before launch. If the in-process `setenv` works, the two are identical.

```text
                                    r1         r2       median     vs A
A  as shipped (10 threads)        218.55s   219.39s   218.97s       --
B  same tuning exported           481.20s   490.72s   485.96s     +122%
C  OMP_NUM_THREADS=8              209.57s   210.01s   209.79s      -4.2%
D  8 threads + tuning             233.00s   234.51s   233.76s      +6.8%
```

Turning it on is 2.2x slower.

And A not equalling B is itself the answer: the in-process `setenv` really isn't reaching the OpenMP runtime. The gap is real. It is also, right now, protecting macOS users.

Across all eight runs expert hit rate stayed between 9.9% and 10.1%, so cache state isn't the variable, and same-config repeats differ by under 2%. These gaps are far outside noise.

Isolating one variable at a time points at the culprits precisely:

```text
(nothing set)                      218.97s      --
OMP_WAIT_POLICY=active             485.76s    +122%
KMP_BLOCKTIME=200                  471.40s    +115%
OMP_DYNAMIC=FALSE                  220.78s     +0.8%  (noise)
GOMP_SPINCOUNT=200000              217.39s     -0.7%  (noise; libomp ignores GOMP_*)
```

Either spin-wait knob alone reproduces the entire regression. The other two are inert.

The mechanism holds up. "Keeping the team hot" means letting compute threads spin instead of sleeping. But the critical work on this machine is done by the 8 async I/O threads hauling folders, and they need cores too. Fill all 10 cores with spinning compute threads and the haulers have nowhere to run, so the hauling stalls and everything gets slower.

Rows C and D pin the mechanism down: the same tuning costs 122% at 10 threads and only 6.8% at 8. Leave two cores for the haulers and a catastrophe becomes a rounding error.

Row C is also a free 4.2% on its own. This chip has 8 performance cores plus 2 efficiency cores, and `plan` can't detect that on macOS (it only knows how to ask `lscpu`, which always fails here), so it falls back to using all 10. But this workload barriers per expert, and the slowest thread paces the team. The fun part: adding a "physical cores" probe wouldn't fix it either, because `hw.physicalcpu` also returns 10 on this chip. The number you want is `hw.perflevel0.logicalcpu`, which returns 8.

So what I sent upstream isn't "please add the macOS branch". It's the opposite: please don't close this gap casually, because measured, it costs low-residency Apple Silicon hosts more than 2x, unless it's gated first.

## One validation worth recording

I ran the same prompt under seven configurations, including CPU-only, Metal, and speculation disabled. All seven produced byte-identical text.

That matters. The author's central claim is that placement, whether a specialist sits in the office or the warehouse, changes speed only, never routing decisions or weight precision. That's a promise which is very easy to quietly break while optimizing, and it holds. Together with the 1e-6 Metal kernel agreement and the bitwise-identical expert select, this is a project built honestly.

## What I took away

The thing that looks most obviously broken may be the thing protecting you. I nearly shipped "macOS is missing a branch" as-is. Five-line fix, clear mechanism, the code comment itself backing me up. What stopped it was one question: what happens if it does take effect? Two hours of A/B later, the answer was 2.2x slower.

On a low-residency host, an accelerator can't accelerate what isn't there. That 0.98 seconds of GPU time is the cheapest lesson in this post. Ask which layer the bottleneck is on before buying hardware. This machine is short on memory, not GPU.

Advice from a self-check tool is still a heuristic, and heuristics expire. `doctor`'s `DRAFT=0` had a correct premise and the opposite conclusion, because it was one metric short. What a tool measures and what a tool recommends do not deserve the same trust.

I'm keeping the 400GB model file. Seven seconds per token is unusable day to day, but 744 billion parameters answering correctly on a laptop is worth pulling out to look at once in a while.

Both reports are filed: [#706](https://github.com/JustVugg/colibri/issues/706) is the full measurement for this hardware class, which nobody had covered before, and [#707](https://github.com/JustVugg/colibri/issues/707) is the "please don't fix it".

After filing, I found out CONTRIBUTING.md is 37 lines long and I had read the first 30. The two lines I skipped are the ones specifying what a benchmark report must include, median throughput among them. I added a follow-up comment. So the real last lesson here is that RTFM covers all 37 lines, not just the ones that fit on screen.
