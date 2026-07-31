/**
 * JSON schemas for output_config.format (structured outputs), matching each
 * route's existing response contract. Schema constraints follow the
 * structured-outputs subset: no minLength/maxLength/min/max, no recursive
 * refs, additionalProperties: false on every object.
 */

export const DISCOVERY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    audiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          audienceName: { type: 'string' },
          description: { type: 'string' },
          keyCharacteristics: {
            type: 'array',
            items: { type: 'string' },
          },
          marketingOpportunity: { type: 'string' },
          targetingCriteria: {
            type: 'object',
            properties: {
              naturalLanguageInput: { type: 'string' },
              useCase: { type: 'string' },
              additionalContext: { type: 'string' },
            },
            required: ['naturalLanguageInput', 'useCase', 'additionalContext'],
            additionalProperties: false,
          },
          semanticSignals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                meaning: { type: 'string' },
                role: { type: 'string' },
              },
              required: ['field', 'meaning', 'role'],
              additionalProperties: false,
            },
          },
        },
        required: [
          'audienceName',
          'description',
          'keyCharacteristics',
          'marketingOpportunity',
          'targetingCriteria',
          'semanticSignals',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['audiences'],
  additionalProperties: false,
};

export const GENERATE_SEGMENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    segmentName: { type: 'string' },
    description: { type: 'string' },
    sqlQuery: { type: 'string' },
    reasoning: { type: 'string' },
    confidence: { type: 'number' },
    estimatedComplexity: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['segmentName', 'description', 'sqlQuery', 'reasoning', 'confidence', 'estimatedComplexity'],
  additionalProperties: false,
};

export const ADJUST_QUERY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sqlQuery: { type: 'string' },
    changeSummary: { type: 'string' },
  },
  required: ['sqlQuery', 'changeSummary'],
  additionalProperties: false,
};

export const CLARIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    needsClarification: { type: 'boolean' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          rationale: { type: 'string' },
        },
        required: ['id', 'question', 'options', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['needsClarification', 'questions'],
  additionalProperties: false,
};
