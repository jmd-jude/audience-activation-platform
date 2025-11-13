// app/api/snowflake/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSnowflakeConnection } from '@/lib/snowflake';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sqlQuery } = body;

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    console.log('Validating query:', sqlQuery);

    // Create connection
    const snowflake = createSnowflakeConnection();
    
    try {
      // Validate the query using EXPLAIN
      const validation = await snowflake.validateQuery(sqlQuery);

      // Additional validation checks
      const additionalChecks = performAdditionalValidation(sqlQuery);

      return NextResponse.json({
        success: true,
        validation: {
          ...validation,
          warnings: [...validation.warnings, ...additionalChecks.warnings],
          suggestions: additionalChecks.suggestions
        }
      });

    } catch (validationError) {
      console.error('Validation error:', validationError);
      
      return NextResponse.json({
        success: false,
        validation: {
          isValid: false,
          errors: [validationError.message],
          warnings: [],
          suggestions: []
        }
      });
    } finally {
      // Always cleanup connection
      await snowflake.disconnect();
    }

  } catch (error) {
    console.error('Validation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: error.message,
        success: false
      },
      { status: 500 }
    );
  }
}

/**
 * Perform additional validation checks beyond syntax
 */
function performAdditionalValidation(sqlQuery: string) {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  const queryLower = sqlQuery.toLowerCase();
  
  // Check for DISTINCT usage (recommended for audience segments)
  if (!queryLower.includes('distinct')) {
    warnings.push('Consider using DISTINCT to avoid duplicate records');
    suggestions.push('Add DISTINCT to your SELECT clause for deduplication');
  }
  
  // Check for JOIN conditions
  if (queryLower.includes('join') && !queryLower.includes('on ')) {
    warnings.push('JOIN detected without explicit ON condition');
    suggestions.push('Ensure all JOINs have proper ON conditions');
  }
  
  // Check for date filters for performance
  if (!queryLower.includes('date') && !queryLower.includes('created') && !queryLower.includes('last')) {
    suggestions.push('Consider adding date filters to improve query performance');
  }
  
  // Check for very broad queries
  if (!queryLower.includes('where') && !queryLower.includes('having')) {
    warnings.push('Query has no filters - this may return a very large result set');
    suggestions.push('Add WHERE clause to filter results for better performance');
  }
  
  // Check for quality filters (common in audience segmentation)
  if (queryLower.includes('email') && !queryLower.includes('quality')) {
    suggestions.push('Consider adding email quality filters for better targeting');
  }
  
  if (queryLower.includes('phone') && !queryLower.includes('dnc')) {
    suggestions.push('Consider checking DNC (Do Not Call) status for phone targeting');
  }
  
  return { warnings, suggestions };
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
