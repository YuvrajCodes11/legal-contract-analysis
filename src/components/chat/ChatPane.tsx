import React, { useState, useRef, useEffect } from 'react';
import type { ExtractedDocument, AgentStepEvent, QuoteVerificationResult } from '@/types';
import { AgentTraceFeed } from './AgentTraceFeed';
import { QuoteCitation } from './QuoteCitation';
import { Send, Square, Bot, User, FileText, Sparkles } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStepEvent[];
  citations?: (QuoteVerificationResult & { docId?: string; docFilename?: string })[];
  isStreaming?: boolean;
}

interface ChatPaneProps {
  documents: ExtractedDocument[];
  selectedDocId?: string;
  onSelectDoc: (id: string) => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Mission-Critical Contract Analysis Workstation ready. Select a document and ask a targeted legal question.',
};

const storageKey = (docId?: string) => `contractChat:${docId || 'all'}`;

function loadMessages(docId?: string): ChatMessage[] {
  if (typeof window === 'undefined') return [WELCOME_MESSAGE];
  try {
    const raw = window.localStorage.getItem(storageKey(docId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return [WELCOME_MESSAGE];
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(selectedDocId));
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStepEvent[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevDocIdRef = useRef(selectedDocId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentSteps]);

  // Reload the right conversation whenever the active document changes.
  useEffect(() => {
    if (prevDocIdRef.current !== selectedDocId) {
      setMessages(loadMessages(selectedDocId));
      prevDocIdRef.current = selectedDocId;
    }
  }, [selectedDocId]);

  // Persist per-document conversation as it changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(selectedDocId), JSON.stringify(messages));
    } catch {
      // storage full/unavailable — non-fatal
    }
  }, [messages, selectedDocId]);

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (customQuery?: string) => {
    const query = customQuery || input;
    if (!query.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setCurrentSteps([]);

    const assistantMsgId = (Date.now() + 1).toString();
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      steps: [],
      citations: [],
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const docIds = selectedDocId ? [selectedDocId] : documents.map((d) => d.id);
      const targetDocs = documents.filter((d) => docIds.includes(d.id));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: docIds, documents: targetDocs, question: query }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'step') {
                setCurrentSteps((prev) => [...prev, data.event]);
              } else if (data.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: '\u26a0\ufe0f ' + (data.error || 'Unable to complete request.'), isStreaming: false }
                      : msg
                  )
                );
              } else if (data.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: data.answer,
                          citations: data.citations,
                          steps: data.steps,
                          isStreaming: false,
                        }
                      : msg
                  )
                );
              }
            } catch (e) {
              // Parse error ignored
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content || '[Generation stopped by user]', isStreaming: false }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `Error: ${err.message || 'Failed to complete research request.'}`, isStreaming: false }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800 text-zinc-100 font-sans">
      <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Target Context:</span>
        </div>
        <select
          value={selectedDocId || ''}
          onChange={(e) => onSelectDoc(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 max-w-xs truncate"
        >
          <option value="">All Uploaded Contracts ({documents.length})</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.filename} ({doc.pageCount} pgs)
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
            )}

            <div className={`max-w-[85%] rounded-lg p-3.5 ${
              msg.role === 'user'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-zinc-950/80 text-zinc-200 border border-zinc-800 shadow-sm'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-zinc-800/60 pb-1">
                <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-400">
                  {msg.role === 'user' ? 'Legal Counsel' : 'Agentic Research Engine'}
                </span>
              </div>

              <div className="text-xs leading-relaxed font-sans whitespace-pre-wrap">
                {msg.content}
              </div>

              {msg.isStreaming && (
                <AgentTraceFeed steps={currentSteps} isThinking={isGenerating} />
              )}

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-zinc-800">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Verified Citations ({msg.citations.length})
                  </span>
                  {msg.citations.map((citation, idx) => (
                    <QuoteCitation
                      key={idx}
                      citation={citation}
                      docId={citation.docId || selectedDocId || (documents[0]?.id ?? '')}
                    />
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-2 bg-zinc-950 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Sparkles className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0">Quick Queries:</span>
        <button
          onClick={() => handleSendMessage('What is the limitation of liability cap?')}
          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 whitespace-nowrap"
        >
          Limitation of Liability
        </button>
        <button
          onClick={() => handleSendMessage('What are the termination notice terms?')}
          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 whitespace-nowrap"
        >
          Termination Terms
        </button>
        <button
          onClick={() => handleSendMessage('What governing law applies?')}
          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 whitespace-nowrap"
        >
          Governing Law
        </button>
      </div>

      <div className="p-3 bg-zinc-950 border-t border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md p-1.5 focus-within:border-zinc-700">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Ask a specific clause or legal term question..."
            disabled={isGenerating}
            className="flex-1 bg-transparent px-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-50"
          />

          {isGenerating ? (
            <button
              onClick={handleStopGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition"
            >
              <Square className="w-3.5 h-3.5 fill-rose-300" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-zinc-100 text-xs font-semibold disabled:opacity-40 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Research</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
