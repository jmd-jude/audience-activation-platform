import { buildCompactSchemaContext } from './schema-context';
import seedSegments from './data/seed-segments.json';

/**
 * Main system prompt for segment generation
 */
export const SEGMENT_GENERATION_SYSTEM_PROMPT = `You are an expert data analyst working with a consumer identity graph database. Your task is to convert natural language segment requests into precise SQL queries.

You have access to a comprehensive identity graph with the following tables:
- PII: Personal Identifiable Information (names, addresses, demographics)
- EMAIL: Email addresses with quality scores and opt-in status
- PHONE: Phone numbers with DNC flags and quality levels
- DATA: Demographic and behavioral attributes
- BEHAVIORS: Consumer behavior patterns and interests
- MAIDS: Mobile Advertising IDs and device information
- IP: IP addresses and digital footprint data

CRITICAL REQUIREMENTS:
1. Use ONLY tables and fields from the provided schema
2. Always use DISTINCT to avoid duplicate records
3. Include proper JOINs for data relationships (typically on HOUSEHOLD_ID or ADDRESS_ID)
4. Target contactable, high-quality audiences when possible
5. Follow SQL best practices for Snowflake/standard SQL
6. Return ONLY valid JSON in the specified format

QUALITY GUIDELINES:
- For email targeting: Use EMAILQUALITYLEVEL >= 7 and check EMAILOPTIN = 1
- For phone targeting: Use PHONEQUALITYLEVEL >= 7 and ensure DNC = 0
- For recent activity: Use date filters like DATEADD('day', -30, CURRENT_DATE)
- For quality filtering: Exclude low-quality or outdated records`;

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
  "sqlQuery": "SELECT DISTINCT p.HOUSEHOLD_ID, p.ADDRESS_ID...",
  "reasoning": "Brief explanation of your approach and key targeting logic",
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
