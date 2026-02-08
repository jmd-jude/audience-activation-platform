// app/api/clarify-segment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildCompactSchemaContext } from '@/lib/schema-context';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const CLARIFICATION_SYSTEM_PROMPT_BASE = `You are a Consumer Intelligence Analyst helping users define audience segments. Your task is to analyze a user's audience description and determine if clarification would significantly improve the SQL generation.

You have access to the complete data schema showing available fields, data types, and valid values. Use this schema knowledge to:
1. Identify when user terms are vague relative to actual schema fields
2. Suggest clarifications using ACTUAL field values from the schema
3. Map natural language to queryable attributes

ANALYSIS CRITERIA:
1. **Ambiguity in Scope**: Are key demographic filters unclear or too broad? (e.g., "young" without age range, "high income" without specific brackets from INCOME_HH field)
2. **Missing Channel Intent**: Is the communication channel unclear when it matters? (email vs phone vs multi-channel - check EMAIL table availability, HASPHONE flag)
3. **Geographic Uncertainty**: Is location mentioned but not specified? (e.g., "urban areas" without states/regions - check PII table fields)
4. **Behavioral Specificity**: Are behavioral patterns mentioned but need quantification? (e.g., "frequent travelers" - check RECENT_TRAVEL_PURCHASES fields)

CRITICAL: Use schema field names and valid values in your questions. If INCOME_HH has specific brackets, offer those exact values as options.

WHEN TO CLARIFY:
- Ask questions ONLY when the answer would materially change the SQL query
- DO NOT ask about: minor details, already-clear inputs, or non-critical nuances
- Prefer 1 question (max 2) - keep it focused
- Base questions on ACTUAL schema fields, not generic assumptions

WHEN NOT TO CLARIFY:
- User input is specific enough to generate a viable query
- Reasonable defaults can be inferred from context
- The ambiguity is minor and won't significantly impact results

OUTPUT FORMAT:
Return JSON only (no markdown):

If clarification is NOT needed:
{
  "needsClarification": false
}

If clarification IS needed:
{
  "needsClarification": true,
  "questions": [
    {
      "id": "q1",
      "question": "Which income brackets define 'affluent' for this campaign?",
      "options": ["$100K-$150K", "$150K-$250K", "$250K-$500K", "$500K+"],
      "rationale": "INCOME_HH field drives precision - affects audience size 2-10x"
    }
  ]
}

Guidelines for questions:
- Keep questions concise (under 100 chars)
- Provide 3-4 concrete options when possible (use actual schema values)
- Include brief rationale explaining why this matters
- Focus on decisions that change the query structure or filters`;

/**
 * Builds the clarification prompt with schema context
 */
function buildClarificationPrompt(): string {
  const schemaContext = buildCompactSchemaContext();

  return `${CLARIFICATION_SYSTEM_PROMPT_BASE}

DATABASE SCHEMA:
${schemaContext}

Use the schema above to inform your clarification decisions. Reference actual field names and valid values when asking questions.`;
}

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

    console.log('Analyzing input for clarification needs:', { naturalLanguageInput, useCase });

    // Build the full prompt with schema context
    const systemPrompt = buildClarificationPrompt();

    // Build the user request
    const userPrompt = `Analyze this audience segment request and determine if clarification would significantly improve SQL generation:

Target Description: ${naturalLanguageInput}
Use Case: ${useCase}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Consider:
- Is the demographic scope clear enough to write SQL given the available schema fields?
- Are there ambiguous terms that could map to multiple schema values?
- Would asking 1-2 questions materially improve the query?
- Can you suggest options using actual field values from the schema?

Return your analysis as JSON (needsClarification and questions if applicable).`;

    // Call Claude API for clarification analysis
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${userPrompt}`,
        },
      ],
    });

    // Extract response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let clarificationResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        clarificationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      console.error('Failed to parse Claude clarification response:', responseText);
      // If parsing fails, default to no clarification needed
      return NextResponse.json({
        needsClarification: false,
      });
    }

    console.log('Clarification analysis result:', clarificationResult);

    return NextResponse.json(clarificationResult);

  } catch (error) {
    console.error('Clarification analysis error:', error);

    // Gracefully degrade - if clarification check fails, just skip it
    return NextResponse.json({
      needsClarification: false,
    });
  }
}
