import sigSchema from './data/sig-schema.json';

interface SchemaField {
  type: string;
  nullable: boolean;
  primary_key: boolean;
  valid_values?: string[];
}

interface SchemaTable {
  fields: Record<string, SchemaField>;
}

interface Schema {
  version: string;
  tables: Record<string, SchemaTable>;
}

const schema = sigSchema as Schema;

/**
 * Builds a formatted schema context string for Claude API prompts
 * Returns schema information in a readable format for the AI model
 */
export function buildSchemaContext(): string {
  let context = 'SIG IDENTITY GRAPH SCHEMA\n';
  context += '='.repeat(50) + '\n\n';

  const tables = Object.keys(schema.tables);

  for (const tableName of tables) {
    const table = schema.tables[tableName];
    context += `TABLE: ${tableName}\n`;
    context += '-'.repeat(30) + '\n';
    context += 'Fields:\n';

    const fields = Object.entries(table.fields);
    for (const [fieldName, fieldInfo] of fields) {
      const nullable = fieldInfo.nullable ? 'NULL' : 'NOT NULL';
      const pk = fieldInfo.primary_key ? ' [PRIMARY KEY]' : '';
      context += `  - ${fieldName} (${fieldInfo.type}) ${nullable}${pk}\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Returns list of valid table names in the schema
 */
export function getValidTables(): string[] {
  return Object.keys(schema.tables);
}

/**
 * Returns fields for a specific table
 * @param tableName - Name of the table to get fields for
 */
export function getFieldsForTable(tableName: string): Record<string, SchemaField> | null {
  const table = schema.tables[tableName];
  return table ? table.fields : null;
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
 * Builds a compact schema summary for prompts with token limits
 * Includes valid_values for fields that have them defined
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

      // Include valid_values if they exist
      if (fieldInfo.valid_values && fieldInfo.valid_values.length > 0) {
        // For short lists (≤5 values), show all values inline
        if (fieldInfo.valid_values.length <= 5) {
          context += `: [${fieldInfo.valid_values.map(v => `"${v}"`).join(', ')}]`;
        } else {
          // For longer lists, show first 3 and last 2 with count
          const firstThree = fieldInfo.valid_values.slice(0, 3).map(v => `"${v}"`);
          const lastTwo = fieldInfo.valid_values.slice(-2).map(v => `"${v}"`);
          context += `: [${firstThree.join(', ')}, ... (${fieldInfo.valid_values.length} values) ..., ${lastTwo.join(', ')}]`;
        }
      }

      context += '\n';
    }
  }

  return context;
}
