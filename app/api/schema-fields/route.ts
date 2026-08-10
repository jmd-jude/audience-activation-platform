import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/schema-fields - Raw schema registry tables + fields (admin view,
// includes draft reviewStatus/marketingMeaning that loadSchemaFromRegistry()
// deliberately hides from prompts)
export async function GET() {
  try {
    const tables = await prisma.schemaTable.findMany({
      include: { fields: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(tables);
  } catch (error: any) {
    console.error('Error fetching schema fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schema fields', details: error.message },
      { status: 500 }
    );
  }
}
