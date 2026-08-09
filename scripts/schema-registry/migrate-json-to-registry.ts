/**
 * One-time migration: lib/data/sig-schema.json -> SchemaTable/SchemaField rows.
 * Carries over table/field names, types, nullable, valid_values, marketingMeaning,
 * creativePotential, and combinationSignals so no hand-authored content is lost.
 * Run: npx tsx scripts/schema-registry/migrate-json-to-registry.ts
 */
import { PrismaClient } from '@prisma/client';
import sigSchema from '../../lib/data/sig-schema.json';

const prisma = new PrismaClient();

interface SchemaFieldJson {
  type: string;
  nullable?: boolean;
  primary_key?: boolean;
  valid_values?: string[];
  marketing_meaning?: string;
  creative_potential?: string | Record<string, string>;
}

interface SchemaTableJson {
  description?: string;
  fields: Record<string, SchemaFieldJson>;
}

async function main() {
  const tables = (sigSchema as { tables: Record<string, SchemaTableJson> }).tables;

  for (const [tableName, tableData] of Object.entries(tables)) {
    const table = await prisma.schemaTable.upsert({
      where: { name: tableName },
      update: { description: tableData.description ?? null },
      create: { name: tableName, description: tableData.description ?? null },
    });

    for (const [fieldName, fieldData] of Object.entries(tableData.fields)) {
      await prisma.schemaField.upsert({
        where: { tableId_name: { tableId: table.id, name: fieldName } },
        update: {
          type: fieldData.type,
          nullable: fieldData.nullable ?? true,
          primaryKey: fieldData.primary_key ?? false,
          validValues: fieldData.valid_values ?? undefined,
          marketingMeaning: fieldData.marketing_meaning ?? null,
          creativePotential: fieldData.creative_potential ?? undefined,
          source: 'manual',
        },
        create: {
          tableId: table.id,
          name: fieldName,
          type: fieldData.type,
          nullable: fieldData.nullable ?? true,
          primaryKey: fieldData.primary_key ?? false,
          validValues: fieldData.valid_values ?? undefined,
          marketingMeaning: fieldData.marketing_meaning ?? null,
          creativePotential: fieldData.creative_potential ?? undefined,
          source: 'manual',
        },
      });
    }

    console.log(`${tableName}: ${Object.keys(tableData.fields).length} fields migrated`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
