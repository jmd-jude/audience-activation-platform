// app/api/generate-segment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSnowflakeConnection } from '@/lib/snowflake';
import { buildPromptWithContext } from '@/lib/prompts';
import { validateSQL } from '@/lib/sql-validator';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '@/lib/anthropic';
import { GENERATE_SEGMENT_RESPONSE_SCHEMA } from '@/lib/response-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naturalLanguageInput, useCase, additionalContext, executeQuery = false, clarificationQA } = body;

    // Validation
    if (!naturalLanguageInput || !useCase) {
      return NextResponse.json(
        { error: 'Missing required fields: naturalLanguageInput and useCase' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    console.log('Generating segment:', { naturalLanguageInput, useCase, executeQuery });

    // Step 1: Generate SQL using Claude
    const prompt = buildPromptWithContext(
      naturalLanguageInput,
      useCase,
      additionalContext,
      clarificationQA
    );

    // Call Claude API
    const { message, truncated } = await createMessageWithTruncationRetry({
      model: getAnthropicModel(),
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: GENERATE_SEGMENT_RESPONSE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    if (truncated) {
      console.error('Claude response was truncated (max_tokens reached) even after retry.');
      return NextResponse.json(
        { error: 'AI response was truncated. Please try again.' },
        { status: 500 }
      );
    }

    // Extract response
    const responseText = extractText(message);

    // Structured outputs guarantee schema-valid JSON — parse directly.
    let generatedSegment;
    try {
      generatedSegment = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Claude response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: responseText },
        { status: 500 }
      );
    }

    // Validate the generated SQL using existing validator
    const validation = validateSQL(generatedSegment.sqlQuery || '');

    // Step 2: If executeQuery is true, run against Snowflake
    let executionResults = null;
    let actualSegmentSize = null;
    let snowflakeValidation = null;

    if (executeQuery && generatedSegment.sqlQuery && validation.isValid) {
      const snowflake = createSnowflakeConnection();

      try {
        // First validate the query against Snowflake
        console.log('Validating generated SQL against Snowflake...');
        snowflakeValidation = await snowflake.validateQuery(generatedSegment.sqlQuery);

        if (snowflakeValidation.isValid) {
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

          // Debug logging for zero-result queries
          if (actualSegmentSize === 0) {
            console.warn('⚠️ ZERO RESULTS - Debugging info:');
            console.warn('Generated SQL:', generatedSegment.sqlQuery);
            console.warn('User input:', naturalLanguageInput);
            console.warn('Use case:', useCase);
            if (additionalContext) {
              console.warn('Additional context:', additionalContext);
            }
          }

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

      } catch (executionError: any) {
        console.error('Query execution failed:', executionError);
        snowflakeValidation = {
          isValid: false,
          errors: [executionError.message || 'Unknown execution error'],
          warnings: []
        };
      } finally {
        await snowflake.disconnect();
      }
    }

    // Step 3: Return response (enhanced if executeQuery was true)
    return NextResponse.json({
      ...generatedSegment,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        snowflake: snowflakeValidation
      },
      execution: executionResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Segment generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate segment',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
