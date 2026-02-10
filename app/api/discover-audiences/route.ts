// app/api/discover-audiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildDiscoveryPrompt } from '@/lib/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let discoveryResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        discoveryResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
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
