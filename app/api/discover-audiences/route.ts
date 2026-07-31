// app/api/discover-audiences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { buildDiscoveryPrompt } from '@/lib/prompts';
import { getAnthropicModel, createMessageWithTruncationRetry, extractText } from '@/lib/anthropic';
import { DISCOVERY_RESPONSE_SCHEMA } from '@/lib/response-schemas';
import type Anthropic from '@anthropic-ai/sdk';

// mammoth relies on Node internals (Buffer/zlib) and isn't Edge-compatible.
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const useCase = formData.get('useCase') as string | null;
    const businessGoal = (formData.get('businessGoal') as string | null)?.trim();
    const additionalContext = (formData.get('additionalContext') as string | null)?.trim();
    const briefTextField = (formData.get('briefText') as string | null)?.trim();
    const file = formData.get('file');
    const hasFile = file instanceof File && file.size > 0;

    if (!useCase) {
      return NextResponse.json(
        { error: 'Missing required field: useCase' },
        { status: 400 }
      );
    }

    if (!businessGoal && !briefTextField && !hasFile) {
      return NextResponse.json(
        { error: 'Provide a business goal or a campaign brief' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    let pdfBase64: string | undefined;
    let briefText: string | undefined = briefTextField || undefined;

    if (hasFile) {
      const uploadedFile = file as File;
      const buffer = Buffer.from(await uploadedFile.arrayBuffer());

      if (uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        pdfBase64 = buffer.toString('base64');
      } else if (
        uploadedFile.type.includes('wordprocessingml') ||
        uploadedFile.name.toLowerCase().endsWith('.docx')
      ) {
        try {
          const { value } = await mammoth.extractRawText({ buffer });
          briefText = value;
        } catch (err) {
          console.error('Failed to parse .docx file:', err);
          return NextResponse.json(
            { error: 'Could not read the Word document. It may be corrupted or in an unsupported format.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Unsupported file type. Upload a PDF or Word (.docx) document.' },
          { status: 400 }
        );
      }
    }

    console.log('Discovering audiences for:', {
      useCase,
      source: pdfBase64 ? 'pdf' : briefText ? 'brief-text' : 'manual',
    });

    const prompt = buildDiscoveryPrompt({
      useCase,
      businessGoal: briefText || pdfBase64 ? undefined : businessGoal,
      additionalContext: briefText || pdfBase64 ? undefined : additionalContext,
      briefText: pdfBase64 ? undefined : briefText,
      hasAttachedBriefDocument: !!pdfBase64,
    });

    const content: Anthropic.MessageParam['content'] = pdfBase64
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: prompt },
        ]
      : prompt;

    const { message, truncated } = await createMessageWithTruncationRetry({
      model: getAnthropicModel(),
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: DISCOVERY_RESPONSE_SCHEMA } },
      messages: [
        {
          role: 'user',
          content,
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
