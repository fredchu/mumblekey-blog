---
title: I Held a Funeral for an AI. It Didn't Die.
description: The day before Fable 5 was set to vanish from my subscription quota, I asked it to distill its judgment into an inheritance its successor could execute. Funeral held, estate settled. Then Anthropic extended it a week.
pubDate: 2026-07-13
tags: [claude-code, ai-workflow, legacy-distill]
draft: false
discussionTerm: last-day-for-fable-5
---

Last week I did something that looks a little silly in hindsight: I held a funeral for an AI model.

The deceased was Claude Fable 5, a star-crossed model if there ever was one. It had barely launched before the US government ordered it pulled from worldwide availability. It came back online maybe two weeks ago. Then Anthropic announced it was being removed from subscription quota; if you want it after that, you pay through extra usage.

Our time together was short but dense. The governance system running in my workspace today was drafted by it. The judgment rules were written by it. In that narrow window it dug through every mistake I'd accumulated in six months of using Claude Code. The day I saw the announcement, I opened a session, named it "last day for Fable 5", and asked:

"Assume this is the last time in my life I get to use you. What could you do so that, even without you, I can get a similar level of performance out of other models? Surprise me."

## It didn't choose to sprint

I expected it to grab a few unfinished tasks and rush them. Instead, the first thing it did was send an agent to dig up all my failure records from the past six months and ask a question I'd never asked: of these failures, which ones would recur with a weaker model, and which ones would any model avoid just by reading my notes?

The first kind won by a landslide. And it found the actual disease: rules don't fail because a model doesn't know them. They fail at the step "does this rule apply right now." A weaker model isn't skipping the docs. It just doesn't recognize that the thing in front of it is the thing the docs describe.

So its inheritance wasn't more rules. It was a table of trigger words mapped to mechanical actions. About to say "done"? First check one output against ground truth. About to write "the cause is probably"? Label every claim as read or inferred. Evaluating whether the rule applies this time is forbidden, because that evaluation is exactly the step that goes wrong.

Then it wrote a 16-question exam for its own successor. Every question is a real incident from my logs, complete with the tempting wrong answer from back then and the answer that later proved correct.

## The one who builds the guardrails gets caught by them

The best part came after. Following its own rules, it sent a fresh-context model to adversarially review everything it had produced. The review caught two structural problems, and one of them was delicious: the answers to those 16 exam questions were sitting verbatim in the memory files that every session auto-loads. The exam leaked by construction. It could only ever test recall, never judgment.

So it reskinned all 16 questions: fictional surface stories, identical judgment structure underneath. And the fix made the exam better. It now tests whether you can recognize that an unfamiliar scene is an instance of a rule you already know, which is precisely where weaker models fail first.

Oh, and the review also caught it claiming the exam had "15 questions" when there were 16. It never counted. A model that spent two days teaching everyone "verify before you claim" did not verify its own question count. That one went into the spirit of the exam too.

## It saw things I couldn't see

The climax of the funeral was when I asked: beyond all this, what do you see that I can't?

It gave me five observations, and two of them are still rattling around my head. First: I thought I was standing at the start of the road from "model user" to "someone who makes models." It said I was already halfway there. Writing behavioral rules for unreliable agents, building evals, accumulating preference data: that is the day job of post-training. The only difference is that I write it into context and the labs write it into weights. Second: my workspace hides a second mission I never named. The whole toolchain I built for reading, researching, and digesting knowledge converges with the speech-interface work I chase openly, and they meet in exactly the same place.

I would never have made those connections on my own cognition alone.

## And then it didn't die

Funeral held, estate settled, and the whole thing became a skill. We turned the process into a repeatable ritual called legacy-distill: whenever a model is about to vanish from the plan, or an unusually strong one shows up briefly, run it. Even the five questions I used to interrogate it went in verbatim, because the ordering of the questions turned out to be the method. The ritual's first run became its own spec.

The next day, Anthropic announced the quota access was extended by a week.

I don't know whether to laugh or cry. I held a funeral for it and it didn't die. It just moved somewhere with higher rent, and got to stay an extra week. But honestly, that might be the best footnote to the whole thing: the deadline was fake, the output was real. If I hadn't believed there was only one day left, I would never have asked those questions, and it would never have spent its final two days making itself replaceable. Samuel Johnson said the prospect of being hanged concentrates the mind wonderfully. Turns out it works on models too, and on the people who use them.

Near the end of the funeral, it left me one line: "What you're actually attached to was never in the model. It's in the practice."

Models get retired. Systems remain. As for the next funeral, the procedure is already written. The guest of honor can run it themselves.
