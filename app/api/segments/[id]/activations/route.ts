import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if segment exists
    const segment = await prisma.segment.findUnique({
      where: { id },
    });

    if (!segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Get all activations for the segment with latest metric
    const activations = await prisma.activation.findMany({
      where: { segmentId: id },
      include: {
        metrics: {
          orderBy: { periodStart: 'desc' },
          take: 1,
        },
      },
      orderBy: { activatedAt: 'desc' },
    });

    // Transform to include latestMetric instead of metrics array
    const transformedActivations = activations.map((activation) => ({
      id: activation.id,
      segmentId: activation.segmentId,
      platform: activation.platform,
      platformName: activation.platformName,
      externalAudienceId: activation.externalAudienceId,
      audienceSize: activation.audienceSize,
      status: activation.status,
      activatedAt: activation.activatedAt,
      activatedBy: activation.activatedBy,
      createdAt: activation.createdAt,
      updatedAt: activation.updatedAt,
      latestMetric: activation.metrics[0] || null,
    }));

    return NextResponse.json(transformedActivations);
  } catch (error: any) {
    console.error('Error fetching activations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activations', details: error.message },
      { status: 500 }
    );
  }
}
