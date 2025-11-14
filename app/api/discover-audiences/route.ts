// app/api/discover-audiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCompactSchemaContext } from '@/lib/schema-context';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Builds the discovery-focused prompt for Claude
 */
function buildDiscoveryPrompt(
  businessGoal: string,
  useCase: string,
  additionalContext?: string
): string {
  const schemaContext = buildCompactSchemaContext();

  return `You are an expert Marketing Strategist with deep consumer intelligence expertise.

Given a business goal, suggest 3-5 creative audience segments that could help achieve it.
For each audience, provide a compelling marketing narrative and actionable targeting criteria.

BUSINESS GOAL: ${businessGoal}
USE CASE: ${useCase}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

DATABASE SCHEMA:
${schemaContext}

For each audience, think creatively about:
- Who they are (demographics + psychographics)
- What drives their decisions and behaviors
- How to reach them effectively through available channels
- Why they're valuable for achieving this business goal
- What data signals indicate they're part of this audience

IMPORTANT GUIDELINES:
1. Think beyond simple demographic cuts - create audiences with compelling stories
2. Ensure diversity in your suggestions (different strategies, not just variations)
3. Focus on actionable, measurable criteria from the available data
4. Consider email quality (EMAILQUALITYLEVEL >= 7), phone quality (PHONEQUALITYLEVEL >= 7)
5. Think about compliance (EMAILOPTIN, DNC flags)
6. Each audience should be meaningfully different from the others

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "audiences": [
    {
      "audienceName": "Creative, memorable name under 60 characters",
      "description": "Rich 2-3 sentence description painting a vivid picture of who they are and what makes them unique",
      "keyCharacteristics": [
        "Specific demographic or behavioral characteristic 1",
        "Specific demographic or behavioral characteristic 2",
        "Specific demographic or behavioral characteristic 3",
        "Specific demographic or behavioral characteristic 4"
      ],
      "marketingOpportunity": "Clear explanation of why this audience matters for the business goal and how to engage them effectively",
      "targetingCriteria": {
        "naturalLanguageInput": "Detailed technical description suitable for SQL generation - be specific about demographics, behaviors, quality thresholds, and data requirements",
        "useCase": "${useCase}",
        "additionalContext": "Additional targeting details and considerations for segment generation"
      }
    }
  ]
}

Generate 3-5 diverse audience ideas. Be creative and strategic.`;
}

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
