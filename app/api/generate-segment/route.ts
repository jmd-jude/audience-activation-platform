// app/api/generate-segment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildPromptWithContext } from '@/lib/prompts';
import { validateSQL } from '@/lib/sql-validator';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naturalLanguageInput, useCase, additionalContext } = body;

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

    // Build prompt with schema context and examples
    const prompt = buildPromptWithContext(
      naturalLanguageInput,
      useCase,
      additionalContext
    );

    // Call Claude API
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
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
    let generatedSegment;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedSegment = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: responseText },
        { status: 500 }
      );
    }

    // Validate the generated SQL
    const validation = validateSQL(generatedSegment.sqlQuery || '');

    // Return generated segment with validation results
    return NextResponse.json({
      ...generatedSegment,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  } catch (error: any) {
    console.error('Error generating segment:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate segment',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
