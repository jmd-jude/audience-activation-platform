/**
 * Loads a Schema object (same shape lib/schema-context.ts's render functions
 * expect) entirely from Postgres -- tables/fields from SchemaTable/SchemaField,
 * global strategic config (business_context, query_guidelines) from the
 * singleton SchemaGlobalContext row. No dependency on lib/data/sig-schema.json.
 */
import type { Schema } from './schema-context';
import { prisma } from './db';

// Simple process-level cache -- this is read on every discover/generate
// request, and the registry doesn't change often enough to justify a DB
// round trip per call. Cleared on process restart; a real implementation
// would invalidate on registry writes instead of TTL.
let cached: { schema: Schema; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function loadSchemaFromRegistry(forceRefresh = false): Promise<Schema> {
  if (!forceRefresh && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.schema;
  }

  const [tables, globalContext] = await Promise.all([
    prisma.schemaTable.findMany({
      include: { fields: true },
      orderBy: { name: 'asc' },
    }),
    prisma.schemaGlobalContext.findFirst(),
  ]);

  const schema: Schema = {
    version: 'registry',
    tables: Object.fromEntries(
      tables.map((table) => [
        table.name,
        {
          description: table.description ?? undefined,
          fields: Object.fromEntries(
            table.fields.map((field) => [
              field.name,
              {
                type: field.type,
                nullable: field.nullable,
                primary_key: field.primaryKey,
                valid_values:
                  (field.validValues as Array<{ value: string; pctOfPopulation: number }> | null)?.map((v) => ({
                    value: v.value,
                    pct_of_population: v.pctOfPopulation,
                  })) ?? undefined,
                population_coverage: field.populationCoverage ?? undefined,
                // Draft (LLM-written, unreviewed) marketing_meaning never
                // reaches a live prompt -- only approved content renders.
                marketing_meaning:
                  field.reviewStatus === 'approved' ? field.marketingMeaning ?? undefined : undefined,
                creative_potential: (field.creativePotential as string | Record<string, string> | null) ?? undefined,
              },
            ])
          ),
        },
      ])
    ),
    business_context: globalContext
      ? {
          description: globalContext.description ?? undefined,
          key_concepts: (globalContext.keyConcepts as string[] | null) ?? undefined,
          unique_value_propositions: (globalContext.uniqueValuePropositions as string[] | null) ?? undefined,
          targeting_philosophy: globalContext.targetingPhilosophy ?? undefined,
        }
      : undefined,
    query_guidelines: globalContext
      ? {
          optimization_rules: (globalContext.optimizationRules as string[] | null) ?? undefined,
          strategic_combinations: (globalContext.strategicCombinations as string[] | null) ?? undefined,
        }
      : undefined,
  };

  cached = { schema, loadedAt: Date.now() };
  return schema;
}
