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
   - SQL validated client-side against schema using `lib/sql-validator.ts`

3. **Snowflake Validation Flow** (`/api/snowflake/count`):
   - User clicks "Validate Audience" to run query against live Snowflake
   - Query is wrapped in CTE + COUNT(*) to get audience size without fetching all rows
   - Separate LIMIT 10 query fetches sample data for preview
   - Returns: audience size, execution time, sample rows with column metadata

4. **Data Layer**:
   - Prisma ORM with SQLite database (`prisma/dev.db`)
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
│   ├── validate-sql/       # Client-side SQL validation
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
├── db.ts                   # Prisma client singleton
├── prompts.ts              # Prompt building functions
├── schema-context.ts       # Schema formatting utilities
├── snowflake.ts            # Snowflake SDK connection class
├── sql-validator.ts        # SQL validation logic
└── utils.ts                # Utility functions (formatNumber, formatDate, cn)

components/
├── ui/                     # shadcn/ui components
└── [custom components]     # Business logic components

prisma/
├── schema.prisma           # Prisma schema (SQLite)
├── seed.ts                 # Database seeding script
└── dev.db                  # SQLite database file
```

## Environment Setup

Required environment variables in `.env.local`:

**Anthropic API:**
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude access
- `ANTHROPIC_MODEL` - Model to use (default: `claude-sonnet-4-5-20250929`)

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
- Model responses must be parsed to extract JSON from text content
- Use regex `\{[\s\S]*\}` to extract JSON from Claude responses
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

### SQL Validation Rules
- Only SELECT queries allowed
- Must include FROM clause
- Must reference valid tables from `sig-schema.json`
- Field references validated against schema
- Warns if DISTINCT not used (deduplication best practice)
- Blocks dangerous keywords: DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, CREATE
