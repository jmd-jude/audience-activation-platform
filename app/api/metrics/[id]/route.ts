import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateMetrics } from '@/lib/utils';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if metric exists
    const existingMetric = await prisma.performanceMetric.findUnique({
      where: { id },
    });

    if (!existingMetric) {
      return NextResponse.json(
        { error: 'Metric not found' },
        { status: 404 }
      );
    }

    // Build update data (only include provided fields)
    const updateData: any = {};

    if (body.periodStart !== undefined) updateData.periodStart = new Date(body.periodStart);
    if (body.periodEnd !== undefined) updateData.periodEnd = new Date(body.periodEnd);
    if (body.periodType !== undefined) updateData.periodType = body.periodType;
    if (body.impressions !== undefined) updateData.impressions = body.impressions || null;
    if (body.clicks !== undefined) updateData.clicks = body.clicks || null;
    if (body.conversions !== undefined) updateData.conversions = body.conversions || null;
    if (body.spend !== undefined) updateData.spend = body.spend || null;
    if (body.revenue !== undefined) updateData.revenue = body.revenue || null;
    if (body.matchRate !== undefined) updateData.matchRate = body.matchRate || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    // Validate date range if both dates are being updated
    if (updateData.periodStart && updateData.periodEnd) {
      if (updateData.periodEnd <= updateData.periodStart) {
        return NextResponse.json(
          { error: 'periodEnd must be after periodStart' },
          { status: 400 }
        );
      }
    }

    // Recalculate derived metrics with updated values
    const metricsForCalculation = {
      impressions: updateData.impressions !== undefined ? updateData.impressions : existingMetric.impressions,
      clicks: updateData.clicks !== undefined ? updateData.clicks : existingMetric.clicks,
      conversions: updateData.conversions !== undefined ? updateData.conversions : existingMetric.conversions,
      spend: updateData.spend !== undefined ? updateData.spend : existingMetric.spend,
      revenue: updateData.revenue !== undefined ? updateData.revenue : existingMetric.revenue,
    };

    const derived = calculateMetrics(metricsForCalculation);

    // Add derived metrics to update data
    updateData.ctr = derived.ctr;
    updateData.cpa = derived.cpa;
    updateData.roas = derived.roas;
    updateData.conversionRate = derived.conversionRate;

    // Update metric
    const metric = await prisma.performanceMetric.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(metric);
  } catch (error: any) {
    console.error('Error updating metric:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Metric not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update metric', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete metric
    await prisma.performanceMetric.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Metric deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting metric:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Metric not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete metric', details: error.message },
      { status: 500 }
    );
  }
}
