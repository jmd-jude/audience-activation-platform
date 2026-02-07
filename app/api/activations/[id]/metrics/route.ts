import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateMetrics } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = searchParams.get('periodType');

    // Check if activation exists
    const activation = await prisma.activation.findUnique({
      where: { id },
    });

    if (!activation) {
      return NextResponse.json(
        { error: 'Activation not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = { activationId: id };

    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) where.periodStart.gte = new Date(startDate);
      if (endDate) where.periodStart.lte = new Date(endDate);
    }

    if (periodType) {
      where.periodType = periodType;
    }

    // Get all metrics for the activation
    const metrics = await prisma.performanceMetric.findMany({
      where,
      orderBy: { periodStart: 'desc' },
    });

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      periodStart,
      periodEnd,
      periodType = 'custom',
      impressions,
      clicks,
      conversions,
      spend,
      revenue,
      matchRate,
      notes,
    } = body;

    // Validate required fields
    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: periodStart, periodEnd' },
        { status: 400 }
      );
    }

    // Check if activation exists
    const activation = await prisma.activation.findUnique({
      where: { id },
    });

    if (!activation) {
      return NextResponse.json(
        { error: 'Activation not found' },
        { status: 404 }
      );
    }

    // Validate date range
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (end <= start) {
      return NextResponse.json(
        { error: 'periodEnd must be after periodStart' },
        { status: 400 }
      );
    }

    // Calculate derived metrics
    const derived = calculateMetrics({
      impressions,
      clicks,
      conversions,
      spend,
      revenue,
    });

    // Create performance metric
    const metric = await prisma.performanceMetric.create({
      data: {
        activationId: id,
        periodStart: start,
        periodEnd: end,
        periodType,
        impressions: impressions || null,
        clicks: clicks || null,
        conversions: conversions || null,
        spend: spend || null,
        revenue: revenue || null,
        ctr: derived.ctr,
        cpa: derived.cpa,
        roas: derived.roas,
        conversionRate: derived.conversionRate,
        matchRate: matchRate || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(metric, { status: 201 });
  } catch (error: any) {
    console.error('Error creating metric:', error);
    return NextResponse.json(
      { error: 'Failed to create metric', details: error.message },
      { status: 500 }
    );
  }
}
