/**
 * Ingests one of AA's data dictionary CSVs (consumer_data.csv / _email.csv /
 * _pii.csv, each scoped to one table) as ground truth for valid_values and
 * marketing_meaning, in preference to LLM-drafted guesses. Never overwrites
 * an existing marketingMeaning or validValues -- only fills gaps, except for
 * the *_Affinity "Range = 1-3" case, where existing hand-authored content
 * gets the scale note appended rather than replaced (see conversation on
 * spike/schema-registry: GOLF_AFFINITY's real values are {2,3}, not the {1}
 * implied by the original creative_potential text -- this is the fix).
 *
 * Column layout varies slightly per export (the email/pii CSVs insert a
 * "Q1 Count" and "% of Population" column the data CSV doesn't have), so
 * columns are located by header name, not fixed position.
 *
 * CSV shape (repeats per Attribute Name):
 *   - Simple categorical: one row per valid value, shared Description text.
 *   - Binary flag: one row, Attribute Value "1", Description is the meaning.
 *   - Affinity range: one row, Attribute Value "Non empty values", Description
 *     is the fixed "Range = 1-3 Where: 1 = low interest in Affinity, ..." text.
 *   - Continuous-enumerated (e.g. Age): many rows, one per literal number --
 *     not useful as valid_values, skipped entirely.
 *
 * Run:
 *   npx tsx scripts/schema-registry/ingest-data-dictionary.ts --table=DATA --file=consumer_data.csv
 *   npx tsx scripts/schema-registry/ingest-data-dictionary.ts --table=EMAIL --file=consumer_email.csv --apply
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const TABLE_NAME = process.argv.find((a) => a.startsWith('--table='))?.split('=')[1] ?? 'DATA';
const CSV_PATH = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
  ?? '/Users/JudeHoffner/dev/ai-data-activation-platform/consumer_data.csv';

const AFFINITY_RANGE_TEXT =
  'Range = 1-3 Where: 1 = low interest in Affinity, 2 = medium interest in Affinity, 3 = high interest in Affinity';

interface CsvRow {
  category: string;
  attributeName: string;
  attributeValue: string;
  attributeValueTranslation: string;
  attributeDescription: string;
}

// Minimal RFC4180 parser -- handles quoted fields with embedded commas, which
// this export has (e.g. "A. Under $10,000").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function humanizeTopic(fieldName: string): string {
  return fieldName
    .replace(/_Affinity$/i, '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function findColumn(header: string[], name: string): number {
  const idx = header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Column "${name}" not found in header: ${header.join(' | ')}`);
  return idx;
}

async function main() {
  const raw = readFileSync(CSV_PATH, 'utf-8').replace(/^﻿/, '');
  const allRows = parseCsv(raw);
  const [header, ...dataRows] = allRows;

  const col = {
    category: findColumn(header, 'Category'),
    attributeName: findColumn(header, 'Attribute Name'),
    attributeValue: findColumn(header, 'Attribute Value'),
    attributeValueTranslation: findColumn(header, 'Attribute Value Translation'),
    attributeDescription: findColumn(header, 'Attribute Description'),
  };

  const rows: CsvRow[] = dataRows
    .filter((r) => r.length >= 5 && r[col.attributeName]?.trim())
    .map((r) => ({
      category: r[col.category]?.trim() ?? '',
      attributeName: r[col.attributeName]?.trim() ?? '',
      attributeValue: r[col.attributeValue]?.trim() ?? '',
      attributeValueTranslation: r[col.attributeValueTranslation]?.trim() ?? '',
      attributeDescription: r[col.attributeDescription]?.trim() ?? '',
    }));

  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = row.attributeName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const targetTable = await prisma.schemaTable.findUnique({
    where: { name: TABLE_NAME },
    include: { fields: true },
  });
  if (!targetTable) throw new Error(`${TABLE_NAME} table not in registry`);
  const fieldsByUpperName = new Map(targetTable.fields.map((f) => [f.name.toUpperCase(), f]));

  const stats = {
    affinityRange: 0,
    binaryFlag: 0,
    categorical: 0,
    continuousSkipped: 0,
    unmatched: 0,
    noOp: 0,
    joinKeySkipped: 0,
    sentinelSkipped: 0,
    variedDescriptionSkipped: 0,
    tooManyValuesSkipped: 0,
  };
  // Matches the widest existing curated enum's cardinality (INCOME_HH has 18)
  // -- a field needing more values than this to enumerate isn't a targeting
  // enum, it's bloat (OCCUPATION_DETAIL has 200+, EAGLES_60_SEGMENT has 60).
  const MAX_VALID_VALUES = 30;

  for (const [attributeName, groupRows] of grouped) {
    const field = fieldsByUpperName.get(attributeName.toUpperCase());
    if (!field) {
      stats.unmatched++;
      continue;
    }
    if (field.name.endsWith('_ID') || field.name === 'ID') {
      stats.joinKeySkipped++;
      continue;
    }

    const isAffinityRange =
      groupRows.length === 1 && groupRows[0].attributeDescription.startsWith(AFFINITY_RANGE_TEXT);
    const isBinaryFlag = groupRows.length === 1 && groupRows[0].attributeValue === '1';
    const isContinuous = groupRows.length > 20 && groupRows.every((r) => /^-?\d+$/.test(r.attributeValue));

    // "Non empty values" is the dictionary's own placeholder for "this field
    // has data, no fixed value list" (same convention used for ID fields) --
    // never treat it as a literal enumerable value. Checked after the
    // affinity-range shape, since that shape's own row also uses this
    // placeholder in Attribute Value, with the real payload in the
    // Description instead.
    if (!isAffinityRange && groupRows.some((r) => r.attributeValue === 'Non empty values')) {
      stats.sentinelSkipped++;
      continue;
    }

    if (isAffinityRange) {
      const topic = humanizeTopic(field.name);
      const scaleNote = `Scored 1 (low) to 3 (high) interest in ${topic}.`;
      const newMeaning = field.marketingMeaning
        ? `${field.marketingMeaning} ${scaleNote}`
        : `${topic.charAt(0).toUpperCase()}${topic.slice(1)} interest level. ${scaleNote}`;

      console.log(`  [affinity-range] ${field.name}: valid_values -> ["1","2","3"], marketing_meaning -> "${newMeaning}"`);
      stats.affinityRange++;
      if (APPLY) {
        await prisma.schemaField.update({
          where: { id: field.id },
          data: { validValues: ['1', '2', '3'], marketingMeaning: newMeaning, reviewStatus: 'approved' },
        });
      }
      continue;
    }

    if (isBinaryFlag) {
      if (field.marketingMeaning) {
        stats.noOp++;
        continue; // don't overwrite existing content for the simple cases
      }
      const meaning = groupRows[0].attributeDescription;
      console.log(`  [binary] ${field.name}: marketing_meaning -> "${meaning}"`);
      stats.binaryFlag++;
      if (APPLY) {
        await prisma.schemaField.update({
          where: { id: field.id },
          data: {
            validValues: field.validValues ?? ['1'],
            marketingMeaning: meaning,
            reviewStatus: 'approved',
          },
        });
      }
      continue;
    }

    if (isContinuous) {
      stats.continuousSkipped++;
      continue;
    }

    // Simple categorical: one row per valid value, shared description.
    if (field.validValues || field.marketingMeaning) {
      stats.noOp++;
      continue; // don't overwrite existing valid_values/marketing_meaning
    }
    const values = groupRows.map((r) => r.attributeValue);
    if (values.length > MAX_VALID_VALUES) {
      stats.tooManyValuesSkipped++;
      continue;
    }
    // Description varies per row for some fields (e.g. GENERATION_ORDINAL,
    // where each row's description is that row's own label, not a shared
    // field-level sentence) -- taking row 0 there would silently describe
    // only one of several values. Only proceed when it's genuinely shared.
    const descriptionsAreShared = groupRows.every((r) => r.attributeDescription === groupRows[0].attributeDescription);
    if (!descriptionsAreShared) {
      stats.variedDescriptionSkipped++;
      continue;
    }
    const meaning = groupRows[0].attributeDescription || null;
    console.log(`  [categorical] ${field.name}: valid_values -> ${JSON.stringify(values)}${meaning ? `, marketing_meaning -> "${meaning}"` : ''}`);
    stats.categorical++;
    if (APPLY) {
      await prisma.schemaField.update({
        where: { id: field.id },
        data: { validValues: values, marketingMeaning: meaning, reviewStatus: 'approved' },
      });
    }
  }

  console.log('\nSummary:', stats);
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to write.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
