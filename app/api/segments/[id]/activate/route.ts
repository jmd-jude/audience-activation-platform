import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { platform, platformName, externalAudienceId, audienceSize } = await request.json();

    // Validate required fields
    if (!platform || !platformName || !externalAudienceId) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, platformName, externalAudienceId' },
        { status: 400 }
      );
    }

    // Check if segment exists and is approved/active
    const segment = await prisma.segment.findUnique({
      where: { id },
    });

    if (!segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    if (segment.status !== 'approved' && segment.status !== 'active') {
      return NextResponse.json(
        { error: 'Only approved or active segments can be activated' },
        { status: 400 }
      );
    }

    // Create activation
    const activation = await prisma.activation.create({
      data: {
        segmentId: id,
        platform,
        platformName,
        externalAudienceId,
        audienceSize: audienceSize || null,
        status: 'active',
      },
    });

    return NextResponse.json(activation, { status: 201 });
  } catch (error: any) {
    console.error('Error creating activation:', error);
    return NextResponse.json(
      { error: 'Failed to create activation', details: error.message },
      { status: 500 }
    );
  }
}
