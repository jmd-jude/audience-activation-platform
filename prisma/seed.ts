import { PrismaClient } from '@prisma/client';
import seedSegments from '../lib/data/seed-segments.json';
import seedActivations from '../lib/data/seed-activations.json';
import { calculateMetrics } from '../lib/utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing segments (cascade will handle activations/metrics)
  await prisma.segment.deleteMany({});
  console.log('Cleared existing segments');

  // Insert seed segments and store mapping
  const segmentMap = new Map<string, string>();
  for (const segment of seedSegments) {
    const created = await prisma.segment.create({
      data: {
        segmentName: segment.segmentName,
        description: segment.description,
        targetUseCase: segment.targetUseCase,
        sqlQuery: segment.sqlQuery,
        status: segment.status,
        estimatedSize: segment.estimatedSize,
        approvedBy: segment.approvedBy,
        approvedAt: segment.approvedAt ? new Date(segment.approvedAt) : null,
      },
    });
    segmentMap.set(segment.segmentName, created.id);
  }

  console.log(`Seeded ${seedSegments.length} segments successfully`);

  // Insert activations and metrics
  let totalActivations = 0;
  let totalMetrics = 0;

  for (const segmentData of seedActivations as any[]) {
    const segmentId = segmentMap.get(segmentData.segmentName);
    if (!segmentId) {
      console.warn(`Segment not found: ${segmentData.segmentName}`);
      continue;
    }

    for (const activationData of segmentData.activations) {
      const activation = await prisma.activation.create({
        data: {
          segmentId,
          platform: activationData.platform,
          platformName: activationData.platformName,
          externalAudienceId: activationData.externalAudienceId,
          audienceSize: activationData.audienceSize,
          status: activationData.status,
          activatedAt: new Date(activationData.activatedAt),
        },
      });
      totalActivations++;

      for (const metricData of activationData.metrics) {
        // Calculate derived metrics
        const derived = calculateMetrics({
          impressions: metricData.impressions,
          clicks: metricData.clicks,
          conversions: metricData.conversions,
          spend: metricData.spend,
          revenue: metricData.revenue,
        });

        await prisma.performanceMetric.create({
          data: {
            activationId: activation.id,
            periodStart: new Date(metricData.periodStart),
            periodEnd: new Date(metricData.periodEnd),
            periodType: metricData.periodType,
            impressions: metricData.impressions,
            clicks: metricData.clicks,
            conversions: metricData.conversions,
            spend: metricData.spend,
            revenue: metricData.revenue,
            ctr: derived.ctr,
            cpa: derived.cpa,
            roas: derived.roas,
            conversionRate: derived.conversionRate,
            matchRate: metricData.matchRate,
            notes: metricData.notes || null,
          },
        });
        totalMetrics++;
      }
    }
  }

  console.log(`Seeded ${totalActivations} activations successfully`);
  console.log(`Seeded ${totalMetrics} performance metrics successfully`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
