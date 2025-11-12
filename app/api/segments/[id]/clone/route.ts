import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/segments/[id]/clone - Clone a segment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Get the original segment
    const originalSegment = await prisma.segment.findUnique({
      where: { id },
    });

    if (!originalSegment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // Create a new segment with cloned data
    const clonedSegment = await prisma.segment.create({
      data: {
        segmentName: `${originalSegment.segmentName} (Copy)`,
        description: originalSegment.description,
        targetUseCase: originalSegment.targetUseCase,
        sqlQuery: originalSegment.sqlQuery,
        status: 'draft', // Always start clones as draft
        estimatedSize: originalSegment.estimatedSize,
        // Don't copy approval metadata
      },
    });

    return NextResponse.json(clonedSegment, { status: 201 });
  } catch (error: any) {
    console.error('Error cloning segment:', error);
    return NextResponse.json(
      { error: 'Failed to clone segment', details: error.message },
      { status: 500 }
    );
  }
}
