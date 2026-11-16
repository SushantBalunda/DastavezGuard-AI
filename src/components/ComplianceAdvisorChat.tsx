import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import type { ChatMessage, ChatModelId, ComplianceAuditResult } from '../types/audit';

interface ComplianceAdvisorChatProps {
  isOpen: boolean;
  onClose: () => void;
  auditContext: ComplianceAuditResult | null;
}

const MODEL_OPTIONS: Array<{ id: ChatModelId; label: string }> = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (General)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fast)' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon (Complex · Paid Key)' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon (Deep Reasoning · Paid Key)' },
];

const QUICK_PROMPTS = [
  'How do I resolve a "Kr." vs "Kumar" mismatch before UPSC/SSC submission?',
  'Is a 2025 Income Certificate still valid in November 2026?',
  'What affidavit format works for minor father name differences?',
];

function formatInlineSegments(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-xs text-slate-900"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderFormattedMessage(raw: string): React.ReactNode {
  const lines = raw.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (/^---+$/.test(trimmed)) {
          return <hr key={idx} className="my-2 border-slate-200" />;
        }
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headingText = trimmed.replace(/^#{1,4}\s+/, '');
          return (
            <p key={idx} className="pt-1 font-display text-sm font-bold text-slate-900">
              {formatInlineSegments(headingText)}
            </p>
          );
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{formatInlineSegments(trimmed.replace(/^[-*]\s+/, ''))}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const match = /^(\d+\.)\s+(.*)$/.exec(trimmed);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-mono text-xs font-semibold text-slate-600 mt-0.5 shrink-0">
                  {match[1]}
                </span>
                <span>{formatInlineSegments(match[2])}</span>
              </div>
            );
          }
        }
        return <p key={idx}>{formatInlineSegments(trimmed)}</p>;
      })}
    </div>
  );
}

export const ComplianceAdvisorChat: React.FC<ComplianceAdvisorChatProps> = ({
  isOpen,
  onClose,
  auditContext,
}) => {
  const [selectedModel, setSelectedModel] = useState<ChatModelId>('gemini-4-hydrogen');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      text: 'Hello. I am the DastavezGuard Compliance Advisor. Ask me about Indian portal document rules, UIDAI name corrections, OBC-NCL/Income validity, or remediation steps for your active audit.',
      modelUsed: 'gemini-4-hydrogen',
      timestamp: 'Ready',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');
    setIsSending(true);

    try {
      const apiHistory = nextHistory
        .filter((m) => m.id !== 'welcome-msg' && !m.isError)
        .slice(0, -1)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: apiHistory,
          model: selectedModel,
          auditContext,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        modelUsed?: ChatModelId;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Unable to reach Compliance Advisor.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.reply || '',
          modelUsed: data.modelUsed || selectedModel,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text:
            err instanceof Error
              ? err.message
              : 'Failed to receive response from Compliance Advisor.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Compliance Advisor Chatbot"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Compliance Advisor
            </h2>
            <p className="text-xs text-slate-500">
              {auditContext
                ? `Grounded in ${auditContext.targetScheme}`
                : 'General Indian Portal Guidance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome-msg',
                  role: 'model',
                  text: 'Conversation reset. Ask any compliance question about your uploaded documents or portal rules.',
                  modelUsed: selectedModel,
                  timestamp: 'Ready',
                },
              ])
            }
            aria-label="Reset chat history"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Compliance Advisor"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <label htmlFor="chat-model-select" className="block text-xs font-medium text-slate-600">
          Reasoning Tier
        </label>
        <select
          id="chat-model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as ChatModelId)}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div
        data-testid="chat-thread"
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[90%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-700 text-white whitespace-pre-wrap'
                  : msg.isError
                    ? 'border border-red-200 bg-red-50 text-red-800 whitespace-pre-wrap'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              {msg.role === 'model' && !msg.isError
                ? renderFormattedMessage(msg.text)
                : msg.text}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>{msg.role === 'user' ? 'You' : msg.modelUsed || 'Advisor'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-700" aria-hidden="true" />
            <span>Consulting {selectedModel}...</span>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={isSending}
              onClick={() => void sendMessage(q)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-left text-xs text-slate-700 hover:border-blue-300 hover:text-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(inputText);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <label htmlFor="advisor-chat-input" className="sr-only">
              Ask a document compliance question
            </label>
            <textarea
              id="advisor-chat-input"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(inputText);
                }
              }}
              placeholder="Ask about mismatch remediation, affidavits, or certificate validity..."
              className="block w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
            />
          </div>
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            aria-label="Send message"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </aside>
  );
};
