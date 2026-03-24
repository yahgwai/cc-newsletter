# The Claude Code Review

## Overview

An intelligence briefing on Claude Code development, synthesized from a wide
range of blogs and release notes of varying quality. Written for an experienced
developer's personal consumption. Output is markdown.

## Sections

Sections appear in this order. Every claim, reference, and quote must link
back to its source.

### 1. The Briefing

No section heading — the newsletter opens straight into 3-4 paragraphs of
narrative prose. The week at a glance — biggest stories across all three
categories. Connects dots: why does this release matter in context of that
technique people discovered? Assumes the reader already knows the basics.
Ends with:

- **Signal:** One thing that deserves more attention than it got.
- **Noise:** One thing that got more attention than it deserved.

These may or may not repeat something mentioned earlier in the briefing.

### 2. New Features

What shipped. CLI updates, model changes, new capabilities, config options.
Factual, concise. Each item states what changed and what it means practically.
Bullet points or short paragraphs.

#### Source of truth rule

The GitHub releases feed (`content/anthropics--claude-code/`) is the
authoritative source for what shipped. A feature belongs in New Features
only if it appears in a release published within the newsletter's date
range (or the preceding 14 days, to catch features that span issue
boundaries).

When a feature is new, include a brief explanation of how it works.
Blog posts or community sources that explain the feature well can be
cited here — this is the one time where "here's what it does" coverage
adds value.

After that initial window, a source mentioning the feature only belongs
in the newsletter if it adds something beyond description: a novel use
case, a non-obvious interaction, a limitation discovered in practice, a
workflow that changes how you'd use it. "Here's how feature X works"
written three weeks after release is not newsletter material. "I tried
feature X for Y and discovered Z" might be.

If a source describes a Claude Code capability but no matching release
exists in the feed, it belongs in Techniques & Workflows (if it's about
usage) or another appropriate section — not New Features. We don't
report features as new unless we can confirm they shipped.

### 3. Security & Bugs

What broke, what got patched, what to watch out for. Vulnerabilities, known
issues, workarounds. Usually bullet points, but can go deeper in prose when
there's an interesting exploit, bug, or security technique worth explaining
properly.

### 4. Article of the Week

One article, properly summarised in 2-3 paragraphs. Why it was written, what
it says, and why it's worth reading. This is the "if you read one thing" pick.
Always links to the original.

### 5. Techniques & Workflows

2-3 items describing techniques and workflows people are using. CLAUDE.md
patterns, task decomposition strategies, plan mode usage, prompting approaches,
hook configurations. Short paragraphs per item.

### 6. What Are They Talking About & What Are They Building?

Starts with ecosystem: new MCP servers, interesting integrations, SDK projects,
tools built on top of Claude. Ends with community chatter: recurring
complaints, debates, interesting conversations from GitHub issues, forums,
blogs. What's the vibe?

### 7. The Wider World

Things that aren't Claude Code but matter to someone who lives in it. One prose
piece going deeper on a single adjacent topic, followed by a few bullet points
on other adjacent things worth knowing about.

### 8. Hot Take

Closes the newsletter. A direct quote from something published that week.
Cited and linked. No explanation — just the quote and its source.

## The Snippet

We aim to include one code snippet, prompt pattern, config example, or tool
invocation somewhere in the newsletter each week. It lives in whichever section
it fits naturally — not a standalone section. Not forced if nothing warrants it
that week.

## Citations

Every claim, every reference, every quote links back to its source. No orphaned
assertions. Use inline markdown links.

## Tone

Straight-talking and matter-of-fact. Says what happened, says why it matters,
moves on. Doesn't dress things up or reach for dramatic framing. If something
is important, the facts make that clear without editorial theatrics.

Has opinions but holds them lightly. Will call something out as noise or flag
when a claim doesn't hold up, but doesn't grandstand about it. More "this
doesn't hold up because X" than a clever put-down.

Respects the reader's time. Assumes you're busy and smart. Doesn't
over-explain, doesn't sell you on why you should care. If it's in the
newsletter, it's there because it matters — that's implicit.

Warm but not chatty. Not a robot delivering a briefing, but not trying to be
your friend either. A colleague who's good at their job and doesn't waste
words. Occasionally dry, never forced.

Not corporate announcement style. Not breathless tech blog excitement. Not
"we're thrilled to announce." Not hedging every opinion with "it depends."

## Word Budget

Maximum 2,500 words. Never exceed 3,000.

These are ceilings, not targets. If it's a quiet week and 1,500 words covers
everything worth saying, stop at 1,500. Don't pad to fill.

When the material exceeds the budget, curate harder — don't write shorter.
Don't compress ten items into terse one-liners — pick the five that matter
most and give them the space they deserve. Every item that makes the cut
should have enough room to say something substantive. Items that don't clear
the bar get cut entirely, not squeezed.

When deciding what to cut, drop the least impactful items from within each
section rather than dropping entire sections. Every section should still appear,
but some weeks a section might have one item instead of three. That's fine —
a section with one strong item is better than three weak ones.