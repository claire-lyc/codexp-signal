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

export type TicketTriageDecision = {
  spam: boolean;
  relevantToSelectedIssue: boolean;
  confidence: number;
  reason: string;
};

const triageInstructions =
  'Review a citizen crisis report for a Singapore government command centre. Return JSON only with ' +
  '{"spam":boolean,"relevantToSelectedIssue":boolean,"confidence":number,"reason":string}. ' +
  'Mark spam true when the report is trolling, nonsense, commercial spam, abusive noise, or not about a public emergency, civic hazard, health, infrastructure, transport, weather, supply, cyber, safety, or government-service issue. ' +
  'For relevance, judge whether the written description genuinely supports the selected specific issue. Do not trust only the dropdown selection. ' +
  'If the selected issue is Other or blank, relevantToSelectedIssue should be false so the report remains ungrouped.';

export async function triageCitizenTicketWithAI(input: {
  reportType?: string;
  selectedIssue?: string | null;
  description: string;
  location?: string | null;
}): Promise<TicketTriageDecision | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openRouterKey) return detectWithOpenRouter(openRouterKey, input);
  if (openAiKey?.startsWith('sk-or-')) return detectWithOpenRouter(openAiKey, input);
  if (openAiKey) return detectWithOpenAI(openAiKey, input);

  return null;
}

async function detectWithOpenAI(apiKey: string, input: Parameters<typeof triageCitizenTicketWithAI>[0]) {
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TICKET_TRIAGE_MODEL ?? 'gpt-4.1-mini',
        instructions: triageInstructions,
        input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] }],
        text: {
          format: {
            type: 'json_schema',
            name: 'ticket_triage',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                spam: { type: 'boolean' },
                relevantToSelectedIssue: { type: 'boolean' },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['spam', 'relevantToSelectedIssue', 'confidence', 'reason'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[ticket-triage] OpenAI request failed (${response.status}): ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as OpenAIResponse;
    return parseDecision(responseText(data));
  } catch (error) {
    console.warn('[ticket-triage] OpenAI detection failed; using local fallback.', error);
    return null;
  }
}

async function detectWithOpenRouter(apiKey: string, input: Parameters<typeof triageCitizenTicketWithAI>[0]) {
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
        model: process.env.OPENROUTER_TICKET_TRIAGE_MODEL ?? process.env.OPENROUTER_SEVERITY_MODEL ?? 'openai/gpt-4.1-mini',
        max_tokens: Number(process.env.OPENROUTER_TICKET_TRIAGE_MAX_TOKENS ?? 180),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: triageInstructions },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[ticket-triage] OpenRouter request failed (${response.status}): ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as OpenRouterResponse;
    return parseDecision(data.choices?.[0]?.message?.content);
  } catch (error) {
    console.warn('[ticket-triage] OpenRouter detection failed; using local fallback.', error);
    return null;
  }
}

function parseDecision(text: string | undefined): TicketTriageDecision | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<TicketTriageDecision>;
    if (typeof parsed.spam !== 'boolean' || typeof parsed.relevantToSelectedIssue !== 'boolean') return null;
    return {
      spam: parsed.spam,
      relevantToSelectedIssue: parsed.relevantToSelectedIssue,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI triage completed.',
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? parseDecision(match[0]) : null;
  }
}

function responseText(response: OpenAIResponse) {
  return response.output_text ?? response.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;
}
