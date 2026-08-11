import sigSchema from './data/sig-schema.json';

interface SchemaFieldValue {
  value: string;
  pct_of_population: number;
}

interface SchemaField {
  type: string;
  nullable: boolean;
  primary_key: boolean;
  // Plain strings from the static JSON path (no selectivity data), or
  // enriched objects from the registry path (lib/schema-context-db.ts) --
  // both render correctly, see buildCompactSchemaContext.
  valid_values?: Array<string | SchemaFieldValue>;
  // % of population that would survive filtering to this field at all (not
  // a specific value -- see valid_values for per-value selectivity). Only
  // populated via the registry path; measured live from Snowflake by
  // scripts/schema-registry/sync-population-coverage.ts, not LLM-guessed.
  population_coverage?: number;
  marketing_meaning?: string;
  creative_potential?: string | Record<string, string>;
  semantic_hints?: string[];
}

interface SchemaTable {
  description?: string;
  semantic_context?: string;
  marketing_use?: string;
  fields: Record<string, SchemaField>;
}

interface QueryGuidelines {
  optimization_rules?: string[];
  strategic_combinations?: string[];
}

interface BusinessContext {
  description?: string;
  key_concepts?: string[];
  unique_value_propositions?: string[];
  targeting_philosophy?: string;
}

export interface Schema {
  version: string;
  tables: Record<string, SchemaTable>;
  business_context?: BusinessContext;
  query_guidelines?: QueryGuidelines;
}

const schema = sigSchema as Schema;

/**
 * Returns list of valid table names in the schema
 */
export function getValidTables(): string[] {
  return Object.keys(schema.tables);
}

/**
 * Validates if a table exists in the schema
 */
export function isValidTable(tableName: string): boolean {
  return tableName in schema.tables;
}

/**
 * Validates if a field exists in a specific table
 */
export function isValidField(tableName: string, fieldName: string): boolean {
  const table = schema.tables[tableName];
  if (!table) return false;
  return fieldName in table.fields;
}

// Every render function below takes an optional Schema, defaulting to the
// static JSON import, so the exact same rendering logic can run against a
// registry-sourced Schema object (see lib/schema-context-db.ts) without
// duplicating any of this formatting. Existing zero-arg call sites are
// unaffected.

/**
 * Builds a compact schema summary for prompts.
 * Includes the full valid_values list for every enumerated field -- the
 * largest field in this schema has 62 values (STATE), trivial against the
 * prompt's token budget, so there's no real case for truncating any of them.
 * A prior version truncated fields with >5 values to first-3/last-2, which
 * silently dropped the exact bracket the model needed for common requests
 * (e.g. INCOME_HH's middle brackets, the "affluent" range) and caused it to
 * fabricate plausible-looking values that don't exist in the real data.
 *
 * When available (registry path only), also annotates each value with its
 * selectivity -- % of population that would survive filtering to exactly
 * that value -- and each field with its overall population_coverage. This
 * is deliberately just a number placed next to the value, not a warning or
 * instruction: the model has repeatedly shown it reasons well about
 * selectivity tradeoffs on its own (e.g. correctly hedging on "top 5 most
 * populous states" style requests) once it has the number, and rigid
 * "don't use fields under X%" rules would block legitimate narrow-but-valid
 * audience requests along with the risky ones.
 */
export function buildCompactSchemaContext(source: Schema = schema): string {
  let context = 'Available Tables:\n';

  const tables = Object.keys(source.tables);
  for (const tableName of tables) {
    const table = source.tables[tableName];
    context += `\n${tableName}:\n`;

    const fields = Object.entries(table.fields);
    for (const [fieldName, fieldInfo] of fields) {
      // Include field name and type
      context += `  - ${fieldName} (${fieldInfo.type}`;
      if (fieldInfo.population_coverage !== undefined) {
        context += `, ${fieldInfo.population_coverage}% populated`;
      }
      context += ')';

      // Include the full valid_values list if it exists, annotated with
      // per-value selectivity when the registry provides it
      if (fieldInfo.valid_values && fieldInfo.valid_values.length > 0) {
        const rendered = fieldInfo.valid_values.map((v) =>
          typeof v === 'string' ? `"${v}"` : `"${v.value}" (${v.pct_of_population}%)`
        );
        context += `: [${rendered.join(', ')}]`;
      }

      context += '\n';
    }
  }

  return context;
}

/**
 * Builds semantic intelligence context from schema
 * Extracts marketing_meaning for key fields. creative_potential is stored in
 * the registry but deliberately not rendered here -- no output contract
 * consumes it today, and it's reserved for a possible future
 * creative-inspiration feature rather than ambient prompt seasoning.
 */
export function buildSemanticContext(source: Schema = schema): string {
  let context = 'FIELD INTELLIGENCE (What these fields mean for targeting):\n\n';

  const tables = Object.keys(source.tables);
  for (const tableName of tables) {
    const table = source.tables[tableName];
    const fieldsWithMeaning: string[] = [];

    const fields = Object.entries(table.fields);
    for (const [fieldName, fieldInfo] of fields) {
      // Only include fields that have marketing_meaning
      if (fieldInfo.marketing_meaning) {
        fieldsWithMeaning.push(`${fieldName}: ${fieldInfo.marketing_meaning}`);
      }
    }

    if (fieldsWithMeaning.length > 0) {
      context += `${tableName}:\n${fieldsWithMeaning.join('\n\n')}\n\n`;
    }
  }

  return context;
}

/**
 * Gets strategic query combinations from schema
 * These are proven patterns for common targeting scenarios
 */
export function getStrategicCombinations(source: Schema = schema): string[] {
  return source.query_guidelines?.strategic_combinations || [];
}

/**
 * Builds strategic patterns context for prompts
 * Shows proven query patterns that work well together
 */
export function buildStrategicPatternsContext(source: Schema = schema): string {
  const combinations = getStrategicCombinations(source);

  if (combinations.length === 0) {
    return '';
  }

  let context = 'PROVEN TARGETING PATTERNS (use these as templates):\n\n';

  combinations.forEach((combo, idx) => {
    context += `${idx + 1}. ${combo}\n`;
  });

  return context;
}

/**
 * Builds universal optimization rules from schema
 * These apply to all query generation regardless of use case
 */
export function buildOptimizationRules(source: Schema = schema): string {
  const rules = source.query_guidelines?.optimization_rules || [];

  if (rules.length === 0) {
    return '';
  }

  let context = 'UNIVERSAL QUERY RULES:\n';
  rules.forEach((rule, idx) => {
    context += `${idx + 1}. ${rule}\n`;
  });

  return context;
}

/**
 * Gets the targeting philosophy from schema
 */
export function getTargetingPhilosophy(): string {
  return schema.business_context?.targeting_philosophy || '';
}
