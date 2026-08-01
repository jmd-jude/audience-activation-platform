# Multi-Tenant User Management — PRD

## Problem

The platform currently has no user or account concept at all. There is no `User` model in the Prisma schema, and no authentication. Every place that should record "who did this" — `Segment.createdBy`, `Segment.approvedBy`, `Activation.activatedBy`, `PerformanceMetric.createdBy` — is a free-text string that defaults to `"demo-user"`. Anyone with access to the app can generate, approve, and publish any segment; there is no data isolation between clients.

This becomes a real problem the moment the platform is used by an agency rather than a single internal team: an agency manages multiple clients, and those clients' audience data must not be visible to each other. There also needs to be a distinction between who can generate/edit a segment and who is trusted to approve and publish it, since publishing activates real spend against a real audience.

The originating question was framed as "what does login/user management look like" — but the more precise problem is tenancy and data isolation for an agency-with-multiple-clients structure, of which authentication is only one piece.

## Opportunity

Nothing here needs to be retrofitted around existing behavior — there is no `User` model to migrate away from, just string fields to replace with real relations. That makes this a clean, additive schema design rather than a painful migration.

The existing `Segment.status` lifecycle (`draft` → `approved` → `published`) already implies an approver role conceptually; it just isn't enforced by anything today. A per-client role model maps directly onto that existing lifecycle instead of inventing a new one.

## Goals

- Every piece of data in the system (segments, activations, metrics) is scoped to a specific client, and one client's users can never see another client's data.
- An agency can have multiple users, each of whom may have access to a subset of that agency's clients rather than blanket access to everything.
- The existing draft → approved → published segment lifecycle has a real role behind the "approve" step, not an open action anyone can take.
- Whoever implements this can do so without re-deriving the tenancy model from scratch — the two-level structure (agency owns clients; users get per-client access) is decided, not still in question.

## Out of Scope (for now)

- **Actual auth implementation** (Auth.js/NextAuth, Clerk, session handling, login UI) — this PRD is schema/data-model scaffolding only. No library was chosen.
- **Wiring the new models into existing API routes** — `/api/segments`, `/api/generate-segment`, `/api/validate-sql`, etc. all currently read/write the old string-based `createdBy`/`approvedBy` fields. None of that wiring is done here.
- **Enforcement logic** — e.g., checking a user's `ClientRole` before allowing an approve/publish action. The schema supports this but nothing currently reads it.
- **Billing/seats per organization** — not discussed; likely a natural future extension once `Organization` exists, but no design work happened on it.
- **SSO** — email/password or magic-link auth was assumed sufficient for an initial version; SSO wasn't discussed as a near-term need.
- **Account switcher UI** — the need for one was identified (an agency user managing multiple clients needs to switch context, similar to a GitHub/Vercel org switcher), but no UI design happened.

## Delivery Sequence

This PRD covers a single deliverable: the schema sketch. It was not broken into phases because implementation (auth wiring, route updates, UI) is explicitly out of scope for this pass.

### 1. Schema scaffolding

Add `Organization`, `Client`, `User`, and `ClientMembership` models to `prisma/schema.prisma`, and convert the existing free-text identity fields on `Segment`, `Activation`, and `PerformanceMetric` into real foreign-key relations. Do not run a migration yet — this is meant to be reviewed and picked up by whoever implements auth, not applied immediately, since applying it would break every existing route that currently writes plain strings to those fields.

Proposed shape:

```prisma
// --- Tenancy ---

model Organization {
  id        String   @id @default(cuid())
  name      String   // the agency itself
  createdAt DateTime @default(now())

  users     User[]
  clients   Client[]
}

model Client {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String   // the agency's client, e.g. "Acme Retail"
  createdAt      DateTime @default(now())

  memberships    ClientMembership[]
  segments       Segment[]

  @@index([organizationId])
}

// --- Identity ---

model User {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String   @unique
  name           String?
  role           OrgRole  @default(MEMBER)
  createdAt      DateTime @default(now())

  clientAccess      ClientMembership[]
  segmentsCreated   Segment[]    @relation("SegmentCreatedBy")
  segmentsApproved  Segment[]    @relation("SegmentApprovedBy")
  activations       Activation[]

  @@index([organizationId])
}

enum OrgRole {
  ADMIN   // manages org users/billing, implicit access to every client
  MEMBER  // only sees clients explicitly granted below
}

// Per-client grant -- lets an org admin scope a MEMBER to specific clients
// rather than the whole agency roster. ADMIN role bypasses this table entirely.
model ClientMembership {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId  String
  client    Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  role      ClientRole @default(VIEWER)
  createdAt DateTime   @default(now())

  @@unique([userId, clientId])
  @@index([clientId])
}

enum ClientRole {
  APPROVER  // can move segments through draft -> approved -> published
  ANALYST   // can generate/edit segments, cannot approve
  VIEWER    // read-only
}
```

Wiring change to existing models (shown for `Segment`; same pattern applies to `Activation.activatedBy` and `PerformanceMetric.createdBy`):

```prisma
model Segment {
  // ...unchanged fields...
  clientId       String
  client         Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  createdById    String
  createdBy      User     @relation("SegmentCreatedBy", fields: [createdById], references: [id])
  approvedById   String?
  approvedBy     User?    @relation("SegmentApprovedBy", fields: [approvedById], references: [id])
  // drop the old createdBy/approvedBy String fields
}
```

## Open Questions

- **Does `ADMIN` need explicit `ClientMembership` rows, or does the app layer just short-circuit "if org role is ADMIN, allow all clients in this org"?** Modeled here as the latter (no row needed) for simplicity, but that means access logic lives partly in application code rather than purely in the data — worth a deliberate decision when implementation starts, not an assumption carried forward from this sketch.
- **`ClientRole` currently has no enforcement, and there is currently no approve/publish gate of any kind to hook it into.** The review page's `handleSave` (`app/review/[id]/page.tsx`) now saves whatever status is selected directly — the old rule-based `/api/validate-sql` gate was removed as a vestigial, non-meaningful check and replaced with a live count-check + plain-language "Adjust This Audience" loop (`/api/snowflake/count`, `/api/adjust-segment-query`), neither of which validates or restricts who can set a segment to `approved`/`published`. Implementing `ClientRole` enforcement means adding a real permission check to `handleSave`/its API route — there's no existing gate to extend, one has to be built.
- Which auth library, and email/password vs. magic link vs. both, was not decided.
- Whether `Organization` needs its own settings/billing model now or can wait was not discussed in depth.

## Context

- `prisma/schema.prisma` — current schema; has no `User` model. `Segment.createdBy`, `Segment.approvedBy`, `Activation.activatedBy`, `PerformanceMetric.createdBy` are all free-text strings defaulting to `"demo-user"` today.
- `app/review/[id]/page.tsx` — `handleSave` sets segment status (`draft`/`approved`/`published`) with no permission check today; this is where a future `ClientRole` enforcement would need to be added. The old `/api/validate-sql` rule-based gate has been removed entirely (dead-code cleanup, not part of this PRD) and replaced with a live count-check + "Adjust This Audience" loop (`/api/snowflake/count`, `/api/adjust-segment-query`) — neither of those restricts who can change status.
- Segment lifecycle (draft → approved → published) is documented in `CLAUDE.md` under "When Working with Segments."

## Next Steps (Post-Implementation)

This PRD is schema only — nothing changes behavior until the following happen, roughly in this order. None of this is scoped or estimated here; it's a sequencing note for whoever picks this up.

1. **Actual auth.** Pick a library (Auth.js, Clerk, etc.) and get login/session working. Right now there's no way to know who's making a request.
2. **Wire existing routes to real users.** Replace the `"demo-user"` string defaults with the logged-in user's ID, and scope every segment read/write by that user's accessible `clientId`(s). This is the step that actually makes data isolation real — the schema alone doesn't isolate anything.
3. **Build the permission check flagged in Open Questions.** `handleSave` on the review page currently lets anyone flip a segment to `approved`/`published` with no gate. That needs a real `ClientRole` check now that roles exist to check against.

After those three, the next tier is more product-shaped than infrastructure-shaped:

4. **Invite flow.** There's no UI for creating `Organization`/`User`/`ClientMembership` rows — someone has to be able to invite a teammate or client user into a specific client with a specific role.
5. **Client switcher UI.** Needed once a single user has access to more than one client (similar to a GitHub/Vercel org switcher).

**Timing note:** this entire thread — multi-tenancy, auth, real user management — is explicitly the funded, post-demo phase of the roadmap, not near-term work. The current priority is a POC demo (~2026-08-04) to a prospective agency partner; this PRD is the first piece of what happens *if* that lands and funds the next phase, not something to fold into the current push.
