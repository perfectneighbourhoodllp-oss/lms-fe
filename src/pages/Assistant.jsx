import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { assistantService } from '../services/leadService';
import { useAuth } from '../context/AuthContext';

const ADMIN_SUGGESTIONS = [
  'Draft re-engagement WhatsApp messages for my top 10 cold leads',
  'How many leads are overdue for follow-up?',
  'Which agents have the most unassigned leads?',
  'Give me a performance report for the last 7 days',
  'Show me interested leads with no follow-up scheduled',
];

// Render the assistant's GitHub-flavored markdown (tables, bold, lists) with
// Tailwind styling. Wide tables scroll horizontally so they stay readable in a
// narrow chat bubble / on mobile.
const MD_COMPONENTS = {
  p: ({ node, ...p }) => <p className="mb-2 last:mb-0" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-gray-900" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
  li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  a: ({ node, ...p }) => <a className="text-blue-600 underline break-words" target="_blank" rel="noreferrer" {...p} />,
  code: ({ node, inline, ...p }) =>
    inline ? (
      <code className="px-1 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono" {...p} />
    ) : (
      <code className="block p-2 rounded bg-gray-100 text-[0.85em] font-mono overflow-x-auto" {...p} />
    ),
  blockquote: ({ node, ...p }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 italic my-2" {...p} />
  ),
  h1: ({ node, ...p }) => <h3 className="font-semibold text-gray-900 mt-2 mb-1" {...p} />,
  h2: ({ node, ...p }) => <h3 className="font-semibold text-gray-900 mt-2 mb-1" {...p} />,
  h3: ({ node, ...p }) => <h4 className="font-semibold text-gray-900 mt-2 mb-1" {...p} />,
  table: ({ node, ...p }) => (
    <div className="overflow-x-auto my-2 -mx-1">
      <table className="min-w-full text-xs border border-gray-200 rounded" {...p} />
    </div>
  ),
  thead: ({ node, ...p }) => <thead className="bg-gray-50" {...p} />,
  th: ({ node, ...p }) => <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-200 align-top" {...p} />,
  td: ({ node, ...p }) => <td className="px-2 py-1.5 border-b border-gray-100 align-top" {...p} />,
  hr: ({ node, ...p }) => <hr className="my-2 border-gray-200" {...p} />,
};

function AnswerText({ text }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

const fmtUsd = (n) => `$${(n || 0).toFixed(2)}`;
const fmtInr = (n) => `≈ ₹${Math.round((n || 0) * 87).toLocaleString('en-IN')}`;
const fmtTokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n || 0));

// Admin-only panel: AI usage & cost for a period.
function UsagePanel() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['assistant-usage', days],
    queryFn: () => assistantService.usage(days),
  });
  const t = data?.totals;
  return (
    <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">AI usage &amp; cost</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input py-1 text-xs w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : isError ? (
        <p className="text-xs text-red-600">Could not load usage.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-white border border-gray-200 p-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Cost</p>
              <p className="text-base font-semibold text-gray-900">{fmtUsd(t?.cost)}</p>
              <p className="text-[10px] text-gray-400">{fmtInr(t?.cost)}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Questions</p>
              <p className="text-base font-semibold text-gray-900">{t?.requests ?? 0}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Tokens (in/out)</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtTokens(t?.input)}/{fmtTokens(t?.output)}
              </p>
              <p className="text-[10px] text-gray-400">cache {fmtTokens(t?.cacheRead)} read</p>
            </div>
          </div>
          {data?.byUser?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-gray-400">
                  <tr>
                    <th className="text-left font-medium py-1">User</th>
                    <th className="text-right font-medium py-1">Questions</th>
                    <th className="text-right font-medium py-1">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byUser.map((u) => (
                    <tr key={u.name} className="border-t border-gray-100">
                      <td className="py-1 text-gray-700">
                        {u.name} <span className="text-gray-400">{u.role}</span>
                      </td>
                      <td className="py-1 text-right text-gray-600">{u.requests}</td>
                      <td className="py-1 text-right text-gray-800 tabular-nums">{fmtUsd(u.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No usage yet in this period.</p>
          )}
          <p className="text-[10px] text-gray-400 mt-2">
            Model {data?.model}. Cost is estimated from token usage at standard rates; INR at ₹87/$.
          </p>
        </>
      )}
    </div>
  );
}

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', text, streaming?, error? }
  const [input, setInput] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const isAdmin = user?.role === 'admin';
  const endRef = useRef(null);

  // Load the last 7 days of chat history once on mount so the thread survives
  // refresh / app restarts (persisted server-side, per user).
  useEffect(() => {
    let cancelled = false;
    assistantService
      .history()
      .then((rows) => {
        if (cancelled) return;
        const expanded = [];
        (rows || []).forEach((r) => {
          expanded.push({ role: 'user', text: r.question });
          if (r.answer) expanded.push({ role: 'assistant', text: r.answer });
        });
        setMessages(expanded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Update the trailing assistant bubble as the stream arrives.
  const patchLastAssistant = (fn) =>
    setMessages((m) => {
      const copy = m.slice();
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') copy[copy.length - 1] = fn(last);
      return copy;
    });

  const send = async (q) => {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: question }, { role: 'assistant', text: '', streaming: true }]);

    try {
      await assistantService.askStream(question, (delta) =>
        patchLastAssistant((last) => ({ ...last, text: last.text + delta }))
      );
      patchLastAssistant((last) => ({ ...last, streaming: false, text: last.text || 'No answer.' }));
    } catch (streamErr) {
      // Streaming unavailable (e.g. some WebViews) → fall back to non-streaming.
      try {
        const { answer } = await assistantService.ask(question);
        patchLastAssistant((last) => ({ ...last, text: answer || 'No answer.', streaming: false }));
      } catch (err) {
        const msg = err.response?.data?.message || streamErr.message || 'Something went wrong.';
        patchLastAssistant((last) => ({ ...last, text: `⚠️ ${msg}`, error: true, streaming: false }));
      }
    } finally {
      setBusy(false);
    }
  };

  const suggestions = ADMIN_SUGGESTIONS;

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-500 mt-2">This tool is available to admins only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:h-full max-w-3xl mx-auto">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">✨ AI Assistant</h1>
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin
                ? 'Ask about your leads, agents, projects, and pipeline.'
                : 'Ask about your leads and follow-ups.'}{' '}
              Read-only — it looks things up, it doesn’t change anything.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowUsage((v) => !v)}
              className="flex-shrink-0 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5"
            >
              {showUsage ? 'Hide usage' : '📊 Usage'}
            </button>
          )}
        </div>
      </div>

      {isAdmin && showUsage && <UsagePanel />}

      {/* Conversation */}
      <div className="flex-1 md:overflow-y-auto md:min-h-0 min-h-[45vh] px-5 py-4 space-y-4">
        {historyLoaded && messages.length === 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Try asking</p>
            <div className="grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap break-words'
                  : `rounded-2xl rounded-bl-sm px-4 py-2 max-w-[90%] border ${
                      m.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200'
                    }`
              }
            >
              {m.role === 'assistant' ? (
                m.streaming && !m.text ? (
                  <span className="text-sm text-gray-400">Thinking…</span>
                ) : (
                  <AnswerText text={m.text} />
                )
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer — sticky at the viewport bottom on mobile (stays above the keyboard) */}
      <div className="sticky bottom-0 md:static bg-white border-t border-gray-100 px-5 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask about your leads, agents, projects…"
            className="input flex-1 resize-none py-2 text-sm max-h-32"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
