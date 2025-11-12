import { PrismaClient } from '@prisma/client';
import seedSegments from '../lib/data/seed-segments.json';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing segments
  await prisma.segment.deleteMany({});
  console.log('Cleared existing segments');

  // Insert seed segments
  for (const segment of seedSegments) {
    await prisma.segment.create({
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
  }

  console.log(`Seeded ${seedSegments.length} segments successfully`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
