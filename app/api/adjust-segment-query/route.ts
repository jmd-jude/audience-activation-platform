// app/api/adjust-segment-query/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildQueryAdjustmentPrompt } from '@/lib/prompts';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '@/lib/anthropic';
import { ADJUST_QUERY_RESPONSE_SCHEMA } from '@/lib/response-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sqlQuery, currentCount, description, useCase, instruction } = body;

    if (!sqlQuery || !instruction) {
      return NextResponse.json(
        { error: 'Missing required fields: sqlQuery and instruction' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const prompt = buildQueryAdjustmentPrompt(
      sqlQuery,
      typeof currentCount === 'number' ? currentCount : null,
      description || '',
      useCase || '',
      instruction
    );

    const { message, truncated } = await createMessageWithTruncationRetry({
      model: getAnthropicModel(),
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: ADJUST_QUERY_RESPONSE_SCHEMA } },
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

    const responseText = extractText(message);

    let adjustResult;
    try {
      adjustResult = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Claude response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sqlQuery: adjustResult.sqlQuery,
      changeSummary: adjustResult.changeSummary,
    });

  } catch (error) {
    console.error('Query adjustment error:', error);

    return NextResponse.json(
      {
        error: 'Failed to adjust query',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
