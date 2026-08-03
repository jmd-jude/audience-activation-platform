# Graphent

Marketers articulate what they want in plain language, whether to their in-house or agency teams: "eco-conscious luxury car shoppers." Turning that into a live campaign usually means a five-day round trip through an analyst, a SQL query, and a vendor's black-box "similar audience." The opportunity is to cut that to minutes by having LLM's do the translating, and doing it with actual strategic judgment instead of keyword matching.

## How it Works

1. **Discover.** Describe a business goal, get back 3-6 audience concepts. Not "affluent millennials." Things like "Green Home + Premium Auto Crossover," environmental donation history crossed with luxury automotive signals.
2. **Generate.** Pick a concept, it becomes a SQL query against the identity graph, validated live against Snowflake before anyone spends a dollar on it. Real counts, real sample rows, no vendor estimate to take on faith.

Step one works because of [`lib/data/sig-schema.json`](lib/data/sig-schema.json), a field-level marketing intelligence layer over the identity graph schema. Every field carries what it signals strategically, what creative angles it opens up, and what it correlates with. `GOLF_AFFINITY` is flagged as an affluence and executive-network signal. `DOG_OWNER` correlates with outdoor lifestyle and home ownership. That intelligence feeds every Claude call through [`lib/prompts.ts`](lib/prompts.ts) and [`lib/schema-context.ts`](lib/schema-context.ts). It's why the AI proposes psychographic intersections instead of demographic buckets. Anyone can point an LLM at a schema. Encoding years of marketing strategy at the field level doesn't happen by prompting harder.

## Current State

Working POC.

Exists today: discovery and generation end to end (`/discover` to `/generate`), backed by Claude and live against a real Snowflake identity graph. Live validation on every candidate query, count and sample rows, before a segment gets saved. A segment library with draft/approved/published status, search, filtering, cloning. Manual activation and performance tracking against Meta, Google, TikTok, LinkedIn, MNTN, and Pinterest, rolled up into ROAS, CPA, and CTR on the dashboard.

Not built yet: No platform activations. No auth or multi-tenancy, it runs as a single demo user. No scheduled refresh, segments are point-in-time snapshots. No performance API integrations. POC data models exist.

## Running it

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Runs at `http://localhost:3005`. You'll need `ANTHROPIC_API_KEY` and Snowflake credentials in `.env.local`. See [`CLAUDE.md`](CLAUDE.md) for the full environment variable list and architecture notes.
