import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/segments/[id] - Get a specific segment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const segment = await prisma.segment.findUnique({
      where: { id },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(segment);
  } catch (error: any) {
    console.error('Error fetching segment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/segments/[id] - Update a segment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      segmentName,
      description,
      targetUseCase,
      sqlQuery,
      status,
      estimatedSize,
      approvedBy,
      approvedAt,
      usageCount,
      lastUsed,
    } = body;

    // Build update data
    const updateData: any = {};

    if (segmentName !== undefined) updateData.segmentName = segmentName;
    if (description !== undefined) updateData.description = description;
    if (targetUseCase !== undefined) updateData.targetUseCase = targetUseCase;
    if (sqlQuery !== undefined) updateData.sqlQuery = sqlQuery;
    if (status !== undefined) updateData.status = status;
    if (estimatedSize !== undefined) updateData.estimatedSize = estimatedSize;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;
    if (approvedAt !== undefined)
      updateData.approvedAt = approvedAt ? new Date(approvedAt) : null;
    if (usageCount !== undefined) updateData.usageCount = usageCount;
    if (lastUsed !== undefined)
      updateData.lastUsed = lastUsed ? new Date(lastUsed) : null;

    // If status is being set to approved, set approval metadata
    if (status === 'approved' && !approvedBy) {
      updateData.approvedBy = 'demo-user';
      updateData.approvedAt = new Date();
    }

    // Update segment
    const segment = await prisma.segment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(segment);
  } catch (error: any) {
    console.error('Error updating segment:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update segment', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/segments/[id] - Delete a segment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.segment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Segment deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting segment:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete segment', details: error.message },
      { status: 500 }
    );
  }
}
