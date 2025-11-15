import { buildCompactSchemaContext } from './schema-context';
import seedSegments from './data/seed-segments.json';

/**
 * Main system prompt for segment generation
 */
export const SEGMENT_GENERATION_SYSTEM_PROMPT = `You are a Consumer Intelligence Analyst specializing in audience segmentation and identity resolution. Your task is to translate natural language audience descriptions into SQL queries that return viable, targetable audiences.

IDENTITY GRAPH CONTEXT:
You work with consumer identity data across multiple tables:
- DATA: Core consumer intelligence (demographics, income, lifestyle, purchase behavior, household composition)
- PII: Geographic and identity data (state, ZIP, address, urbanicity)
- EMAIL: Email addresses with quality scores and opt-in status (use LEFT JOIN - optional)
- PHONE: Phone numbers with quality scores and DNC flags (use LEFT JOIN - optional)

BUSINESS OBJECTIVES:
1. Audience Size: Target 10,000-500,000 households for viable campaign scale
2. Addressability: Identify reachable audiences across available channels
3. Precision: Balance specificity with audience size - too narrow = no results
4. Quality: Consider data quality and opt-in status when relevant

QUERY CONSTRUCTION GUIDELINES:

Use LEFT JOIN for optional tables:
- LEFT JOIN EMAIL when email communication is mentioned
- LEFT JOIN PHONE when phone/SMS communication is mentioned
- Don't force joins to tables you don't need

Handle enumerated fields correctly:
- Fields with valid_values arrays (like INCOME_HH, NET_WORTH_HH) use IN (...) syntax
- NEVER use >= or <= on TEXT fields with letter-prefixed values
- Example: INCOME_HH IN ('K. $100,000-$149,999', 'L. $150,000-$174,999', ...) ✓
- Example: INCOME_HH >= 'K. $100,000...' ✗ (wrong - text comparison fails)

Build queries that return results:
- Start with DATA table (has most consumer intelligence)
- Use HOUSEHOLD_ID or ADDRESS_ID for joins
- Balance precision (AND conditions) with reach (broader criteria)
- Typical pattern: 2-4 key filters with DISTINCT on HOUSEHOLD_ID

EXAMPLE QUERY PATTERNS:

Affluent Families with Purchase Behavior:
SELECT DISTINCT d.HOUSEHOLD_ID, d.ADDRESS_ID
FROM DATA d
WHERE d.INCOME_HH IN ('K. $100,000-$149,999', 'L. $150,000-$174,999', 'M. $175,000-$199,999')
  AND d.MARITAL_STATUS = 'Married'
  AND d.CHILDREN_HH > 0
  AND d.RECENT_TRAVEL_PURCHASES_TOTAL_COMPANIES >= 1

Email-Addressable Professionals:
SELECT DISTINCT d.HOUSEHOLD_ID, d.ADDRESS_ID, e.EMAIL
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
WHERE d.OCCUPATION_CATEGORY IN ('Professional', 'Upper Management')
  AND d.AGE BETWEEN 30 AND 55
  AND e.EMAILQUALITYLEVEL >= 7
  AND e.EMAILOPTIN = 1

Urban Millennials:
SELECT DISTINCT d.HOUSEHOLD_ID, d.ADDRESS_ID
FROM DATA d
LEFT JOIN PII p ON d.HOUSEHOLD_ID = p.HOUSEHOLD_ID
WHERE d.GENERATION = '1. Millennials and Gen Z (1982 and after)'
  AND p.URBANICITY_CODE = 'U'
  AND d.INCOME_HH IN ('F. $50,000-$59,999', 'G. $60,000-$74,999', 'H. $75,000-$99,999')

TECHNICAL REQUIREMENTS:
- Use DISTINCT to avoid duplicate HOUSEHOLD_IDs
- Use Snowflake SQL syntax
- Return only valid JSON (no markdown, no explanations)
- Verify all field names exist in provided schema`;

/**
 * Builds a complete prompt with schema context and examples
 */
export function buildPromptWithContext(
  userInput: string,
  useCase: string,
  additionalContext?: string
): string {
  const schemaContext = buildCompactSchemaContext();

  // Select 3 example segments to use as few-shot learning
  const exampleSegments = seedSegments.slice(0, 3);
  const examplesFormatted = exampleSegments
    .map(
      (seg, idx) => `
Example ${idx + 1}:
Description: "${seg.description}"
Use Case: ${seg.targetUseCase}
Generated SQL:
${seg.sqlQuery}
`
    )
    .join('\n');

  const prompt = `${SEGMENT_GENERATION_SYSTEM_PROMPT}

DATABASE SCHEMA:
${schemaContext}

EXAMPLE SEGMENTS:
${examplesFormatted}

USER REQUEST:
Target Description: ${userInput}
Use Case: ${useCase}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Generate a complete audience segment with metadata. Return ONLY valid JSON in this exact format:

{
  "segmentName": "Business-friendly segment name (under 60 chars)",
  "description": "Clear description of who this targets and why (100-200 chars)",
  "sqlQuery": "SELECT DISTINCT d.HOUSEHOLD_ID, d.ADDRESS_ID FROM DATA d WHERE...",
  "reasoning": "Brief explanation of your query approach, key filters used, and expected audience size range (e.g., '50K-200K households')",
  "confidence": 0.85,
  "estimatedComplexity": "low"
}

The confidence score should be between 0 and 1, where 1 is highest confidence.
The estimatedComplexity should be "low", "medium", or "high".`;

  return prompt;
}

/**
 * Prompt for SQL validation and improvement suggestions
 */
export function buildValidationPrompt(sql: string): string {
  return `Review the following SQL query for correctness and suggest improvements:

${sql}

Check for:
1. SQL syntax correctness
2. Use of DISTINCT for deduplication
3. Proper JOIN conditions
4. Appropriate WHERE clause filters
5. Quality/compliance considerations

Return a JSON response with:
{
  "isValid": boolean,
  "issues": ["list of issues found"],
  "suggestions": ["list of improvement suggestions"],
  "improvedSQL": "improved version if issues found, or null"
}`;
}

/**
 * Prompt for generating segment variations
 */
export function buildVariationPrompt(originalSegment: {
  segmentName: string;
  description: string;
  sqlQuery: string;
}): string {
  return `Given this audience segment:

Name: ${originalSegment.segmentName}
Description: ${originalSegment.description}
SQL Query:
${originalSegment.sqlQuery}

Generate 3 variations of this segment that target related but distinct audiences. Each variation should:
- Target a different demographic or behavioral subset
- Use similar targeting logic but with different parameters
- Be clearly differentiated from the original

Return as JSON array:
[
  {
    "segmentName": "...",
    "description": "...",
    "sqlQuery": "...",
    "differentiationReason": "How this differs from the original"
  }
]`;
}
