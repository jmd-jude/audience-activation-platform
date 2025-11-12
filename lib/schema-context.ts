import sigSchema from './data/sig-schema.json';

interface SchemaField {
  type: string;
  nullable: boolean;
  primary_key: boolean;
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
 */
export function buildCompactSchemaContext(): string {
  let context = 'Available Tables:\n';

  const tables = Object.keys(schema.tables);
  for (const tableName of tables) {
    const table = schema.tables[tableName];
    const fieldNames = Object.keys(table.fields);
    context += `- ${tableName}: ${fieldNames.join(', ')}\n`;
  }

  return context;
}
