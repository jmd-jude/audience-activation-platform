import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { USE_CASES } from '@/lib/constants';

export async function GET() {
  try {
    // Get distinct use cases from database
    const dbUseCases = await prisma.segment.findMany({
      select: { targetUseCase: true },
      distinct: ['targetUseCase'],
    });

    // Create a set of canonical use cases (case-insensitive)
    const canonicalSet = new Set(
      USE_CASES.map(uc => uc.toLowerCase())
    );

    // Merge: Start with canonical list, add any DB values not in canonical
    const merged = [...USE_CASES];

    dbUseCases.forEach(dbUseCase => {
      const lowerCaseUseCase = dbUseCase.targetUseCase.toLowerCase();
      if (!canonicalSet.has(lowerCaseUseCase)) {
        // Add use cases that exist in DB but not in canonical list
        merged.push(dbUseCase.targetUseCase);
      }
    });

    return NextResponse.json(merged);
  } catch (error: any) {
    console.error('Error fetching use cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch use cases', details: error.message },
      { status: 500 }
    );
  }
}
