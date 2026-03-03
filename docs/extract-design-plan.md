# Plan: Extract design decisions from previous conversation

## Goal
Pull the key design decisions and project vision from the conversation in session
`995ec29e-3135-48e9-887d-20f5b546034c` and write them up as a project design doc.

## Source file
`~/.claude/projects/-home-chris-code-collect-runner/995ec29e-3135-48e9-887d-20f5b546034c.jsonl`

## How to read it
Each line is a JSON object. The conversation messages are in `.message.content` —
look for objects where `.message.role` is `"assistant"` or `"user"`. Assistant messages
have a `content` array; text is in entries where `type` is `"text"`. Ignore `thinking`
blocks and tool use blocks.

## What to extract
Scan the conversation for discussions about:

1. **Project purpose** — what is collect-runner trying to do overall?
2. **Source types and tiers** — the taxonomy of sources (official, community, etc.)
   and the metadata schema (`tier`, `type`, `scope`, `name`)
3. **Discovery strategies** — how to find sources (search patterns, link-following,
   crawling the reference graph)
4. **Feed metadata structure** — the proposed format for feeds.json as objects
   instead of strings
5. **Downstream processing** — what happens after content is collected (filtering,
   classification, relevance scoring)
6. **Architecture decisions** — what the agent does vs what scripts do, how the
   pieces fit together

## Output
Write the extracted content to `docs/project-design.md` as a clean design doc.
Keep the user's own words where they capture the intent well. Organize by topic,
not chronologically.
