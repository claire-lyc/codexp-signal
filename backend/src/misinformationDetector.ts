type MisinformationResponse = {
  flagged?: boolean;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const misinformationInstructions =
  'Review public forum posts for potential misinformation during civic or crisis events. ' +
  'Flag posts that make alarming unverified claims, medical/public-safety rumors, conspiracy claims, false scarcity claims, or instructions that could cause harm. ' +
  'Do not flag ordinary questions, personal observations, requests for help, or posts that clearly cite official guidance. ' +
  'Return JSON only, shaped as {"flagged":true} or {"flagged":false}.';

export async function detectPotentialMisinformation(content: string): Promise<boolean> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openRouterKey) return detectWithOpenRouter(openRouterKey, content);
  if (openAiKey?.startsWith('sk-or-')) return detectWithOpenRouter(openAiKey, content);
  if (openAiKey) return detectWithOpenAI(openAiKey, content);

  console.warn('[misinformation] No OPENROUTER_API_KEY or OPENAI_API_KEY configured; using local fallback.');
  return localFallback(content);
}

async function detectWithOpenAI(apiKey: string, content: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MISINFORMATION_MODEL ?? process.env.OPENAI_SEVERITY_MODEL ?? 'gpt-4.1-mini',
        instructions: misinformationInstructions,
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: content }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'misinformation_flag',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                flagged: { type: 'boolean' },
              },
              required: ['flagged'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[misinformation] OpenAI request failed (${response.status}): ${await response.text()}`);
      return localFallback(content);
    }

    const data = (await response.json()) as OpenAIResponse;
    const flagged = Boolean(parseMisinformationResponse(responseText(data)).flagged);
    console.info(`[misinformation] OpenAI ${flagged ? 'flagged' : 'cleared'} forum post.`);
    return flagged;
  } catch (error) {
    console.warn('[misinformation] OpenAI detection failed; using local fallback.', error);
    return localFallback(content);
  }
}

async function detectWithOpenRouter(apiKey: string, content: string): Promise<boolean> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:4000',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'SiGnal',
    },
    body: JSON.stringify({
        model: process.env.OPENROUTER_MISINFORMATION_MODEL ?? process.env.OPENROUTER_SEVERITY_MODEL ?? 'openai/gpt-4.1-mini',
        max_tokens: Number(process.env.OPENROUTER_MISINFORMATION_MAX_TOKENS ?? 50),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
        { role: 'system', content: misinformationInstructions },
        { role: 'user', content },
        ],
    }),
    });

    if (!response.ok) {
      console.warn(`[misinformation] OpenRouter request failed (${response.status}): ${await response.text()}`);
      return localFallback(content);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const flagged = Boolean(parseMisinformationResponse(data.choices?.[0]?.message?.content).flagged);
    console.info(`[misinformation] OpenRouter ${flagged ? 'flagged' : 'cleared'} forum post.`);
    return flagged;
  } catch (error) {
    console.warn('[misinformation] OpenRouter detection failed; using local fallback.', error);
    return localFallback(content);
  }
}

function responseText(response: OpenAIResponse) {
  return response.output_text ?? response.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;
}

function parseMisinformationResponse(text: string | undefined): MisinformationResponse {
  if (!text) return {};
  try {
    return JSON.parse(text) as MisinformationResponse;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as MisinformationResponse) : {};
  }
}

function localFallback(content: string) {
  const normalized = content.toLowerCase();
  return [
    'all hospitals',
    'turning away',
    'confirmed cure',
    'secret',
    'cover up',
    'breaking:',
    '!!!',
  ].some((term) => normalized.includes(term));
}
