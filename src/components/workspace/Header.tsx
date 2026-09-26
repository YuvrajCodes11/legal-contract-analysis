import React from 'react';
import { Shield, Upload, GitCompare, Library, Scale } from 'lucide-react';

interface HeaderProps {
  documentCount: number;
  onOpenUpload: () => void;
  onOpenLibrary: () => void;
  onOpenCompare: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  documentCount,
  onOpenUpload,
  onOpenLibrary,
  onOpenCompare,
}) => {
  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between text-zinc-100 font-sans shadow-md">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center">
          <Scale className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-zinc-100 uppercase font-mono flex items-center gap-2">
            <span>LEXIS-AI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-normal">
              PRO WORKSTATION
            </span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-mono">
            Mission-Critical Verified Contract Analysis Engine
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition"
        >
          <Library className="w-3.5 h-3.5 text-zinc-400" />
          <span>Library</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono">
            {documentCount}
          </span>
        </button>

        <button
          onClick={onOpenCompare}
          disabled={documentCount < 2}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 disabled:opacity-40 transition"
          title={documentCount < 2 ? 'Upload at least 2 documents to run semantic compare' : 'Compare two contract versions'}
        >
          <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
          <span>Version Compare</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-zinc-100 text-xs font-semibold shadow-sm transition"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Contract</span>
        </button>
      </div>
    </header>
  );
};
