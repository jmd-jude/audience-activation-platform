// app/api/discover-audiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { buildDiscoveryPrompt } from '@/lib/prompts';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '@/lib/anthropic';
import { DISCOVERY_RESPONSE_SCHEMA } from '@/lib/response-schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessGoal, useCase, additionalContext } = body;

    // Validation
    if (!businessGoal || !useCase) {
      return NextResponse.json(
        { error: 'Missing required fields: businessGoal and useCase' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    console.log('Discovering audiences for:', { businessGoal, useCase });

    // Build discovery prompt
    const prompt = buildDiscoveryPrompt(businessGoal, useCase, additionalContext);

    // Call Claude API
    const { message, truncated } = await createMessageWithTruncationRetry({
      model: getAnthropicModel(),
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: DISCOVERY_RESPONSE_SCHEMA } },
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
    let discoveryResult;
    try {
      discoveryResult = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Claude response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: responseText },
        { status: 500 }
      );
    }

    // Add unique IDs to each audience
    if (discoveryResult.audiences && Array.isArray(discoveryResult.audiences)) {
      discoveryResult.audiences = discoveryResult.audiences.map((audience: unknown, index: number) => ({
        ...(audience as Record<string, unknown>),
        id: `${Date.now()}-${index}`,
      }));
    }

    // Return response
    return NextResponse.json({
      audiences: discoveryResult.audiences || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Audience discovery error:', error);

    return NextResponse.json(
      {
        error: 'Failed to discover audiences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
