// app/api/generate-segment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildPromptWithContext } from '@/lib/prompts';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '@/lib/anthropic';
import { GENERATE_SEGMENT_RESPONSE_SCHEMA } from '@/lib/response-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naturalLanguageInput, useCase, additionalContext, clarificationQA } = body;

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

    console.log('Generating segment:', { naturalLanguageInput, useCase });

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

    // Return response — audience counting happens separately via
    // /api/snowflake/count ("Generate Counts" button), not inline here.
    return NextResponse.json({
      ...generatedSegment,
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
