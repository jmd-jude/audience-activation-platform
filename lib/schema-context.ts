import sigSchema from './data/sig-schema.json';

interface SchemaField {
  type: string;
  nullable: boolean;
  primary_key: boolean;
  valid_values?: string[];
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

interface Schema {
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

/**
 * Builds a compact schema summary for prompts.
 * Includes the full valid_values list for every enumerated field -- the
 * largest field in this schema has 18 values, trivial against the prompt's
 * token budget, so there's no real case for truncating any of them. A prior
 * version truncated fields with >5 values to first-3/last-2, which silently
 * dropped the exact bracket the model needed for common requests (e.g.
 * INCOME_HH's middle brackets, the "affluent" range) and caused it to
 * fabricate plausible-looking values that don't exist in the real data.
 */
export function buildCompactSchemaContext(): string {
  let context = 'Available Tables:\n';

  const tables = Object.keys(schema.tables);
  for (const tableName of tables) {
    const table = schema.tables[tableName];
    context += `\n${tableName}:\n`;

    const fields = Object.entries(table.fields);
    for (const [fieldName, fieldInfo] of fields) {
      // Include field name and type
      context += `  - ${fieldName} (${fieldInfo.type})`;

      // Include the full valid_values list if it exists
      if (fieldInfo.valid_values && fieldInfo.valid_values.length > 0) {
        context += `: [${fieldInfo.valid_values.map(v => `"${v}"`).join(', ')}]`;
      }

      context += '\n';
    }
  }

  return context;
}

/**
 * Builds semantic intelligence context from schema
 * Extracts marketing_meaning and creative_potential for key fields
 */
export function buildSemanticContext(): string {
  let context = 'FIELD INTELLIGENCE (What these fields mean for targeting):\n\n';

  const tables = Object.keys(schema.tables);
  for (const tableName of tables) {
    const table = schema.tables[tableName];
    const fieldsWithMeaning: string[] = [];

    const fields = Object.entries(table.fields);
    for (const [fieldName, fieldInfo] of fields) {
      // Only include fields that have marketing_meaning
      if (fieldInfo.marketing_meaning) {
        let fieldContext = `${fieldName}: ${fieldInfo.marketing_meaning}`;

        // Add creative_potential if it exists and is an object with value mappings
        if (fieldInfo.creative_potential && typeof fieldInfo.creative_potential === 'object') {
          const mappings = Object.entries(fieldInfo.creative_potential)
            .map(([key, value]) => `  • ${key}: ${value}`)
            .join('\n');
          fieldContext += `\n${mappings}`;
        }

        fieldsWithMeaning.push(fieldContext);
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
export function getStrategicCombinations(): string[] {
  return schema.query_guidelines?.strategic_combinations || [];
}

/**
 * Builds strategic patterns context for prompts
 * Shows proven query patterns that work well together
 */
export function buildStrategicPatternsContext(): string {
  const combinations = getStrategicCombinations();

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
export function buildOptimizationRules(): string {
  const rules = schema.query_guidelines?.optimization_rules || [];

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
