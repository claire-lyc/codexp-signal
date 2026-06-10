import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { fetchWithAuth } from '../../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi, I am SiGnal Assist. Ask me about crisis alerts, health risks, weather, reports, transport, or emergency preparedness.',
};

const quickQuestions = [
  'How do I submit a report?',
  'What should I do during a flash flood?',
  'Where can I check current alerts?',
];

export default function PublicCrisisAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, open, sending]);

  const sendMessage = async (text = draft) => {
    const content = text.trim();
    if (!content || sending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setSending(true);

    try {
      const response = await fetchWithAuth('/api/citizen/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages
            .filter((message) => message.id !== 'welcome')
            .slice(-10)
            .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || 'Assistant unavailable');
      }
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: payload.reply as string },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I could not connect just now. For immediate danger call 995 or 999. You can still check Alerts or submit a non-emergency Report.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[80] sm:bottom-6 sm:right-6">
      {open ? (
        <section
          className="mb-3 flex h-[min(620px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
          aria-label="SiGnal crisis assistant"
        >
          <header className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-800 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-white">SiGnal Assist</h2>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Online" />
              </div>
              <p className="truncate text-xs text-zinc-400">Public crisis information</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
              aria-label="Close crisis assistant"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="border-b border-zinc-800 bg-red-950/30 px-4 py-2.5">
            <div className="flex items-start gap-2 text-xs leading-5 text-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>Immediate danger: call 995 for ambulance or fire, or 999 for police.</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-color:#52525b_transparent] [scrollbar-width:thin]">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[84%] rounded-lg px-3 py-2.5 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-zinc-700 bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  Try asking
                </div>
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:border-blue-600 hover:bg-zinc-800 hover:text-white"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}

            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3" aria-label="Assistant is typing">
                  {[0, 1, 2].map((item) => (
                    <span
                      key={item}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400"
                      style={{ animationDelay: `${item * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          <div className="border-t border-zinc-700 bg-zinc-900 p-3">
            <div className="flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2 focus-within:border-blue-500">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 600))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask about a crisis..."
                className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || sending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-600">AI guidance may be inaccurate. Follow official instructions.</p>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ml-auto flex h-14 items-center gap-3 rounded-lg border border-blue-400/30 bg-blue-600 px-4 text-white shadow-xl shadow-black/40 transition-colors hover:bg-blue-500"
        aria-label={open ? 'Close crisis assistant' : 'Open crisis assistant'}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="text-sm font-semibold">Any questions?</span>
      </button>
    </div>
  );
}
