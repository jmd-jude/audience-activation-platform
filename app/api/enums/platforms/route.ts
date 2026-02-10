import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PLATFORMS } from '@/lib/constants';

export async function GET() {
  try {
    // Get distinct platforms from database
    const dbPlatforms = await prisma.activation.findMany({
      select: { platform: true, platformName: true },
      distinct: ['platform'],
    });

    // Create a map of canonical platforms by value
    const canonicalMap = new Map(
      PLATFORMS.map(p => [p.value, p])
    );

    // Merge: Start with canonical list, add any DB values not in canonical
    const merged = [...PLATFORMS];

    dbPlatforms.forEach(dbPlatform => {
      if (!canonicalMap.has(dbPlatform.platform)) {
        // Add platforms that exist in DB but not in canonical list
        merged.push({
          value: dbPlatform.platform,
          label: dbPlatform.platformName || dbPlatform.platform,
        });
      }
    });

    return NextResponse.json(merged);
  } catch (error: any) {
    console.error('Error fetching platforms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platforms', details: error.message },
      { status: 500 }
    );
  }
}
