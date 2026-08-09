/**
 * Read-only by default: introspects AA's live Snowflake schema via
 * INFORMATION_SCHEMA.COLUMNS and diffs it against the SchemaTable/SchemaField
 * registry in Postgres. Prints what's new/changed/missing. Nothing is written
 * unless --apply is passed, and even then only structural facts (type,
 * nullable) are touched -- marketingMeaning, creativePotential,
 * combinationSignals, and validValues are never modified by this script.
 *
 * Run:
 *   npx tsx scripts/schema-registry/sync-structural-facts.ts            (dry run)
 *   npx tsx scripts/schema-registry/sync-structural-facts.ts --apply    (writes)
 */
import { PrismaClient } from '@prisma/client';
import { createSnowflakeConnection } from '../../lib/snowflake';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Curated subset the app's prompts actually use today (see sig-schema.json).
// Snowflake will have more columns than this (e.g. HOUSEHOLD_ID, MD5) -- those
// show up as "not tracked" below, not as errors. Deciding whether to bring a
// new column into the registry is a human call, this script only surfaces it.
const TRACKED_TABLES = ['DATA', 'PII', 'EMAIL'];

interface SnowflakeColumn {
  name: string;
  type: string;
  nullable: boolean;
}

async function main() {
  const conn = createSnowflakeConnection();
  let liveSchema: Record<string, { columns: SnowflakeColumn[] }>;

  try {
    liveSchema = await conn.getSchemaInfo();
  } finally {
    await conn.disconnect();
  }

  const registryTables = await prisma.schemaTable.findMany({ include: { fields: true } });
  const registryByTable = new Map(registryTables.map((t) => [t.name, t]));

  for (const tableName of TRACKED_TABLES) {
    const live = liveSchema[tableName];
    const registry = registryByTable.get(tableName);

    if (!live) {
      console.log(`\n${tableName}: NOT FOUND in live Snowflake schema (check SNOWFLAKE_SCHEMA env var)`);
      continue;
    }
    if (!registry) {
      console.log(`\n${tableName}: in Snowflake but not yet in registry -- run the JSON migration first, or add manually`);
      continue;
    }

    console.log(`\n${tableName}:`);
    const registryFieldsByName = new Map(registry.fields.map((f) => [f.name, f]));
    const liveFieldsByName = new Map(live.columns.map((c) => [c.name, c]));

    // New in Snowflake, not in registry -- proves the registry can grow past
    // whatever a human had time to hand-curate into the original JSON.
    // Created with marketingMeaning left null: structural facts are safe to
    // automate, semantic content is a separate human backlog.
    let newCount = 0;
    for (const col of live.columns) {
      if (!registryFieldsByName.has(col.name)) {
        console.log(`  + ${col.name} (${col.type}${col.nullable ? ', nullable' : ''}) -- untracked, not in registry`);
        newCount++;
        if (APPLY) {
          await prisma.schemaField.create({
            data: {
              tableId: registry.id,
              name: col.name,
              type: col.type,
              nullable: col.nullable,
              source: 'auto',
              lastSyncedAt: new Date(),
            },
          });
        }
      }
    }
    if (newCount > 0) {
      console.log(`  (${newCount} new field${newCount === 1 ? '' : 's'}${APPLY ? ' added' : ', add with --apply'})`);
    }

    // In registry but gone (or changed) in Snowflake
    for (const field of registry.fields) {
      const live = liveFieldsByName.get(field.name);
      if (!live) {
        console.log(`  - ${field.name} -- in registry but not found in live Snowflake schema`);
        continue;
      }
      const changes: string[] = [];
      if (live.type !== field.type) changes.push(`type ${field.type} -> ${live.type}`);
      if (live.nullable !== field.nullable) changes.push(`nullable ${field.nullable} -> ${live.nullable}`);
      if (changes.length > 0) {
        console.log(`  ~ ${field.name}: ${changes.join(', ')}`);
        if (APPLY) {
          await prisma.schemaField.update({
            where: { id: field.id },
            data: { type: live.type, nullable: live.nullable, source: 'auto', lastSyncedAt: new Date() },
          });
          console.log(`    applied`);
        }
      }
    }
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write structural changes (type/nullable) to the registry.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
