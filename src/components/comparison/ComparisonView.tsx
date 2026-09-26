import React, { useState, useEffect } from 'react';
import type { ExtractedDocument, ComparisonResult, ClauseChange } from '@/types';
import { GitCompare, AlertTriangle, CheckCircle, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface ComparisonViewProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ExtractedDocument[];
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  isOpen,
  onClose,
  documents,
}) => {
  const [docAId, setDocAId] = useState<string>(documents[0]?.id || '');
  const [docBId, setDocBId] = useState<string>(documents[1]?.id || '');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  useEffect(() => {
    if (documents.length >= 2) {
      setDocAId(documents[0].id);
      setDocBId(documents[1].id);
    }
  }, [documents]);

  if (!isOpen) return null;

  const handleRunCompare = async () => {
    if (!docAId || !docBId || docAId === docBId) {
      setError('Please select two distinct contracts to compare.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentAId: docAId, documentBId: docBId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to compare documents.');
      }

      setComparison(data.data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during comparison.');
    } finally {
      setIsLoading(false);
    }
  };

  const docA = documents.find((d) => d.id === docAId);
  const docB = documents.find((d) => d.id === docBId);

  const filteredChanges = comparison?.changes.filter((change) => {
    if (filterSeverity === 'ALL') return true;
    return change.severity === filterSeverity;
  }) || [];

  const getSeverityBadge = (severity: ClauseChange['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-950/80 border-rose-800 text-rose-300';
      case 'SUBSTANTIVE':
        return 'bg-amber-950/80 border-amber-800 text-amber-300';
      case 'COSMETIC':
        return 'bg-blue-950/80 border-blue-800 text-blue-300';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl flex flex-col font-sans text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold uppercase font-mono tracking-wider text-zinc-100">
                Semantic Clause Version Comparison
              </h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                Structural paragraph & material risk change evaluator
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Selection Control Bar */}
        <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">Baseline Document (A)</label>
              <select
                value={docAId}
                onChange={(e) => setDocAId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.pageCount} pgs)
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0 mt-4" />

            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">Revised Document (B)</label>
              <select
                value={docBId}
                onChange={(e) => setDocBId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.pageCount} pgs)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleRunCompare}
            disabled={isLoading || !docAId || !docBId || docAId === docBId}
            className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 border border-indigo-600 text-zinc-100 text-xs font-semibold disabled:opacity-40 transition shadow-sm mt-4"
          >
            {isLoading ? 'Analyzing Clauses...' : 'Run Semantic Comparison'}
          </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {comparison && (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-4 gap-4 font-mono">
                <div className="p-3.5 rounded bg-rose-950/30 border border-rose-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-rose-400 font-semibold block">Critical Legal Terms</span>
                    <span className="text-xl font-bold text-rose-200">{comparison.summary.critical}</span>
                  </div>
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                </div>

                <div className="p-3.5 rounded bg-amber-950/30 border border-amber-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-amber-400 font-semibold block">Substantive Changes</span>
                    <span className="text-xl font-bold text-amber-200">{comparison.summary.substantive}</span>
                  </div>
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>

                <div className="p-3.5 rounded bg-blue-950/30 border border-blue-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-blue-400 font-semibold block">Cosmetic Adjustments</span>
                    <span className="text-xl font-bold text-blue-200">{comparison.summary.cosmetic}</span>
                  </div>
                  <GitCompare className="w-6 h-6 text-blue-400" />
                </div>

                <div className="p-3.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-zinc-400 font-semibold block">Unchanged Clauses</span>
                    <span className="text-xl font-bold text-zinc-300">{comparison.summary.unchanged}</span>
                  </div>
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs font-mono">
                <span className="text-zinc-500 uppercase text-[10px] mr-2">Filter Severity:</span>
                {['ALL', 'CRITICAL', 'SUBSTANTIVE', 'COSMETIC'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2.5 py-1 rounded text-xs transition ${
                      filterSeverity === sev
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Clause Changes Feed */}
              <div className="space-y-4">
                {filteredChanges.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3 font-sans"
                  >
                    {/* Summary & Badge Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${getSeverityBadge(change.severity)}`}>
                          {change.severity}
                        </span>
                        <span className="text-xs font-semibold text-zinc-200">{change.summary}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        {change.changeType}
                      </span>
                    </div>

                    {/* Clause Diff Comparison */}
                    <div className="grid grid-cols-2 gap-4 text-xs font-serif leading-relaxed">
                      <div className="p-3 rounded bg-zinc-950/70 border border-zinc-800/80">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                          Document A (Baseline)
                        </span>
                        <p className="text-zinc-300 italic">
                          {change.alignment.clauseIndexA !== null
                            ? `Clause #${change.alignment.clauseIndexA}`
                            : '(Not present in baseline document)'}
                        </p>
                      </div>

                      <div className="p-3 rounded bg-zinc-950/70 border border-zinc-800/80">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                          Document B (Revised)
                        </span>
                        <p className="text-zinc-300 italic">
                          {change.alignment.clauseIndexB !== null
                            ? `Clause #${change.alignment.clauseIndexB}`
                            : '(Removed in revised document)'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
