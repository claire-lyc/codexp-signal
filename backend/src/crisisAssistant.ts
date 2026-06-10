type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
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

const assistantInstructions =
  'You are SiGnal Assist, a concise public crisis-information helper for people in Singapore. ' +
  'Answer questions about active crises, health risks, dengue, COVID-19, hantavirus, floods, haze, weather, transport, infrastructure, supply shortages, public reports, alerts, volunteering, and how to use the SiGnal public portal. ' +
  'Be calm, practical, and brief. Never claim to have live information unless the user supplied it. Direct users to the Alerts page for current SiGnal notices and the Report page for non-emergency reports. ' +
  'For immediate danger, tell users to call 995 for ambulance or fire emergencies, or 999 for police emergencies. ' +
  'Do not diagnose medical conditions. Encourage professional medical care for symptoms or health concerns. ' +
  'If a question is unrelated to crises, public safety, emergency preparedness, or this portal, politely explain your scope.';

export async function answerCrisisQuestion(messages: AssistantMessage[]) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openRouterKey) return answerWithOpenRouter(openRouterKey, messages);
  if (openAiKey?.startsWith('sk-or-')) return answerWithOpenRouter(openAiKey, messages);
  if (openAiKey) return answerWithOpenAI(openAiKey, messages);

  console.warn('[assistant] No OPENROUTER_API_KEY or OPENAI_API_KEY configured; using local guidance.');
  return localGuidance(messages.at(-1)?.content ?? '');
}

async function answerWithOpenAI(apiKey: string, messages: AssistantMessage[]) {
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ASSISTANT_MODEL ?? process.env.OPENAI_SEVERITY_MODEL ?? 'gpt-4.1-mini',
        instructions: assistantInstructions,
        input: messages.map((message) => ({
          role: message.role,
          content: [{ type: 'input_text', text: message.content }],
        })),
        max_output_tokens: Number(process.env.OPENAI_ASSISTANT_MAX_TOKENS ?? 350),
      }),
    });

    if (!response.ok) {
      console.warn(`[assistant] OpenAI request failed (${response.status}): ${await response.text()}`);
      return localGuidance(messages.at(-1)?.content ?? '');
    }

    const data = (await response.json()) as OpenAIResponse;
    return responseText(data) || localGuidance(messages.at(-1)?.content ?? '');
  } catch (error) {
    console.warn('[assistant] OpenAI request failed; using local guidance.', error);
    return localGuidance(messages.at(-1)?.content ?? '');
  }
}

async function answerWithOpenRouter(apiKey: string, messages: AssistantMessage[]) {
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
        model: process.env.OPENROUTER_ASSISTANT_MODEL ?? process.env.OPENROUTER_SEVERITY_MODEL ?? 'openai/gpt-4.1-mini',
        max_tokens: Number(process.env.OPENROUTER_ASSISTANT_MAX_TOKENS ?? 350),
        temperature: 0.2,
        messages: [
          { role: 'system', content: assistantInstructions },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[assistant] OpenRouter request failed (${response.status}): ${await response.text()}`);
      return localGuidance(messages.at(-1)?.content ?? '');
    }

    const data = (await response.json()) as OpenRouterResponse;
    return data.choices?.[0]?.message?.content?.trim() || localGuidance(messages.at(-1)?.content ?? '');
  } catch (error) {
    console.warn('[assistant] OpenRouter request failed; using local guidance.', error);
    return localGuidance(messages.at(-1)?.content ?? '');
  }
}

function responseText(response: OpenAIResponse) {
  return response.output_text?.trim()
    ?? response.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text?.trim();
}

function localGuidance(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes('emergency') || normalized.includes('danger') || normalized.includes('injured')) {
    return 'If anyone is in immediate danger, call 995 for ambulance or fire emergencies, or 999 for police emergencies. Do not wait for an online reply.';
  }
  if (normalized.includes('dengue') || normalized.includes('covid') || normalized.includes('hantavirus') || normalized.includes('sick')) {
    return 'For health concerns, check the latest official alert and seek medical advice if you have symptoms. SiGnal cannot diagnose conditions. You can also report a local health issue from the Report page.';
  }
  if (normalized.includes('flood') || normalized.includes('rain') || normalized.includes('haze') || normalized.includes('weather')) {
    return 'Check the Alerts page for current notices, avoid affected areas, and follow official instructions. Use the Report page for non-emergency flooding, haze, or weather impacts near you.';
  }
  if (normalized.includes('report')) {
    return 'Open the Report page, choose the broad category and specific problem, add the location and details, then submit it to the relevant agency.';
  }

  return 'I can help with crisis alerts, health risks, floods, haze, transport, infrastructure, supply issues, emergency preparedness, and using the SiGnal public portal.';
}
