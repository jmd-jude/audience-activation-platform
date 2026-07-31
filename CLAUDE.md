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
   - Each concept includes: name, description, key characteristics, marketing opportunity, and natural language targeting criteria
   - AI is schema-aware and only suggests audiences achievable with available data

2. **Segment Generation Flow** (`/api/generate-segment`):
   - User selects an audience concept (or enters custom description)
   - AI generates SQL query with `segmentName`, `description`, `sqlQuery`, `reasoning`, and `confidence`
   - No inline validation or Snowflake execution happens here — see the two validation points below

3. **Audience sizing** happens via `/api/snowflake/count` — the "Generate Counts" button, present on both the generate page and the review page (`app/review/[id]/page.tsx`). Live execution against Snowflake, query wrapped in CTE + COUNT(*) to get audience size without fetching all rows, plus a separate LIMIT 10 query for sample data. Returns audience size, execution time, sample rows with column metadata. The review page also lets a query be adjusted in plain language via `/api/adjust-segment-query`, which revises the SQL and immediately re-runs the count. There is no rule-based SQL linter gating approve/publish — that early-POC concept (`lib/sql-validator.ts`, `/api/validate-sql`) was removed as functionally redundant with live count checks.

4. **Data Layer**:
   - Prisma ORM with Prisma Postgres (a hosted database, accessed both directly and via Prisma Accelerate — see `DATABASE_URL`/`PRISMA_DATABASE_URL` in Environment Setup)
   - Single `Segment` model tracks generated segments with status workflow (draft → approved → published)
   - Segments include metadata: `usageCount`, `estimatedSize`, `approvedBy`, `approvedAt`

### Key Architectural Patterns

**Prompt Engineering Strategy**:
- System prompt in `lib/prompts.ts` defines role, schema rules, and quality guidelines
- `buildPromptWithContext()` dynamically includes:
  - Compact schema context from identity graph
  - User's natural language input and use case
- Prompts enforce JSON response format with specific schema

**Schema Context System**:
- Identity graph has 3 core tables: PII, DATA, EMAIL
- Tables typically join on `HOUSEHOLD_ID` or `ADDRESS_ID`
- Quality scoring fields: `EMAILQUALITYLEVEL`, `PHONEQUALITYLEVEL` (recommend >= 7)
- Compliance fields: `DNC` (Do Not Call), `EMAILOPTIN`

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
│   ├── sig-schema.json     # Identity graph schema definition
│   └── seed-segments.json  # Example segments for prompts
├── anthropic.ts            # Anthropic client factory, model resolution, truncation-retry helper, extractText()
├── db.ts                   # Prisma client singleton
├── prompts.ts              # Prompt building functions
├── response-schemas.ts     # JSON schemas for output_config.format (structured outputs), one per Claude route
├── schema-context.ts       # Schema formatting utilities
├── snowflake.ts            # Snowflake SDK connection class
└── utils.ts                # Utility functions (formatNumber, formatDate, cn)

components/
├── ui/                     # shadcn/ui components
└── [custom components]     # Business logic components

prisma/
├── schema.prisma           # Prisma schema (Postgres)
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
