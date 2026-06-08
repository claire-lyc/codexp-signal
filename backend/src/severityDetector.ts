import type { TicketUrgency } from './ticketRepository.js';

const severityLevels = ['critical', 'high', 'medium', 'low'] as const satisfies readonly TicketUrgency[];

type SeverityResponse = {
  urgency?: string;
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

const severityInstructions =
  'Classify citizen crisis reports for government ticket triage. Return JSON only, shaped as {"urgency":"critical|high|medium|low"}. ' +
  'Use critical for immediate danger to life, major active hazards, fire, deep flooding, or urgent rescue needs. ' +
  'Use high for serious public health, hospital, flood, supply, or safety issues needing prompt agency attention. ' +
  'Use medium for service disruption, shortage, symptoms, or moderate risk. Use low for informational or minor reports.';

export async function detectTicketUrgency(crisisType: string, message: string): Promise<TicketUrgency> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openRouterKey) return detectWithOpenRouter(openRouterKey, crisisType, message);
  if (openAiKey?.startsWith('sk-or-')) return detectWithOpenRouter(openAiKey, crisisType, message);
  if (openAiKey) return detectWithOpenAI(openAiKey, crisisType, message);

  return defaultUrgency();
}

async function detectWithOpenAI(apiKey: string, crisisType: string, message: string): Promise<TicketUrgency> {
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SEVERITY_MODEL ?? 'gpt-4.1-mini',
        instructions: severityInstructions,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({ crisisType, message }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ticket_urgency',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                urgency: {
                  type: 'string',
                  enum: severityLevels,
                },
              },
              required: ['urgency'],
            },
          },
        },
      }),
    });

    if (!response.ok) return defaultUrgency();

    const data = (await response.json()) as OpenAIResponse;
    const parsed = JSON.parse(responseText(data) ?? '{}') as SeverityResponse;
    return toTicketUrgency(parsed.urgency);
  } catch {
    return defaultUrgency();
  }
}

async function detectWithOpenRouter(apiKey: string, crisisType: string, message: string): Promise<TicketUrgency> {
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
        model: process.env.OPENROUTER_SEVERITY_MODEL ?? 'openai/gpt-4.1-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: severityInstructions },
          { role: 'user', content: JSON.stringify({ crisisType, message }) },
        ],
      }),
    });

    if (!response.ok) return defaultUrgency();

    const data = (await response.json()) as OpenRouterResponse;
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as SeverityResponse;
    return toTicketUrgency(parsed.urgency);
  } catch {
    return defaultUrgency();
  }
}

function toTicketUrgency(value: string | undefined): TicketUrgency {
  return severityLevels.find((level) => level === value) ?? defaultUrgency();
}

function defaultUrgency(): TicketUrgency {
  return 'medium';
}

function responseText(response: OpenAIResponse) {
  return response.output_text ?? response.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;
}
