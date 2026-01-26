import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('/tmp/segments_export.json', 'utf-8'));

  console.log(`Migrating ${data.length} segments...`);

  for (const segment of data) {
    await prisma.segment.upsert({
      where: { id: segment.id },
      update: {},
      create: {
        id: segment.id,
        segmentName: segment.segmentName,
        description: segment.description,
        targetUseCase: segment.targetUseCase,
        sqlQuery: segment.sqlQuery,
        status: segment.status,
        createdBy: segment.createdBy,
        createdAt: new Date(segment.createdAt),
        updatedAt: new Date(segment.updatedAt),
        usageCount: segment.usageCount,
        lastUsed: segment.lastUsed ? new Date(segment.lastUsed) : null,
        estimatedSize: segment.estimatedSize,
        approvedBy: segment.approvedBy,
        approvedAt: segment.approvedAt ? new Date(segment.approvedAt) : null,
      },
    });
    console.log(`  ✓ ${segment.segmentName}`);
  }

  console.log('\nMigration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
