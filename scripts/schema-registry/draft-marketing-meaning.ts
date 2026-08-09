/**
 * Drafts marketing_meaning for structural-only fields (source: auto,
 * marketingMeaning: null) using Claude, batched and with the existing
 * hand-authored entries as style examples. Writes drafts with
 * reviewStatus: 'draft' -- schema-context-db.ts only renders 'approved'
 * content into a live prompt, so nothing written here reaches a real
 * discover/generate call until a human reviews it in Prisma Studio and
 * flips reviewStatus to 'approved'.
 *
 * Fields flagged needsDomainKnowledge (proprietary/cryptic codes like
 * EAGLES_18_SEGMENT) are always skipped -- guessing at those is exactly the
 * confabulation risk this registry exists to prevent.
 *
 * Run:
 *   npx tsx scripts/schema-registry/draft-marketing-meaning.ts             (dry run, prints drafts)
 *   npx tsx scripts/schema-registry/draft-marketing-meaning.ts --apply     (writes as reviewStatus: draft)
 *   npx tsx scripts/schema-registry/draft-marketing-meaning.ts --table=DATA --limit=20
 */
import { PrismaClient } from '@prisma/client';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '../../lib/anthropic';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const TABLE_FILTER = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1];
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const BATCH_SIZE = 25;

const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          marketingMeaning: { type: 'string' },
        },
        required: ['name', 'marketingMeaning'],
        additionalProperties: false,
      },
    },
  },
  required: ['drafts'],
  additionalProperties: false,
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function main() {
  const exampleFields = await prisma.schemaField.findMany({
    where: { marketingMeaning: { not: null }, reviewStatus: 'approved' },
    take: 6,
    orderBy: { name: 'asc' },
  });
  const examples = exampleFields
    .map((f) => `${f.name} (${f.type}${f.validValues ? `, valid_values: ${JSON.stringify(f.validValues)}` : ''}): "${f.marketingMeaning}"`)
    .join('\n');

  const allCandidates = await prisma.schemaField.findMany({
    where: {
      marketingMeaning: null,
      needsDomainKnowledge: false,
      table: TABLE_FILTER ? { name: TABLE_FILTER } : undefined,
    },
    include: { table: true },
    orderBy: [{ table: { name: 'asc' } }, { name: 'asc' }],
  });

  // Join keys (*_ID) are plumbing, not targeting signals -- no marketing
  // narrative applies to them, drafting one is a category error, not a
  // quality issue a human reviewer should have to catch by hand.
  const candidateFields = allCandidates
    .filter((f) => !f.name.endsWith('_ID'))
    .slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
  const excludedIdCount = allCandidates.length - allCandidates.filter((f) => !f.name.endsWith('_ID')).length;

  console.log(
    `${candidateFields.length} candidate field(s) to draft (excluding needsDomainKnowledge, already-authored, and ${excludedIdCount} join-key/*_ID fields)`
  );

  let draftedCount = 0;

  for (const batch of chunk(candidateFields, BATCH_SIZE)) {
    const fieldList = batch
      .map((f) => `- ${f.table.name}.${f.name} (${f.type}${f.validValues ? `, valid_values: ${JSON.stringify(f.validValues)}` : ''})`)
      .join('\n');

    const prompt = `You are writing "marketing_meaning" entries for a consumer identity graph's field intelligence layer. Each entry is ONE sentence explaining what a field signals for marketing/audience targeting purposes -- not a database description, a targeting insight.

STYLE EXAMPLES (existing, hand-authored):
${examples}

Write a marketing_meaning for each of these fields, in the same style and length (one sentence, targeting-focused, not just restating the field name):
${fieldList}

Return one draft per field listed, using its exact name (not prefixed with the table name).`;

    const { message } = await createMessageWithTruncationRetry({
      model: getAnthropicModel(),
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: DRAFT_RESPONSE_SCHEMA } },
    });

    const { drafts } = JSON.parse(extractText(message)) as { drafts: { name: string; marketingMeaning: string }[] };
    // Model sometimes returns "TABLE.FIELD" despite instructions -- strip any
    // table prefix so matching doesn't silently drop every draft.
    const draftsByName = new Map(
      drafts.map((d) => [d.name.includes('.') ? d.name.split('.').pop()! : d.name, d.marketingMeaning])
    );

    for (const field of batch) {
      const draft = draftsByName.get(field.name);
      if (!draft) {
        console.log(`  ! ${field.table.name}.${field.name}: no draft returned, skipping`);
        continue;
      }
      console.log(`  ${field.table.name}.${field.name}: "${draft}"`);
      if (APPLY) {
        await prisma.schemaField.update({
          where: { id: field.id },
          data: { marketingMeaning: draft, reviewStatus: 'draft' },
        });
      }
      draftedCount++;
    }
  }

  console.log(`\n${draftedCount} field(s) ${APPLY ? 'drafted and written (reviewStatus: draft, not yet visible in prompts)' : 'would be drafted, re-run with --apply to write'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
