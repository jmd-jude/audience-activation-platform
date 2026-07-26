import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }
  return client;
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
}

/**
 * Calls messages.create and, if the response is truncated (stop_reason ===
 * 'max_tokens'), retries once with thinking disabled and a larger max_tokens
 * budget — adaptive thinking shares the same token budget as output, so a
 * truncation on the first attempt doesn't necessarily mean the task needs
 * more total tokens, just more room for the actual answer.
 */
export async function createMessageWithTruncationRetry(
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<{ message: Anthropic.Message; truncated: boolean }> {
  const anthropic = getAnthropicClient();
  let message = await anthropic.messages.create(params);

  if (message.stop_reason === 'max_tokens') {
    console.warn('Claude response truncated on first attempt, retrying with thinking disabled and higher max_tokens...');
    message = await anthropic.messages.create({
      ...params,
      max_tokens: params.max_tokens * 2,
      thinking: { type: 'disabled' },
    });
  }

  return { message, truncated: message.stop_reason === 'max_tokens' };
}

/**
 * With adaptive thinking on, `message.content[0]` is often a `thinking`
 * block rather than `text` — find the first text block instead of
 * assuming index 0.
 */
export function extractText(message: Anthropic.Message): string {
  const textBlock = message.content.find((block) => block.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : '';
}
