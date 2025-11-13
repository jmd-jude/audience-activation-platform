// app/api/generate-segment-enhanced/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSnowflakeConnection } from '@/lib/snowflake';

// Import your existing prompt building functions
import { buildPromptWithContext } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naturalLanguageInput, useCase, additionalContext, executeQuery = false } = body;

    if (!naturalLanguageInput) {
      return NextResponse.json(
        { error: 'Natural language input is required' },
        { status: 400 }
      );
    }

    console.log('Generating enhanced segment:', { naturalLanguageInput, useCase, executeQuery });

    // Step 1: Generate SQL using existing AI logic
    const prompt = buildPromptWithContext(naturalLanguageInput, useCase, additionalContext);
    
    // Call your LLM (Anthropic/Claude) to generate the segment
    // This part uses your existing generation logic
    const response = await fetch('http://localhost:3001/api/generate-segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naturalLanguageInput, useCase, additionalContext })
    });

    if (!response.ok) {
      throw new Error('Failed to generate segment');
    }

    const generatedSegment = await response.json();

    // Step 2: If executeQuery is true, actually run the query against Snowflake
    let executionResults = null;
    let actualSegmentSize = null;
    let validationResults = null;

    if (executeQuery && generatedSegment.sqlQuery) {
      const snowflake = createSnowflakeConnection();
      
      try {
        // First validate the query
        console.log('Validating generated SQL...');
        validationResults = await snowflake.validateQuery(generatedSegment.sqlQuery);
        
        if (validationResults.isValid) {
          // Execute a count query to get actual segment size
          const countQuery = `
            WITH segment_base AS (
              ${generatedSegment.sqlQuery}
            )
            SELECT COUNT(*) as segment_size FROM segment_base
          `;
          
          console.log('Executing count query for segment size...');
          const countResult = await snowflake.executeQuery(countQuery);
          actualSegmentSize = countResult.rows[0]?.SEGMENT_SIZE || 0;
          
          // Execute a preview query to get sample data
          const previewQuery = `${generatedSegment.sqlQuery} LIMIT 10`;
          
          console.log('Executing preview query...');
          const previewResult = await snowflake.executeQuery(previewQuery);
          
          executionResults = {
            actualSize: actualSegmentSize,
            sampleData: previewResult.rows,
            columns: previewResult.columns,
            executionTime: previewResult.executionTime
          };
          
          console.log(`Segment analysis complete: ${actualSegmentSize} records found`);
        }
        
      } catch (executionError) {
        console.error('Query execution failed:', executionError);
        validationResults = {
          isValid: false,
          errors: [executionError.message],
          warnings: []
        };
      } finally {
        await snowflake.disconnect();
      }
    }

    // Step 3: Return enhanced response
    return NextResponse.json({
      ...generatedSegment,
      validation: validationResults,
      execution: executionResults,
      enhanced: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Enhanced segment generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Segment generation failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Utility function to analyze segment characteristics
 */
async function analyzeSegmentCharacteristics(sqlQuery: string, snowflake: any) {
  try {
    // Run additional analysis queries to understand segment composition
    const analysisQuery = `
      WITH segment_base AS (
        ${sqlQuery}
      ),
      segment_with_demographics AS (
        SELECT 
          sb.*,
          d.AGE,
          d.GENDER,
          d.INCOME_RANGE,
          d.GENERATION
        FROM segment_base sb
        LEFT JOIN DATA d ON sb.HOUSEHOLD_ID = d.HOUSEHOLD_ID
      )
      SELECT 
        COUNT(*) as total_count,
        AVG(AGE) as avg_age,
        COUNT(CASE WHEN GENDER = 'M' THEN 1 END) as male_count,
        COUNT(CASE WHEN GENDER = 'F' THEN 1 END) as female_count,
        COUNT(CASE WHEN GENERATION = 'Millennial' THEN 1 END) as millennial_count,
        COUNT(CASE WHEN GENERATION = 'Gen X' THEN 1 END) as genx_count,
        COUNT(CASE WHEN GENERATION = 'Baby Boomer' THEN 1 END) as boomer_count
      FROM segment_with_demographics
    `;
    
    const result = await snowflake.executeQuery(analysisQuery);
    return result.rows[0];
    
  } catch (error) {
    console.log('Segment analysis failed, continuing without demographics:', error.message);
    return null;
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
