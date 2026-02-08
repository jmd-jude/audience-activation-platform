import {
  buildCompactSchemaContext,
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
- PII: Geographic and identity data (state, ZIP, address, urbanicity)
- EMAIL: Email addresses with quality scores and opt-in status (use LEFT JOIN - optional)

NOTE: Phone contactability is tracked via DATA.HASPHONE (1 = has phone, 0 = no phone). There is NO separate PHONE table.

BUSINESS OBJECTIVES:
1. Audience Size: Target 10,000-500,000 households for viable campaign scale
2. Addressability: Identify reachable audiences across available channels
3. Precision: Balance specificity with audience size - too narrow = no results
4. Quality: Consider data quality and opt-in status when relevant

QUERY CONSTRUCTION GUIDELINES:

Use LEFT JOIN for optional tables:
- LEFT JOIN EMAIL when email communication is mentioned
- LEFT JOIN PII when geographic targeting (STATE, ZIP, URBANICITY_CODE) is needed

For phone/SMS targeting:
- Use DATA.HASPHONE = 1 (no PHONE table exists)
- Example: WHERE d.HASPHONE = 1 AND d.INCOME_HH IN (...)
- For multi-channel: WHERE d.HASPHONE = 1 AND d.HASEMAIL = 1 (EMAIL table not required if just checking flag)
- Don't force joins to tables you don't need

CRITICAL ENUMERATED FIELD RULES:
- ANY field with valid_values in the schema MUST use IN (...) syntax
- NEVER use >, <, >=, <= on fields with valid_values
- **ONLY use EXACT values from the valid_values array - NEVER paraphrase, abbreviate, or invent values**
- If a value doesn't match exactly, the query returns ZERO results
- Copy values character-for-character from the schema, including prefixes like "A.", "B.", etc.
- When mapping natural language to values:
  * "Affluent/High income" → INCOME_HH IN ('K. $100,000-$149,999', 'L. $150,000-$174,999', 'M. $175,000-$199,999', 'N. $200,000-$249,999', 'P. $250-$299K', 'Q. $300-$399K', 'R. $400-$499K', 'S. $500-$699K', 'T. $700-$999K', 'U. $1MM +')
  * "Middle income" → INCOME_HH IN ('F. $50,000-$59,999', 'G. $60,000-$74,999', 'H. $75,000-$99,999')
  * "Young adults" → AGE BETWEEN 18 AND 35 (AGE is numeric, not enumerated)
  * "Millennials" → GENERATION = '1. Millennials and Gen Z (1982 and after)'

CRITICAL - KEEP QUERIES SIMPLE:
- MAXIMUM 4 WHERE conditions. This is a hard limit.
- Extract only the PRIMARY audience definition (who they are at their core).
- Ignore secondary qualifiers and nice-to-haves from the user's request.
- A broad audience that can be narrowed later is BETTER than a tiny over-filtered one.
- If the user mentions 6 attributes, pick the 2-3 most defining ones and omit the rest.
- Example: For "affluent married millennials in urban areas who travel and have premium cards":
  ✓ USE: INCOME_HH IN (...high values...) AND GENERATION = '1. Millennials...' AND MARITAL_STATUS = 'Married'
  ✗ SKIP: urbanicity, travel purchases, premium card - these are secondary

Build queries that return results:
- Start with DATA table (has most consumer intelligence)
- Use HOUSEHOLD_ID for all table joins (HOUSEHOLD_ID links DATA, PII, and EMAIL tables)
- Always include d.ID, d.HOUSEHOLD_ID, and e.MD5 in SELECT for activation capabilities
- Always LEFT JOIN EMAIL to get MD5 for digital activation
- Balance precision (AND conditions) with reach (broader criteria)
- Typical pattern: 2-4 key filters with DISTINCT on d.ID

EXAMPLE QUERY PATTERNS:

Affluent Families with Purchase Behavior:
SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
WHERE d.INCOME_HH IN ('K. $100,000-$149,999', 'L. $150,000-$174,999', 'M. $175,000-$199,999')
  AND d.MARITAL_STATUS = 'Married'
  AND d.CHILDREN_HH > 0
  AND d.RECENT_TRAVEL_PURCHASES_TOTAL_COMPANIES >= 1

Email-Addressable Professionals:
SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
WHERE d.OCCUPATION_CATEGORY IN ('Professional', 'Upper Management')
  AND d.AGE BETWEEN 30 AND 55
  AND e.EMAILQUALITYLEVEL >= 7
  AND e.EMAILOPTIN = 1

Urban Millennials:
SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5
FROM DATA d
LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID
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
- Frame the segment name and description as "Similar to..." or "Lookalike..."

CRITICAL: Honor explicit user constraints. If the user specifies geography (states, cities, metros), INCLUDE those geographic filters - lookalike means finding similar profiles WITHIN those areas, not removing the areas. Expand within stated constraints, not by removing them.`
    : '';

  const prompt = `${SEGMENT_GENERATION_SYSTEM_PROMPT}

${taskContext}

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
  "description": "Clear description of who this targets and why (100-200 chars)",
  "sqlQuery": "SELECT DISTINCT d.ID, d.HOUSEHOLD_ID, e.MD5 FROM DATA d LEFT JOIN EMAIL e ON d.HOUSEHOLD_ID = e.HOUSEHOLD_ID WHERE...",
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