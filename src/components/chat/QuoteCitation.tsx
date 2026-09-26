import React from 'react';
import type { QuoteVerificationResult } from '@/types';
import { useCitationJump } from '@/hooks/useCitationJump';
import { CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface QuoteCitationProps {
  citation: QuoteVerificationResult & { docId?: string; docFilename?: string };
  docId: string;
}

export const QuoteCitation: React.FC<QuoteCitationProps> = ({ citation, docId }) => {
  const { dispatchJump } = useCitationJump();

  const handleJump = () => {
    if (!citation.isVerified || citation.pageNumber === undefined || citation.startChar === undefined) {
      return;
    }
    dispatchJump({
      docId: citation.docId || docId,
      pageNumber: citation.pageNumber,
      startChar: citation.startChar,
      endChar: citation.endChar ?? citation.startChar + citation.rawQuote.length,
    });
  };

  if (citation.isVerified) {
    const confidencePct = Math.round(citation.confidence * 100);
    return (
      <div
        onClick={handleJump}
        className="group cursor-pointer my-2 p-2.5 rounded border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 transition-all font-mono text-xs text-zinc-200"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Citation</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px]">
              {citation.matchType === 'exact' ? 'Exact Match' : `Fuzzy Match (${confidencePct}%)`}
            </span>
          </div>
          {citation.pageNumber !== undefined && (
            <span className="flex items-center gap-1 text-emerald-400/80 text-[10px] group-hover:text-emerald-300">
              <span>Page {citation.pageNumber}</span>
              <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </div>
        <p className="text-zinc-300 italic font-serif leading-relaxed line-clamp-3">
          &ldquo;{citation.matchedText || citation.rawQuote}&rdquo;
        </p>
        {citation.docFilename && (
          <span className="block mt-1 text-[9px] text-emerald-400/60 font-mono truncate">
            \u2014 {citation.docFilename}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="my-2 p-2.5 rounded border border-amber-500/30 bg-amber-950/20 font-mono text-xs text-amber-200/90">
      <div className="flex items-center gap-1.5 text-amber-400 font-semibold uppercase tracking-wider text-[10px] mb-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>Paraphrased / Unverified</span>
      </div>
      <p className="text-zinc-400 italic font-serif leading-relaxed line-clamp-2">
        &ldquo;{citation.rawQuote}&rdquo;
      </p>
      <span className="block mt-1 text-[9px] text-amber-400/70">
        Quote string could not be verified to exact document text bounds.
      </span>
    </div>
  );
};
