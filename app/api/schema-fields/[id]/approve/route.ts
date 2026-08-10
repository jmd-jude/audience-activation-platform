import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/schema-fields/[id]/approve - Flip reviewStatus draft -> approved.
// Separate from PATCH so approving is never a side effect of saving edited text.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const field = await prisma.schemaField.update({
      where: { id },
      data: { reviewStatus: 'approved' },
    });

    return NextResponse.json(field);
  } catch (error: any) {
    console.error('Error approving schema field:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Schema field not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to approve schema field', details: error.message },
      { status: 500 }
    );
  }
}
