import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PATCH /api/schema-fields/[id] - Update a schema field's marketingMeaning.
// Does not touch reviewStatus -- see the approve/ sub-route for that.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { marketingMeaning } = body;

    const updateData: any = {};
    if (marketingMeaning !== undefined) updateData.marketingMeaning = marketingMeaning;

    const field = await prisma.schemaField.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(field);
  } catch (error: any) {
    console.error('Error updating schema field:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Schema field not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update schema field', details: error.message },
      { status: 500 }
    );
  }
}
