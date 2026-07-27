---
title: The Paper Says ARM Support. I Might Be the First to Actually Compile It
description: Microsoft released VibeVoice-ASR-BitNet, a speech recognition model that claims real-time transcription on CPUs, "targeting both ARM and x86". I put that to the test on an M1 Max, and debugged my way from a compile error to a beautiful NaN fingerprint, finding three upstream bugs along the way. A story about how to read model cards.
pubDate: 2026-07-27
tags: [asr, bitnet, debugging, apple-silicon]
draft: false
discussionTerm: vibevoice-bitnet-arm-debug
---

Microsoft dropped something tempting last week: VibeVoice-ASR-BitNet, a speech recognition model that claims real-time transcription with just 3 CPU threads, no GPU, 1.6 to 2.3x faster than Whisper.cpp. The paper says, in plain print, that its custom SIMD kernels are "targeting both ARM and x86 platforms".

My M1 Max is ARM. Let's find out.

That little experiment made me, quite possibly, the first person on Earth to compile this project on ARM. Not a badge of honor. The compiler told me so.

## What the model is trying to do

First, why it's worth testing at all. Speech recognition currently lives in two worlds: small models run on CPUs but are bare-bones, while LLM-based recognizers (long-form audio, speaker separation, custom vocabulary hints) are powerful but chained to GPUs. This model tries to squeeze the second kind into the first kind's hardware.

The approach is compression that matches the diagnosis. The team profiled the two pipeline stages and found opposite bottlenecks: the audio encoder is bound by data movement, with activations outweighing weights 16 to 1, so it gets gentle 8-bit quantization plus operator fusion to save memory round-trips. The language model is bound by weight size, reading all 1.5B parameters for every single token, so it gets the strong medicine: every weight becomes -1, 0, or +1, an 8x compression. That's BitNet, and the authors are the same Microsoft team that started the 1-bit LLM line.

One tip for reading model cards: the pretty number in the left column of the WER table belongs to the full 7B system. This checkpoint swaps the 7B brain for a 1.5B one and then compresses it, and its own numbers sit in the right column, where Chinese meeting audio drops from 19.83 to 27.45. Vendors always put the biggest system in the most visible spot. The row for the checkpoint you're actually downloading is yours to find.

## Round one: it doesn't compile

```text
ggml-aarch64.c:1156:31: error: use of undeclared identifier 'VAE_ROW_BLOCK_SIZE'
```

Digging in: these macros are only defined inside x86 preprocessor branches. The fun part is that the language-model side has an ARM branch in its config header. The audio-encoder side just doesn't.

This kind of error doesn't lie. Code can claim to support any platform it wants; the compiler keeps the receipts. Nobody had ever hit build on ARM in this repo.

Added the missing macros. Next.

## Round two: exclamation marks, forever

It compiles. I feed it 30 seconds of audio. The model outputs:

```text
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

And keeps going. Twenty minutes in, still going.

Digging down with Claude Code, I put checkpoints on the audio encoder's output and found something that fails the smell test instantly: the acoustic and semantic encoders, two networks with completely different weights, were producing nearly identical feature vectors. No real computation does that. The only explanation is that the matrix multiplies never ran, and what came out was the ghost of the bias terms.

The kernel source confirmed it: all seven core compute functions are wrapped in `#if defined(__AVX2__)` with no `#else`. On ARM, those seven functions compile to nothing. No error, no warning. They just quietly do nothing at all.

I wrote seven scalar fallbacks. The features came alive. The output was still exclamation marks.

## Round three: the NaN fingerprint

This was the fun one. The logits were all NaN, so greedy decoding kept picking token 0, which happens to be the exclamation mark. But where did the NaN come from?

I varied the batch size and got a beautiful fingerprint:

```text
batch size 1 → fine
batch size 2 → fine
batch size 4 → all NaN
batch size 5 → all NaN
batch size 8 → fine
```

1, 2, and 8 are fine; 4 and 5 explode. That pattern points straight at the answer: the upstream framework hard-rounds matrix rows to multiples of 4. On x86 that's always safe, because x86's parallelism constant is 4. But ARM's constant is 8, so a remainder block of 4 rows fails the divisibility check and falls into a fallback function with mismatched semantics: values written to the wrong places, and the right places never written at all. The leftover uninitialized memory is where the NaN comes from.

The best part: a sibling function in the same file has exactly the right guard for this case, comment included, explaining why it's needed. Same bug, fixed in one place, forgotten in the other. On x86 it can never trigger, so nobody ever noticed.

I copied the guard over, following the comment's own pattern. Finite logits, 71 tok/s decode, overall RTF 0.75. The paper's real-time claim actually holds on ARM.

## Round four: knowing when to stop

Three bugs down, and the output went from exclamation marks to fluent multilingual gibberish. The model was talking. It just wasn't listening.

That means at least one more numerical bug. I ran one final isolation experiment: replaced every matrix operation with a painfully slow element-by-element version whose semantics are beyond question. Bit-identical output. So the remaining bug isn't in anything I touched; it's further upstream, in the fused convolution operators, another stretch of hand-written code that has never been validated on ARM.

I stopped there. Not because it's unfixable, but because fixing it wouldn't change the conclusion: my machine already runs this model's 7B big brother on the GPU via MLX, 4x faster and better at Chinese. The CPU edition is built for people without this hardware. The rest of the digging is someone else's homework.

The three fixes and repro steps are packaged up and headed upstream. The repo has 13 stars. There's a decent chance this post arrives before the issue does.

## What I'm taking away

"Supports ARM" and "has been compiled on ARM" are different claims. A paper can say targeting, a model card can list NEON, but the only evidence that counts is whether that machine exists in CI.

Also: NaN isn't scary. NaN without a fingerprint is scary. Once the batch 1/2/8-good, 4/5-bad pattern showed up, the answer surfaced on its own. Most of the debugging effort wasn't staring at code; it was designing the one experiment that forces the bug to show itself.

As for whether 1-bit models are ready, this checkpoint's Chinese numbers speak for themselves, and I remain skeptical. But real-time transcription on edge CPUs as a direction? Worth watching.

## Postscript (the next day)

The day after I wrote this, Microsoft pushed a commit with "ARM NEON optimizations" and "fix overflow" in the message. I opened it up: all three bugs, fixed, matching what I'd found one for one. So the bugs were real and the direction was right. Their keyboard was just faster than my issue.

I pulled the new version and retested on the same machine. Compiles clean, runs faster. And the transcription is still gibberish. Round four is alive, and the evidence actually got stronger: the garbage looks identical under my scalar kernels and their NEON kernels, which points at the shared convolution path upstream of both.

The issue is filed, and this time it beat the blog post: [microsoft/VibeASR.cpp#2](https://github.com/microsoft/VibeASR.cpp/issues/2)

As for my "first person to compile it" title: shelf life, one day. Open source moves fast, and honestly, this is the best possible way to be proven wrong.
