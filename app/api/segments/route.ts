import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/segments - List all segments with optional filtering and sorting
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const useCase = searchParams.get('useCase') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { segmentName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (useCase) {
      where.targetUseCase = useCase;
    }

    if (status) {
      where.status = status;
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Query database
    const segments = await prisma.segment.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(segments);
  } catch (error: any) {
    console.error('Error fetching segments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segments', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/segments - Create a new segment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      segmentName,
      description,
      targetUseCase,
      sqlQuery,
      status = 'draft',
      estimatedSize,
      approvedBy,
      approvedAt,
    } = body;

    // Validation
    if (!segmentName || !description || !targetUseCase || !sqlQuery) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: segmentName, description, targetUseCase, sqlQuery',
        },
        { status: 400 }
      );
    }

    // Create segment
    const segment = await prisma.segment.create({
      data: {
        segmentName,
        description,
        targetUseCase,
        sqlQuery,
        status,
        estimatedSize: estimatedSize || null,
        approvedBy: approvedBy || null,
        approvedAt: approvedAt ? new Date(approvedAt) : null,
      },
    });

    return NextResponse.json(segment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating segment:', error);
    return NextResponse.json(
      { error: 'Failed to create segment', details: error.message },
      { status: 500 }
    );
  }
}
