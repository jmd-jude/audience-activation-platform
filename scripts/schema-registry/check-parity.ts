/**
 * Diffs the JSON-backed and DB-backed schema context output to prove the
 * migration doesn't silently change what the model sees. Expected to NOT be
 * byte-identical right now -- the registry has 351 extra auto-discovered
 * fields the JSON never had. This prints a summary of what differs and why,
 * not a pass/fail assertion, since "more fields" is the intended outcome of
 * this spike, not a regression.
 *
 * Run: npx tsx scripts/schema-registry/check-parity.ts
 */
import { buildCompactSchemaContext, buildSemanticContext } from '../../lib/schema-context';
import { loadSchemaFromRegistry } from '../../lib/schema-context-db';
import sigSchema from '../../lib/data/sig-schema.json';

const jsonTables = sigSchema.tables as Record<string, { fields: Record<string, unknown> }>;

async function main() {
  const dbSchema = await loadSchemaFromRegistry(true);

  const jsonCompact = buildCompactSchemaContext();
  const dbCompact = buildCompactSchemaContext(dbSchema);
  const jsonSemantic = buildSemanticContext();
  const dbSemantic = buildSemanticContext(dbSchema);

  console.log('--- Compact schema context ---');
  console.log(`JSON: ${jsonCompact.length} chars, ${jsonCompact.split('\n').length} lines`);
  console.log(`DB:   ${dbCompact.length} chars, ${dbCompact.split('\n').length} lines`);

  console.log('\n--- Semantic (marketing_meaning) context ---');
  console.log(`JSON: ${jsonSemantic.length} chars`);
  console.log(`DB:   ${dbSemantic.length} chars`);
  const sortLines = (s: string) => s.split('\n').sort().join('\n');
  if (jsonSemantic.trim() === dbSemantic.trim()) {
    console.log('IDENTICAL, including order.');
  } else if (sortLines(jsonSemantic) === sortLines(dbSemantic)) {
    console.log('Same content, different order (DB queries tables alphabetically, JSON preserved original file order). No content loss.');
  } else {
    console.log('DIFFERS in content -- unexpected, since the registry was seeded directly from this JSON. Investigate.');
  }

  console.log('\n--- Field count by table ---');
  for (const tableName of Object.keys(dbSchema.tables)) {
    const jsonFieldCount = Object.keys(jsonTables[tableName]?.fields ?? {}).length;
    const dbFieldCount = Object.keys(dbSchema.tables[tableName].fields).length;
    const withMeaning = Object.values(dbSchema.tables[tableName].fields).filter((f) => f.marketing_meaning).length;
    console.log(`${tableName}: JSON had ${jsonFieldCount} fields, registry has ${dbFieldCount} (${withMeaning} with marketing_meaning, ${dbFieldCount - withMeaning} structural-only)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
