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

    // Query database with activations and their latest metrics
    const segments = await prisma.segment.findMany({
      where,
      orderBy,
      include: {
        activations: {
          include: {
            metrics: {
              orderBy: { periodEnd: 'desc' },
              take: 1, // Get only the latest metric for each activation
            },
          },
        },
      },
    });

    // Aggregate metrics across all activations for each segment
    const segmentsWithMetrics = segments.map((segment) => {
      const latestMetrics = segment.activations
        .map((activation) => activation.metrics[0])
        .filter((metric) => metric !== undefined);

      // Aggregate the metrics
      const aggregatedMetrics = latestMetrics.reduce(
        (acc, metric) => ({
          impressions: acc.impressions + (metric.impressions || 0),
          clicks: acc.clicks + (metric.clicks || 0),
          conversions: acc.conversions + (metric.conversions || 0),
          spend: acc.spend + (metric.spend || 0),
          revenue: acc.revenue + (metric.revenue || 0),
        }),
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
      );

      // Calculate derived metrics
      const hasMetrics = latestMetrics.length > 0;
      const roas = aggregatedMetrics.spend > 0
        ? aggregatedMetrics.revenue / aggregatedMetrics.spend
        : null;
      const ctr = aggregatedMetrics.impressions > 0
        ? (aggregatedMetrics.clicks / aggregatedMetrics.impressions) * 100
        : null;

      // Include basic activation info (for platform badges on dashboard)
      const activations = segment.activations.map((activation) => ({
        platform: activation.platform,
        platformName: activation.platformName,
        status: activation.status,
      }));

      return {
        ...segment,
        activations,
        metrics: hasMetrics
          ? {
              impressions: aggregatedMetrics.impressions,
              clicks: aggregatedMetrics.clicks,
              conversions: aggregatedMetrics.conversions,
              spend: aggregatedMetrics.spend,
              revenue: aggregatedMetrics.revenue,
              roas,
              ctr,
              activeActivations: segment.activations.filter(a => a.status === 'active').length,
              totalActivations: segment.activations.length,
            }
          : null,
      };
    });

    return NextResponse.json(segmentsWithMetrics);
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
      reasoning,
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
        reasoning: reasoning || null,
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
