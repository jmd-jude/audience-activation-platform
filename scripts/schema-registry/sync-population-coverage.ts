/**
 * Population coverage / selectivity discovery -- live from Snowflake, not
 * AA's data-dictionary CSV export. The CSV mixes row grains (some fields
 * report one row per distinct value, some report a single collapsed "Non
 * empty values" row, some report only a "=1" flag with no null-rate
 * signal at all) and is a stale snapshot (its own header calls it a
 * "Q1 Count"). Querying the same DATA/PII/EMAIL tables the SQL analyst
 * actually hits sidesteps all of that -- one query per table/batch, no
 * row-shape classification needed, always current.
 *
 * The metric this writes is selectivity: % of population that would
 * survive filtering on this field (or a specific value of it), not
 * abstract "fill rate". That's the number that actually predicts whether
 * a semantically-correct SQL query returns a healthy audience size or a
 * near-empty one.
 *
 * Two branches per field, decided by cardinality (reusing the same
 * APPROX_COUNT_DISTINCT batching pattern as sync-valid-values.ts):
 *   - Low-cardinality (<= CARDINALITY_THRESHOLD): GROUP BY, writes
 *     validValues as {value, pctOfPopulation}[] (supersedes the plain
 *     string[] shape sync-valid-values.ts writes) plus populationCoverage
 *     as the sum (true non-null rate).
 *   - High-cardinality / continuous: populationCoverage only, via batched
 *     COUNT(field) conditional aggregation (one query covers many
 *     columns), validValues left untouched.
 *
 * Deliberately does NOT touch SchemaField.source or marketingMeaning/
 * reviewStatus/combinationSignals -- scoped to the two columns it owns.
 *
 * Run:
 *   node --env-file=.env.local --import tsx scripts/schema-registry/sync-population-coverage.ts
 *   node --env-file=.env.local --import tsx scripts/schema-registry/sync-population-coverage.ts --apply
 *   node --env-file=.env.local --import tsx scripts/schema-registry/sync-population-coverage.ts --table=DATA
 */
import { PrismaClient } from '@prisma/client';
import { createSnowflakeConnection } from '../../lib/snowflake';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
// 30 (sync-valid-values.ts's threshold) misses STATE, which legitimately has
// 62 values (50 states + DC + territories + military/COFA codes) -- verified
// via live GROUP BY, not dirty data. 65 captures STATE, FIPS_STATE_CODE,
// CONGRESSIONAL_DISTRICT, and EAGLES_60_SEGMENT (4 fields registry-wide)
// without pulling in genuinely continuous fields.
const CARDINALITY_THRESHOLD = 65;
const TABLE_FILTER = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1];
const TRACKED_TABLES = TABLE_FILTER ? [TABLE_FILTER] : ['DATA', 'PII', 'EMAIL'];

// Wide tables (DATA has 355+ columns) time out in one mega-query -- chunk.
const BATCH_SIZE = 40;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface ValueSelectivity {
  value: string;
  pctOfPopulation: number;
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

      const totalResult = await conn.executeQuery(`SELECT COUNT(*) AS TOTAL FROM ${quoteIdent(tableName)}`);
      const total = Number(totalResult.rows[0].TOTAL);
      console.log(`\n${tableName}: ${total.toLocaleString()} rows, checking cardinality of ${table.fields.length} fields...`);

      const cardinalities: Record<string, number> = {};
      for (const batch of chunk(table.fields, BATCH_SIZE)) {
        const select = batch
          .map((f) => `APPROX_COUNT_DISTINCT(${quoteIdent(f.name)}) AS ${quoteIdent(f.name)}`)
          .join(', ');
        const result = await conn.executeQuery(`SELECT ${select} FROM ${quoteIdent(tableName)}`);
        Object.assign(cardinalities, result.rows[0]);
      }

      const lowCardinality = table.fields.filter((f) => {
        const card = Number(cardinalities[f.name]);
        return card > 0 && card <= CARDINALITY_THRESHOLD;
      });
      const highCardinality = table.fields.filter((f) => !lowCardinality.includes(f));

      console.log(`  ${lowCardinality.length} field(s) enum-shaped (value-level selectivity), ${highCardinality.length} continuous/high-cardinality (coverage only)`);

      // --- Low-cardinality: one GROUP BY per field, value-level selectivity ---
      for (const field of lowCardinality) {
        const groupResult = await conn.executeQuery(
          `SELECT ${quoteIdent(field.name)} AS VAL, COUNT(*) AS CNT FROM ${quoteIdent(tableName)} GROUP BY ${quoteIdent(field.name)} ORDER BY CNT DESC`
        );

        const nonNullRows = groupResult.rows.filter((r) => r.VAL !== null);
        const nonNullCount = nonNullRows.reduce((s, r) => s + Number(r.CNT), 0);
        const coverage = Number(((nonNullCount / total) * 100).toFixed(2));
        const validValues: ValueSelectivity[] = nonNullRows.map((r) => ({
          value: String(r.VAL),
          pctOfPopulation: Number(((Number(r.CNT) / total) * 100).toFixed(2)),
        }));

        console.log(`\n  ${field.name}: ${coverage}% populated, ${validValues.length} value(s)`);
        for (const v of validValues.slice(0, 5)) {
          console.log(`    "${v.value}": ${v.pctOfPopulation}%`);
        }
        if (validValues.length > 5) console.log(`    ... and ${validValues.length - 5} more`);

        if (APPLY) {
          await prisma.schemaField.update({
            where: { id: field.id },
            data: { populationCoverage: coverage, validValues: validValues as any, lastSyncedAt: new Date() },
          });
          console.log(`    applied`);
        }
      }

      // --- High-cardinality: batched COUNT(field), coverage only ---
      for (const batch of chunk(highCardinality, BATCH_SIZE)) {
        if (batch.length === 0) continue;
        const select = batch.map((f) => `COUNT(${quoteIdent(f.name)}) AS ${quoteIdent(f.name)}`).join(', ');
        const result = await conn.executeQuery(`SELECT ${select} FROM ${quoteIdent(tableName)}`);
        const row = result.rows[0];

        for (const field of batch) {
          const nonNull = Number(row[field.name]);
          const coverage = Number(((nonNull / total) * 100).toFixed(2));
          console.log(`\n  ${field.name}: ${coverage}% populated (continuous, no value breakdown)`);

          if (APPLY) {
            await prisma.schemaField.update({
              where: { id: field.id },
              data: { populationCoverage: coverage, lastSyncedAt: new Date() },
            });
            console.log(`    applied`);
          }
        }
      }
    }
  } finally {
    await conn.disconnect();
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write populationCoverage/validValues to the registry.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
