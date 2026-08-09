/**
 * Semi-automated valid_values discovery. Never writes blindly:
 *  1. Batch APPROX_COUNT_DISTINCT per table to cheaply find enum-shaped fields
 *     (low cardinality) without running expensive DISTINCT scans on everything.
 *  2. For fields under the cardinality threshold, run a real SELECT DISTINCT
 *     and print it as a proposed diff against whatever's currently stored.
 *  3. Only writes with --apply. This is the "auto-detected, human-gated"
 *     tier discussed for valid_values -- source data has typos and dead
 *     codes, so proposals get reviewed before they can shape prompt content.
 *
 * Run:
 *   npx tsx scripts/schema-registry/sync-valid-values.ts                   (dry run, all fields)
 *   npx tsx scripts/schema-registry/sync-valid-values.ts --apply           (writes everything proposed)
 *   npx tsx scripts/schema-registry/sync-valid-values.ts --apply --binary-only
 *       Only writes fields whose discovered set is a subset of {0, 1} (or
 *       just {1}, matching the existing HASPHONE/OWNS_INVESTMENTS convention).
 *       The constraint itself is safe to trust even before marketing_meaning
 *       exists -- "= 1, not a threshold" doesn't need narrative content to be
 *       correct. Wider/stranger sets still require a human look before applying.
 *   npx tsx scripts/schema-registry/sync-valid-values.ts --table=DATA
 */
import { PrismaClient } from '@prisma/client';
import { createSnowflakeConnection } from '../../lib/snowflake';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const BINARY_ONLY = process.argv.includes('--binary-only');
const CARDINALITY_THRESHOLD = 30; // current widest known enum (INCOME_HH) has 18
const TABLE_FILTER = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1];
const TRACKED_TABLES = TABLE_FILTER ? [TABLE_FILTER] : ['DATA', 'PII', 'EMAIL'];

function isBinary(values: string[]): boolean {
  return values.length > 0 && values.every((v) => v === '0' || v === '1');
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// A single SELECT with too many APPROX_COUNT_DISTINCT() calls times out on
// wide tables (DATA has 355 columns) -- chunk into batches instead.
const CARDINALITY_BATCH_SIZE = 40;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const conn = createSnowflakeConnection();

  try {
    for (const tableName of TRACKED_TABLES) {
      const table = await prisma.schemaTable.findUnique({
        where: { name: tableName },
        include: { fields: true },
      });
      if (!table) {
        console.log(`${tableName}: not in registry, skipping`);
        continue;
      }

      console.log(`\n${tableName}: checking cardinality of ${table.fields.length} fields...`);

      // Cheap approx count per column, batched so wide tables (DATA has 355
      // columns) don't time out in one mega-query.
      const cardinalities: Record<string, number> = {};
      for (const batch of chunk(table.fields, CARDINALITY_BATCH_SIZE)) {
        const cardinalitySelect = batch
          .map((f) => `APPROX_COUNT_DISTINCT(${quoteIdent(f.name)}) AS ${quoteIdent(f.name)}`)
          .join(', ');
        const result = await conn.executeQuery(`SELECT ${cardinalitySelect} FROM ${quoteIdent(tableName)}`);
        Object.assign(cardinalities, result.rows[0]);
      }

      const candidates = table.fields.filter((f) => {
        const card = Number(cardinalities[f.name]);
        return card > 0 && card <= CARDINALITY_THRESHOLD;
      });

      console.log(`  ${candidates.length} field(s) look enum-shaped (<= ${CARDINALITY_THRESHOLD} distinct values)`);

      for (const field of candidates) {
        const distinctResult = await conn.executeQuery(
          `SELECT DISTINCT ${quoteIdent(field.name)} AS VAL FROM ${quoteIdent(tableName)} WHERE ${quoteIdent(field.name)} IS NOT NULL ORDER BY 1`
        );
        const discovered = distinctResult.rows.map((r) => String(r.VAL)).sort();
        const current = ((field.validValues as string[] | null) ?? []).slice().sort();

        const added = discovered.filter((v) => !current.includes(v));
        const removed = current.filter((v) => !discovered.includes(v));

        if (added.length === 0 && removed.length === 0) {
          continue; // no diff, nothing to report
        }

        const binary = isBinary(discovered);
        const skippedByBinaryFilter = BINARY_ONLY && !binary;

        console.log(`\n  ${field.name} (source: ${field.source}${binary ? ', binary' : ''}):`);
        if (added.length) console.log(`    + ${added.join(', ')}`);
        if (removed.length) console.log(`    - ${removed.join(', ')} (in registry, not seen in live data)`);

        if (APPLY && !skippedByBinaryFilter) {
          await prisma.schemaField.update({
            where: { id: field.id },
            data: { validValues: discovered, lastSyncedAt: new Date() },
          });
          console.log(`    applied`);
        } else if (APPLY && skippedByBinaryFilter) {
          console.log(`    skipped (--binary-only, not a 0/1 field, needs review)`);
        }
      }
    }
  } finally {
    await conn.disconnect();
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write proposed valid_values to the registry.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
