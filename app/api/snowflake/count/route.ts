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
      // Step 1: Get COUNT(*)
      const countQuery = `
        WITH segment_base AS (
          ${sqlQuery}
        )
        SELECT COUNT(*) as audience_size FROM segment_base
      `;

      console.log('Executing count query...');
      const countResult = await snowflake.executeQuery(countQuery);
      const audienceSize = countResult.rows[0]?.AUDIENCE_SIZE || 0;

      console.log(`Audience size: ${audienceSize}`);

      // Step 2: Get sample data (first 10 records)
      const sampleQuery = `${sqlQuery} LIMIT 10`;

      console.log('Executing sample query...');
      const sampleResult = await snowflake.executeQuery(sampleQuery);

      console.log(`Sample data retrieved: ${sampleResult.rowCount} rows`);

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
