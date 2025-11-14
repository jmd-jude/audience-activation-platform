// app/api/snowflake/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSnowflakeConnection } from '@/lib/snowflake';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sqlQuery, preview = false, maxRows = 1000 } = body;

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    // Create connection
    const snowflake = createSnowflakeConnection();

    try {
      // If preview mode, add LIMIT to query
      let queryToExecute = sqlQuery.trim();

      if (preview) {
        // Add LIMIT if not already present
        if (!queryToExecute.toLowerCase().includes('limit')) {
          queryToExecute = `${queryToExecute} LIMIT ${maxRows}`;
        }
      }

      console.log('Executing query:', queryToExecute);

      // Execute the query
      const result = await snowflake.executeQuery(queryToExecute);

      // Return structured response
      return NextResponse.json({
        success: true,
        data: {
          rows: result.rows,
          columns: result.columns,
          rowCount: result.rowCount,
          executionTime: result.executionTime,
          queryId: result.queryId,
          isPreview: preview
        }
      });

    } catch (queryError: any) {
      console.error('Query execution error:', queryError);

      return NextResponse.json(
        {
          error: 'Query execution failed',
          details: queryError.message || 'Unknown error',
          success: false
        },
        { status: 400 }
      );
    } finally {
      // Always cleanup connection
      await snowflake.disconnect();
    }

  } catch (error: any) {
    console.error('API route error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS if needed
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
