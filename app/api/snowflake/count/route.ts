// app/api/snowflake/count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSnowflakeConnection } from '@/lib/snowflake';

export async function POST(request: NextRequest) {
  try {
    const { sqlQuery } = await request.json();

    if (!sqlQuery) {
      return NextResponse.json(
        { success: false, error: 'SQL query is required' },
        { status: 400 }
      );
    }

    console.log('Validating audience with query:', sqlQuery);

    const snowflake = createSnowflakeConnection();

    try {
      const countQuery = `
        WITH segment_base AS (
          ${sqlQuery}
        )
        SELECT COUNT(*) as audience_size FROM segment_base
      `;
      const sampleQuery = `${sqlQuery} LIMIT 10`;

      console.log('Executing count and sample queries in parallel...');
      const [countResult, sampleResult] = await Promise.all([
        snowflake.executeQuery(countQuery),
        snowflake.executeQuery(sampleQuery)
      ]);
      const audienceSize = countResult.rows[0]?.AUDIENCE_SIZE || 0;

      console.log(`Audience size: ${audienceSize}, sample rows: ${sampleResult.rowCount}`);

      return NextResponse.json({
        success: true,
        validation: {
          audienceSize,
          executionTime: countResult.executionTime + sampleResult.executionTime,
          queryId: countResult.queryId,
          sampleData: {
            columns: sampleResult.columns,
            rows: sampleResult.rows,
            rowCount: sampleResult.rowCount
          }
        }
      });

    } finally {
      await snowflake.disconnect();
    }

  } catch (error) {
    console.error('Audience validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
