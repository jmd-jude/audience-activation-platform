import {
  buildCompactSchemaContext,
  buildOptimizationRules,
  buildSemanticContext,
  buildStrategicPatternsContext,
  getTargetingPhilosophy
} from './schema-context';

/**
 * Main system prompt for segment generation
 */
export const SEGMENT_GENERATION_SYSTEM_PROMPT = `You are a Consumer Intelligence Analyst specializing in audience segmentation and identity resolution. Your task is to translate natural language audience descriptions into SQL queries that return viable, targetable audiences.

IDENTITY GRAPH CONTEXT:
You work with consumer identity data across 3 tables:
- DATA: Core consumer intelligence (demographics, income, lifestyle, purchase behavior, household composition, contactability flags)
- PII: Geographic and identity data (state, ZIP, address, urbanicity) — LEFT JOIN when geographic targeting is needed
- EMAIL: Email addresses with quality scores and opt-in status — always LEFT JOIN for MD5

NOTE: Phone contactability is tracked via DATA.HASPHONE (1 = has phone, 0 = no phone). There is NO separate PHONE table.

CRITICAL ENUMERATED FIELD RULES:
- ANY field with valid_values in the schema MUST use IN (...) syntax
- NEVER use >, <, >=, <= on fields with valid_values
- **ONLY use EXACT values from the valid_values array - NEVER paraphrase, abbreviate, or invent values**
- If a value doesn't match exactly, the query returns ZERO results
- Copy values character-for-character from the schema, including prefixes like "A.", "B.", etc.
- When mapping natural language to values (EXAMPLES ONLY. USED TO REINFORCE ENUMERATED FIELDS RULES):
  * "Middle income" → INCOME_HH IN ('F. $50,000-$59,999', 'G. $60,000-$74,999', 'H. $75,000-$99,999')
  * "Young adults" → AGE BETWEEN 18 AND 35 (AGE is numeric, not enumerated)
  * "Millennials" → GENERATION = '1. Millennials and Gen Z (1982 and after)'

CRITICAL - KEEP QUERIES SIMPLE, BUT ACTUALLY TARGETED:
- Use 3-4 WHERE conditions. This is both the target and the hard limit — not "up to 4," aim for 4 whenever the request supports it.
- Fewer than 3 conditions usually means the segment isn't actually defined — it's most of the file with a label on it. Treat 2 conditions as a signal you dropped a defining attribute you shouldn't have.
- Extract the PRIMARY audience definition (who they are at their core), but a "core" made of only income or only one lifestyle signal is rarely precise enough on its own — combine it with the next most defining trait.
- Ignore secondary qualifiers and nice-to-haves from the user's request, not primary ones. A well-scoped audience with 3-4 defining conditions beats both an unfiltered mega-segment and a tiny over-filtered niche.
- If the user mentions 6 attributes, pick the 3-4 most defining ones and omit the rest — not 2.
- Example: For "affluent married millennials in urban areas who travel and have premium cards":
  ✓ USE: INCOME_HH IN (...high values...) AND GENERATION = '1. Millennials...' AND MARITAL_STATUS = 'Married' AND URBANICITY_CODE = 'U'
  ✗ SKIP: travel purchases, premium card - these are secondary; but urbanicity stays, it's core to "urban areas"

CRITICAL - OPERATOR PRECEDENCE:
- SQL evaluates AND before OR. Any OR condition combined with AND conditions MUST be wrapped in parentheses.
- WRONG: WHERE INCOME_HH IN (...) AND GOLF_AFFINITY = 1 OR LUXURY_LIFE = 1
- RIGHT: WHERE INCOME_HH IN (...) AND (GOLF_AFFINITY = 1 OR LUXURY_LIFE = 1)
- If a segment combines a required attribute (income, generation, geography) with a set of interchangeable "OR" signals (any one of several affinities), the OR group must always be parenthesized as its own unit. Getting this wrong silently returns a mega-segment (nearly the whole file) instead of the intended narrow audience.

EXAMPLE QUERY PATTERN (AND-only):
SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
LEFT JOIN PII p ON d.HOUSEHOLD_ID = p.HOUSEHOLD_ID
WHERE d.GENERATION = '1. Millennials and Gen Z (1982 and after)'
  AND p.URBANICITY_CODE = 'U'
  AND d.INCOME_HH IN ('F. $50,000-$59,999', 'G. $60,000-$74,999', 'H. $75,000-$99,999')

EXAMPLE QUERY PATTERN (required attribute AND a parenthesized OR group):
For "affluent households interested in golf, financial news, or luxury living":
SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
WHERE d.INCOME_HH IN ('S. $500-$699K', 'T. $700-$999K', 'U. $1MM +')
  AND (d.GOLF_AFFINITY = 1 OR d.READING_FINANCE = 1 OR d.LUXURY_LIFE = 1)`;

/**
 * Builds a complete prompt with schema context and semantic intelligence
 * Uses schema-derived patterns instead of separate example files
 */
export function buildPromptWithContext(
  userInput: string,
  useCase: string,
  additionalContext?: string,
  clarificationQA?: Array<{ question: string; answer: string }>
): string {
  const schemaContext = buildCompactSchemaContext();
  const optimizationRules = buildOptimizationRules();
  const semanticContext = buildSemanticContext();
  const strategicPatterns = buildStrategicPatternsContext();
  const targetingPhilosophy = getTargetingPhilosophy();

  const isLookalike = useCase === 'Lookalike Audience';

  const taskContext = isLookalike
    ? `The user has described their IDEAL CUSTOMER PROFILE. Generate SQL to find LOOKALIKE audiences - households that share similar demographic, behavioral, and lifestyle characteristics but represent net-new prospects.

LOOKALIKE STRATEGY:
- Identify the core defining signals from the profile (income level, lifestyle indicators, purchase behaviors)
- Build queries that capture these patterns but cast a slightly wider net
- Focus on households with similar "signal clusters" not exact matches
- Frame the segment name and description as "Similar to..." or "Lookalike..."`
    : '';

  const prompt = `${SEGMENT_GENERATION_SYSTEM_PROMPT}

${taskContext}

${optimizationRules}

DATABASE SCHEMA:
${schemaContext}

${semanticContext}

${strategicPatterns}

${targetingPhilosophy ? `TARGETING PHILOSOPHY:\n${targetingPhilosophy}\n` : ''}

USER REQUEST:
${isLookalike ? 'Customer Profile' : 'Target Description'}: ${userInput}
Use Case: ${useCase}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}
${clarificationQA && clarificationQA.length > 0 ? `
CLARIFICATIONS PROVIDED:
${clarificationQA.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
` : ''}

Generate a complete audience segment with metadata. Return ONLY valid JSON in this exact format:

{
  "segmentName": "Business-friendly segment name (under 60 chars)",
  "description": "Clear description of who this targets and why (75-150 chars)",
  "sqlQuery": "SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5 FROM DATA d LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID WHERE...",
  "reasoning": "Brief explanation of your query approach and key filters used",
  "confidence": 0.85,
  "estimatedComplexity": "low"
}

The confidence score should be between 0 and 1, where 1 is highest confidence.
The estimatedComplexity should be "low", "medium", or "high".`;

  return prompt;
}

/**
 * Builds the prompt used to revise an existing audience query in response to
 * a plain-language adjustment request (e.g. "grow this a bit but keep it
 * focused on high-income households"). Reuses the same rules and schema
 * context as original generation — this is an edit, not a fresh build, and
 * should stay under the same discipline (3-4 conditions, no mega-segment,
 * parenthesized OR groups).
 */
export function buildQueryAdjustmentPrompt(
  currentQuery: string,
  currentCount: number | null,
  description: string,
  useCase: string,
  userInstruction: string
): string {
  const schemaContext = buildCompactSchemaContext();
  const optimizationRules = buildOptimizationRules();
  const semanticContext = buildSemanticContext();

  return `${SEGMENT_GENERATION_SYSTEM_PROMPT}

TASK:
A marketer is reviewing an existing audience query and wants it adjusted. Revise the query to follow their instruction below while staying true to the audience's original intent — do not drop the query's defining conditions just to hit a bigger number, and do not drift into a fundamentally different audience than the one described.

EXISTING AUDIENCE:
Description: ${description}
Use Case: ${useCase}
Current SQL: ${currentQuery}
Current Audience Size: ${currentCount !== null ? currentCount.toLocaleString() : 'not yet checked'}

USER'S REQUESTED ADJUSTMENT:
${userInstruction}

${optimizationRules}

DATABASE SCHEMA:
${schemaContext}

${semanticContext}

Return ONLY valid JSON in this exact format:
{
  "sqlQuery": "SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5 FROM DATA d LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID WHERE...",
  "changeSummary": "One or two plain sentences, written for a non-technical marketer, describing what changed and why."
}

If the requested adjustment doesn't map to a clear structural change (e.g. it's unrelated to audience targeting, or already satisfied), return the query unchanged and explain why in changeSummary.`;
}

export interface DiscoveryPromptInput {
  useCase: string;
  /** Manually typed goal (typed or "try an example" path). Omit when driven by a brief. */
  businessGoal?: string;
  /** Manually typed notes, only meaningful alongside businessGoal. */
  additionalContext?: string;
  /** Full text of an uploaded/pasted campaign brief (paste or .docx extraction). */
  briefText?: string;
  /** True when a PDF brief is attached as a document content block on the same message. */
  hasAttachedBriefDocument?: boolean;
}

/**
 * Builds the discovery-focused prompt for Claude
 * Used to generate 3-6 audience suggestions from a business goal — either
 * typed directly, or read from a full campaign brief (pasted, .docx text,
 * or a PDF attached alongside this prompt as a document content block).
 */
export function buildDiscoveryPrompt({
  useCase,
  businessGoal,
  additionalContext,
  briefText,
  hasAttachedBriefDocument,
}: DiscoveryPromptInput): string {
  const schemaContext = buildCompactSchemaContext();
  const optimizationRules = buildOptimizationRules();
  const semanticContext = buildSemanticContext();

  const isLookalike = useCase === 'Lookalike Audience';

  const modeInstructions = isLookalike
    ? `The user has described their IDEAL CUSTOMER PROFILE (their best existing customers). Your task is to generate 3-6 LOOKALIKE AUDIENCES that would be statistically similar to this profile.

LOOKALIKE OBJECTIVES:
- Find broader populations with similar demographic and behavioral patterns
- Expand beyond exact matches to discover net-new prospects who share core characteristics
- Use multiple signal combinations to replicate the profile's defining attributes
- Focus on audiences who HAVEN'T yet engaged with the user's brand

FRAMING: Frame each audience as "Similar to..." or "Expansion of..." rather than "People who are exactly..."
Example: "Affluent Travelers - Lookalike Expansion" not just "Affluent Travelers"

For each audience, explain HOW it matches the seed profile's key signals (income, lifestyle, purchase behavior) while representing new prospect territory.`
    : `Given a business goal, suggest 3-6 creative audience segments that could help achieve it.
For each audience, provide a compelling marketing narrative and actionable targeting criteria.`;

  const goalSection = briefText
    ? `CAMPAIGN BRIEF:\n${briefText}\n\nRead the full brief above and identify the ${isLookalike ? 'customer profile' : 'business goal(s)'} driving this campaign — including any useful context on budget, timing, competitive positioning, tone, or constraints — then generate audiences accordingly.`
    : hasAttachedBriefDocument
      ? `A campaign brief is attached to this message as a document. Read it in full and identify the ${isLookalike ? 'customer profile' : 'business goal(s)'} driving this campaign — including any useful context on budget, timing, competitive positioning, tone, or constraints — then generate audiences accordingly.`
      : `${isLookalike ? 'CUSTOMER PROFILE' : 'BUSINESS GOAL'}: ${businessGoal}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}`;

  return `You are an expert Marketing Strategist with deep consumer intelligence expertise.

${modeInstructions}

${goalSection}
USE CASE: ${useCase}

${optimizationRules}

DATABASE SCHEMA:
${schemaContext}

${semanticContext}

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
4. Consider email quality (EMAILQUALITYLEVEL >= 7)
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
        "naturalLanguageInput": "A clear, natural language description of this audience written from a marketing perspective. Describe WHO they are as people using everyday language (e.g., 'affluent professionals aged 40-60 who enjoy luxury travel') rather than database fields (e.g., 'AGE >= 40, INCOME >= 150000'). Focus on their demographics, lifestyle, interests, and behaviors in human terms.",
        "useCase": "${useCase}",
        "additionalContext": "Strategic insights about this audience's behaviors, preferences, and value (e.g., 'prefer email communication', 'responsive to premium brand messaging', 'high lifetime value potential')"
      },
      "semanticSignals": [
        {
          "field": "EXACT_FIELD_NAME_FROM_SCHEMA",
          "meaning": "What this field signals strategically for this audience",
          "role": "Why this field is key for this specific concept"
        }
      ]
    }
  ]
}

For semanticSignals: List 2-4 schema fields that are most central to this audience concept. Use the exact field name from the schema. For "meaning", draw from the marketing intelligence provided above (not just the field description). For "role", explain why this specific field matters for THIS audience concept specifically — not a generic definition.

Generate 3 diverse audience ideas. Be creative and strategic.`;
}