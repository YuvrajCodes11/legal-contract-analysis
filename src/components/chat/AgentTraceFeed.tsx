import React from 'react';
import type { AgentStepEvent } from '@/types';
import { Search, ListTree, FileText, CheckCircle, Terminal } from 'lucide-react';

interface AgentTraceFeedProps {
  steps: AgentStepEvent[];
  isThinking?: boolean;
}

export const AgentTraceFeed: React.FC<AgentTraceFeedProps> = ({ steps, isThinking }) => {
  if (steps.length === 0 && !isThinking) return null;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'list_sections':
        return <ListTree className="w-3.5 h-3.5 text-blue-400" />;
      case 'search_document':
        return <Search className="w-3.5 h-3.5 text-indigo-400" />;
      case 'get_page_content':
      case 'get_section':
      case 'read_span':
        return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      case 'final_answer':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'list_sections':
        return 'bg-blue-950/60 border-blue-800/40 text-blue-300';
      case 'search_document':
        return 'bg-indigo-950/60 border-indigo-800/40 text-indigo-300';
      case 'get_page_content':
      case 'get_section':
      case 'read_span':
        return 'bg-emerald-950/60 border-emerald-800/40 text-emerald-300';
      case 'final_answer':
        return 'bg-zinc-800 border-zinc-700 text-zinc-200';
      default:
        return 'bg-zinc-900 border-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="my-3 p-3 rounded-md bg-zinc-950 border border-zinc-800 font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2 text-zinc-400 uppercase tracking-widest text-[10px] font-semibold">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span>Agent Research Execution Loop</span>
        </div>
        <span className="text-[10px] text-zinc-500">
          Max Cap: 6 Iterations
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-2 rounded bg-zinc-900/60 border border-zinc-800/60 text-zinc-300 text-xs"
          >
            <div className="mt-0.5">{getActionIcon(step.action)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase ${getActionBadgeClass(step.action)}`}>
                  Iter #{step.iteration}: {step.action}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-zinc-300 text-xs truncate leading-snug">{step.detail}</p>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 p-2 rounded bg-zinc-900/40 border border-zinc-800/40 text-zinc-400 text-xs animate-pulse">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Agent executing tool research step...</span>
          </div>
        )}
      </div>
    </div>
  );
};
