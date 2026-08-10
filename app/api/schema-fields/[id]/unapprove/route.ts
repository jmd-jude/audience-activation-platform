import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/schema-fields/[id]/unapprove - Flip reviewStatus approved -> draft.
// Mirrors approve/ -- lets a reviewer walk back an approval without editing text.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const field = await prisma.schemaField.update({
      where: { id },
      data: { reviewStatus: 'draft' },
    });

    return NextResponse.json(field);
  } catch (error: any) {
    console.error('Error unapproving schema field:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Schema field not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to unapprove schema field', details: error.message },
      { status: 500 }
    );
  }
}
