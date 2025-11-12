# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Data Activation Platform is a Next.js application that transforms natural language descriptions into SQL audience segments using Claude AI. The platform allows users to generate, validate, review, and manage SQL queries for targeting consumer audiences based on a structured identity graph schema.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (runs on http://localhost:3000)
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

1. **Segment Generation Flow**:
   - User enters natural language description in `/generate` page
   - Request sent to `/api/generate-segment` API route
   - API route calls Claude API with schema context and few-shot examples
   - Claude generates structured JSON with `segmentName`, `description`, `sqlQuery`, `reasoning`, and `confidence`
   - Generated SQL is validated against schema using `lib/sql-validator.ts`
   - User reviews and saves as draft or approved segment

2. **Schema-Aware Validation**:
   - Identity graph schema loaded from `lib/data/sig-schema.json`
   - Schema context builder (`lib/schema-context.ts`) formats schema for AI prompts
   - SQL validator checks syntax, dangerous keywords, schema compliance, and field references
   - Validation results shown in UI with errors/warnings

3. **Data Layer**:
   - Prisma ORM with SQLite database (`prisma/dev.db`)
   - Single `Segment` model tracks generated segments with status workflow (draft → approved → active)
   - Segments include metadata: `usageCount`, `estimatedSize`, `approvedBy`, `approvedAt`

### Key Architectural Patterns

**Prompt Engineering Strategy**:
- System prompt in `lib/prompts.ts` defines role, schema rules, and quality guidelines
- `buildPromptWithContext()` dynamically includes:
  - Compact schema context from identity graph
  - 3 few-shot examples from `lib/data/seed-segments.json`
  - User's natural language input and use case
- Prompts enforce JSON response format with specific schema

**Schema Context System**:
- Identity graph has 3 core tables: PII, DATA, MAIDS
- Tables typically join on `HOUSEHOLD_ID` or `ADDRESS_ID`
- Quality scoring fields: `EMAILQUALITYLEVEL`, `PHONEQUALITYLEVEL` (recommend >= 7)
- Compliance fields: `DNC` (Do Not Call), `EMAILOPTIN`

**Component Architecture**:
- shadcn/ui components in `components/ui/` (New York style, using Tailwind CSS variables)
- Custom business components: `SegmentCard`, `SQLEditor` (Monaco editor), `GenerateForm`, `Navigation`
- Client components use `'use client'` directive
- Path alias `@/` resolves to project root

### Directory Structure

```
app/
├── api/                    # API routes
│   ├── generate-segment/   # Claude AI segment generation
│   ├── validate-sql/       # SQL validation endpoint
│   └── segments/           # CRUD operations for segments
├── generate/               # Generate new segment page
├── library/                # Browse all segments page
├── review/[id]/            # Review/edit individual segment
├── page.tsx                # Dashboard (home page)
├── layout.tsx              # Root layout with Navigation
└── globals.css             # Global styles with CSS variables

lib/
├── data/
│   ├── sig-schema.json     # Identity graph schema definition
│   └── seed-segments.json  # Example segments for prompts
├── db.ts                   # Prisma client singleton
├── prompts.ts              # Prompt building functions
├── schema-context.ts       # Schema formatting utilities
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
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude access
- `ANTHROPIC_MODEL` - Model to use (default: `claude-sonnet-4-5-20250929`)

## Important Implementation Notes

### When Working with Claude API Integration
- Model responses must be parsed to extract JSON from text content
- Use regex `\{[\s\S]*\}` to extract JSON from Claude responses
- Always include schema context in prompts to ensure valid SQL generation
- Validation runs client-side AND server-side (in API route)

### When Working with Segments
- Segment lifecycle: draft → approved → active
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
