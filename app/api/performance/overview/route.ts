import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get all activations with their metrics
    const activations = await prisma.activation.findMany({
      include: {
        metrics: true,
      },
    });

    // Calculate aggregate stats
    let totalActivations = activations.length;
    let activeActivations = activations.filter(a => a.status === 'active').length;
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalImpressions = 0;
    let totalConversions = 0;

    activations.forEach(activation => {
      activation.metrics.forEach(metric => {
        if (metric.spend) totalSpend += metric.spend;
        if (metric.revenue) totalRevenue += metric.revenue;
        if (metric.impressions) totalImpressions += metric.impressions;
        if (metric.conversions) totalConversions += metric.conversions;
      });
    });

    const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    return NextResponse.json({
      totalActivations,
      activeActivations,
      totalSpend,
      totalRevenue,
      totalImpressions,
      totalConversions,
      avgROAS,
    });
  } catch (error: any) {
    console.error('Error fetching performance overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance overview', details: error.message },
      { status: 500 }
    );
  }
}
