# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Data Activation Platform is a Next.js application that transforms natural language into activated audience segments. The platform has a two-stage AI workflow:

1. **Discovery** - AI acts as a strategic ideation partner, suggesting 3-6 creative audience concepts based on a business goal
2. **Generation** - AI translates selected audience concepts into precise SQL queries against a Snowflake identity graph

The platform validates queries in real-time against Snowflake, showing counts and sample data before activation.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (runs on http://localhost:3005)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Database Commands
- `npx prisma generate` - Generate Prisma client after schema changes
- `npx prisma db push` - Push schema changes to database (development)
- `npx prisma db seed` - Seed database with sample segments from `prisma/seed.ts`
- `npx prisma studio` - Open Prisma Studio to browse/edit database

### UI Components (shadcn/ui)
- `npx shadcn@latest add <component>` - Add new UI component from shadcn/ui library

## Architecture

### Core Application Flow

1. **Audience Discovery Flow** (`/api/discover-audiences`):
   - User provides business goal and use case
   - AI acts as "Marketing Strategist" suggesting 3-6 creative audience concepts
   - Each concept includes: name, description, key characteristics, campaign concept, and natural language targeting criteria
   - AI is schema-aware and only suggests audiences achievable with available data

2. **Segment Generation Flow** (`/api/generate-segment`):
   - User selects an audience concept (or enters custom description)
   - AI generates SQL query with `segmentName`, `description`, `sqlQuery`, and `reasoning`
   - No inline validation or Snowflake execution happens here — see the two validation points below
   - A self-reported `confidence` score existed early on and was removed (prompt, response schema, and UI) — unmeasured/uncalibrated, same reasoning as not rendering `creative_potential` (see Schema Registry section below)

3. **Audience sizing** happens via `/api/snowflake/count` — the "Generate Counts" button, present on both the generate page and the review page (`app/review/[id]/page.tsx`). Live execution against Snowflake, query wrapped in CTE + COUNT(*) to get audience size without fetching all rows, plus a separate LIMIT 10 query for sample data. Returns audience size, execution time, sample rows with column metadata. The review page also lets a query be adjusted in plain language via `/api/adjust-segment-query`, which revises the SQL and immediately re-runs the count. There is no rule-based SQL linter gating approve/publish — that early-POC concept (`lib/sql-validator.ts`, `/api/validate-sql`) was removed as functionally redundant with live count checks.

4. **Data Layer**:
   - Prisma ORM with Prisma Postgres (a hosted database, accessed both directly and via Prisma Accelerate — see `DATABASE_URL`/`PRISMA_DATABASE_URL` in Environment Setup)
   - Single `Segment` model tracks generated segments with status workflow (draft → approved → published)
   - Segments include metadata: `usageCount`, `estimatedSize`, `approvedBy`, `approvedAt`

### Key Architectural Patterns

**Prompt Engineering Strategy**:
- System prompt in `lib/prompts.ts` defines role, schema rules, and quality guidelines
- `buildPromptWithContext()`, `buildQueryAdjustmentPrompt()`, and `buildDiscoveryPrompt()` are all `async` (required to support the DB-backed schema source below) and call `resolveSchemaContext()` to get the schema/semantic/optimization/strategic-pattern text blocks
- Prompts enforce JSON response format with specific schema

**Schema Context System**:
- Identity graph has 3 core tables: PII, DATA, EMAIL
- DATA and PII join on `HOUSEHOLD_ID` (or `ADDRESS_ID`) — same-household/address facts. EMAIL joins on `ID`, not `HOUSEHOLD_ID` — see below.
- `EMAILQUALITYLEVEL` is inverted from what the name suggests: **0 is the highest quality**, ranging 0-4, higher numbers are progressively worse. This was wrong in the original hand-authored schema content (implied higher = better) and was corrected after being caught during the schema registry work below — don't assume `>= N` means "better" for this field.
- `ID` is Audience Acuity's **persistent individual identifier**, consistent across DATA, PII, and EMAIL (confirmed against AA's own data dictionary and live data, not just column naming). Always join EMAIL on `d.ID = e.ID`, never `HOUSEHOLD_ID` — a household-level join attaches every resident's email to every other resident, which measured out to ~5x inflation on audience-size counts before this was caught and corrected in `lib/prompts.ts` and the Postgres registry's `optimizationRules`.
- Compliance fields: `DNC` (Do Not Call), `EMAILOPTIN`

**Schema Registry** (Postgres-backed, replacing static JSON):
- `lib/data/sig-schema.json` was the original single source of schema/semantic content — hand-authored, compiled into the app bundle, editing it required a code deploy
- It's being decoupled into Postgres: `SchemaTable`/`SchemaField` (per-table/per-field facts: type, nullable, `valid_values`, `marketing_meaning`, `creative_potential`) and `SchemaGlobalContext` (singleton row holding `business_context`/`query_guidelines`, the non-per-field strategic config)
- Gated behind `SCHEMA_SOURCE` env var (see Environment Setup) via `lib/schema-context-resolver.ts` — `db` reads entirely from Postgres via `lib/schema-context-db.ts` (zero dependency on the JSON file in this mode); anything else (including unset) uses the original static JSON path in `lib/schema-context.ts`, i.e. **current production behavior is unchanged until this flag is explicitly set**
- `SchemaField.reviewStatus` (`draft` | `approved`) gates whether `marketing_meaning` reaches a live prompt — `draft` (e.g. LLM-generated content) is invisible to `buildSemanticContext()` until a human flips it to `approved` in Prisma Studio. `valid_values` has no such gate; it's written directly, since a wrong enum value is a correctness bug (silent zero-result or wrong-direction queries), not a taste call.
- `creative_potential` is stored per-field but **deliberately not rendered** into any prompt — unmeasured effect on output quality, no output schema consumes it, reserved for a possible future "creative inspiration" feature rather than ambient seasoning on every discover/generate call
- Registry-building tooling lives in `scripts/schema-registry/` (all read-only by default, require `--apply` to write, run via `node --env-file=.env.local --import tsx scripts/schema-registry/<script>.ts`):
  - `sync-structural-facts.ts` — introspects live Snowflake `INFORMATION_SCHEMA.COLUMNS`, diffs against the registry, `--apply` writes new/changed fields with `source: 'auto'`
  - `sync-valid-values.ts` — discovers real enum values via batched `APPROX_COUNT_DISTINCT` + `SELECT DISTINCT`; `--binary-only` restricts writes to fields whose real values are a subset of `{0,1}`, the low-risk case safe to bulk-apply without review
  - `draft-marketing-meaning.ts` — batches structural-only fields to Claude for a first-pass `marketing_meaning`, always writes `reviewStatus: 'draft'`
  - `ingest-data-dictionary.ts` — ingests AA's own data dictionary CSVs (table-scoped exports, gitignored, local-only) as ground truth in preference to LLM guesses; this is what caught `GOLF_AFFINITY`'s real values being `{2,3}` not `{1}`, and `EMAILQUALITYLEVEL`'s inverted scale, both previously live in the hand-authored JSON
  - `migrate-json-to-registry.ts` / `check-parity.ts` — one-time seeding and JSON-vs-DB output comparison; only meaningful while both sources coexist, retire once fully cut over
- **Future cleanup once confidently cut over to `SCHEMA_SOURCE=db` in production** (don't do this immediately after flipping the flag — the JSON path is the rollback plan until the DB path has proven itself in real production use): delete `schema-context-resolver.ts`, make the `schema-context.ts` render functions require a `Schema` arg instead of defaulting to the JSON import, delete `sig-schema.json`, remove the `SCHEMA_SOURCE` conditional entirely, retire `migrate-json-to-registry.ts` and `check-parity.ts`. The other four scripts remain permanent tooling.

**Component Architecture**:
- shadcn/ui components in `components/ui/` (New York style, using Tailwind CSS variables)
- Custom business components: `SegmentCard`, `SQLEditor` (Monaco editor), `GenerateForm`, `Navigation`
- Client components use `'use client'` directive
- Path alias `@/` resolves to project root

**Constants and Configuration**:
- `lib/constants.ts` is the single source of truth for platforms and use cases
- Platforms: Meta, Google, TikTok, LinkedIn, MNTN (CTV), Pinterest
- Use cases: Awareness, Customer Acquisition, Retention, Lookalike Audience
- Segment statuses defined as const array: ['draft', 'approved', 'published']

### Directory Structure

```
app/
├── api/
│   ├── discover-audiences/ # AI-powered audience ideation
│   ├── generate-segment/   # Claude AI SQL generation
│   ├── adjust-segment-query/ # Plain-language query adjustment (review page)
│   ├── snowflake/
│   │   ├── count/          # Get audience size + sample data (primary validation)
│   │   ├── validate/       # EXPLAIN-based query validation
│   │   └── execute/        # Full query execution with optional LIMIT
│   └── segments/           # CRUD operations for segments
├── discover/               # AI-powered audience discovery page
├── dashboard/              # Dashboard with metrics and performance
├── generate/               # Generate new segment page
├── library/                # Browse all segments page
├── review/[id]/            # Review/edit individual segment
├── page.tsx                # Landing page (marketing homepage)
├── layout.tsx              # Root layout with Navigation
└── globals.css             # Global styles with CSS variables

lib/
├── data/
│   ├── sig-schema.json     # Original identity graph schema definition (JSON path only — see Schema Registry)
│   └── seed-segments.json  # Example segments for prompts
├── anthropic.ts            # Anthropic client factory, model resolution, truncation-retry helper, extractText()
├── db.ts                   # Prisma client singleton
├── prompts.ts              # Prompt building functions (async — see Schema Registry)
├── response-schemas.ts     # JSON schemas for output_config.format (structured outputs), one per Claude route
├── schema-context.ts       # JSON-backed schema render functions (accept optional Schema override)
├── schema-context-db.ts    # Postgres-backed Schema loader (SchemaTable/SchemaField/SchemaGlobalContext)
├── schema-context-resolver.ts # Picks JSON vs DB source based on SCHEMA_SOURCE env var
├── snowflake.ts            # Snowflake SDK connection class
└── utils.ts                # Utility functions (formatNumber, formatDate, cn)

scripts/
└── schema-registry/        # Registry-building tooling — see Schema Registry section below

components/
├── ui/                     # shadcn/ui components
└── [custom components]     # Business logic components

prisma/
├── schema.prisma           # Prisma schema (Postgres) — Segment/Activation/PerformanceMetric + SchemaTable/SchemaField/SchemaGlobalContext
└── seed.ts                 # Database seeding script
```

## Environment Setup

Required environment variables in `.env.local`:

**Anthropic API:**
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude access
- `ANTHROPIC_MODEL` - Model to use (default: `claude-sonnet-5`)

**Snowflake Connection:**
- `SNOWFLAKE_ACCOUNT` - Snowflake account identifier
- `SNOWFLAKE_USERNAME` - Service account username
- `SNOWFLAKE_DATABASE` - Target database name
- `SNOWFLAKE_WAREHOUSE` - Warehouse to use for queries
- `SNOWFLAKE_SCHEMA` - Default schema
- `SNOWFLAKE_PRIVATE_KEY` - Private key for JWT authentication (PEM format, can have escaped `\n`)
- `SNOWFLAKE_TIMEOUT` - Optional query timeout in ms (default: 30000)

**Schema Source:**
- `SCHEMA_SOURCE` - `db` reads schema/semantic content from the Postgres registry; unset or any other value uses the original static `lib/data/sig-schema.json` (current production default). See Schema Registry section above.

## Important Implementation Notes

### When Working with Claude API Integration
- All three Claude call sites (`discover-audiences`, `generate-segment`, `clarify-segment`) go through `lib/anthropic.ts`, not the SDK directly:
  - `getAnthropicModel()` resolves the model (env var, fallback `claude-sonnet-5`) — don't hardcode a model string in a route
  - `createMessageWithTruncationRetry()` wraps `messages.create()`: checks `stop_reason === 'max_tokens'` and automatically retries once with `thinking: {type: 'disabled'}` and doubled `max_tokens` before giving up
  - `extractText()` finds the first `text`-type content block — **don't assume `message.content[0]` is text**; with adaptive thinking on, index 0 is often a `thinking` block instead
- Every call sets `thinking: {type: 'adaptive'}` explicitly. Sonnet 5 runs adaptive thinking by default if this is omitted, and thinking output shares the same `max_tokens` budget as the actual response — omitting it silently increases truncation risk.
- JSON responses use structured outputs (`output_config: {format: {type: 'json_schema', schema: ...}}`), not regex extraction — schemas live in `lib/response-schemas.ts`, one per route, matching each route's response contract. Response text can be parsed directly with `JSON.parse()`; no need to search for a JSON substring.
- Always include schema context in prompts to ensure valid SQL generation
- Discovery endpoint (`/api/discover-audiences`) returns audience concepts with `targetingCriteria.naturalLanguageInput` for subsequent SQL generation

### When Working with Snowflake Integration
- `lib/snowflake.ts` provides `SnowflakeConnection` class with JWT private key auth
- Use `createSnowflakeConnection()` factory function which reads from env vars
- Always call `disconnect()` in finally blocks to clean up connections
- The `/api/snowflake/count` endpoint wraps queries in CTE for efficient counting:
  ```sql
  WITH segment_base AS (user_query) SELECT COUNT(*) FROM segment_base
  ```
- Sample data queries append `LIMIT 10` to user's query

### When Working with Segments
- Segment lifecycle: draft → approved → published
- SQL queries are read-only SELECT statements only (validation blocks DROP/DELETE/UPDATE)
- `DISTINCT` is strongly recommended to avoid duplicate records
- All SQL queries target the identity graph schema, not the Prisma database

### When Adding New UI Components
- Use shadcn/ui components when possible: `npx shadcn@latest add <component>`
- Follow New York style variant (cleaner, more compact)
- Use `cn()` utility from `lib/utils.ts` for conditional className merging
- Maintain consistent spacing and Card-based layouts

### When Modifying Prisma Schema
1. Update `prisma/schema.prisma`
2. Run `npx prisma generate` to update client
3. Run `npx prisma db push` to push changes to database
4. Update seed script if needed and re-run `npx prisma db seed`

### SQL Query Trust Model
There is no rule-based linter enforcing SELECT-only, dangerous-keyword blocking, or schema compliance — that existed early on (`lib/sql-validator.ts`, removed) and was judged not a meaningful trust signal for this POC phase. Query correctness is judged by the live "Generate Counts" check (`/api/snowflake/count`) — real audience size, real sample rows — not by static analysis. Enforcing SELECT-only and similar guardrails at the database/service-account level (not app-level linting) is flagged as real work for the post-funding hardening phase.
