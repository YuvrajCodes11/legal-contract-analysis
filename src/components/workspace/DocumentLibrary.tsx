import React from 'react';
import type { ExtractedDocument } from '@/types';
import { Library, FileText, Trash2, ExternalLink, X } from 'lucide-react';

interface DocumentLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ExtractedDocument[];
  activeDocId?: string;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  isOpen,
  onClose,
  documents,
  activeDocId,
  onSelectDoc,
  onDeleteDoc,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col font-sans text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase font-mono tracking-wider text-zinc-100">
              Contract Library ({documents.length})
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No contracts stored. Upload a PDF or DOCX file to get started.
            </div>
          ) : (
            documents.map((doc) => {
              const isActive = doc.id === activeDocId;
              return (
                <div
                  key={doc.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-zinc-900 border-emerald-500/50 ring-1 ring-emerald-500/20'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-200 truncate">{doc.filename}</span>
                    </div>
                    <button
                      onClick={() => onDeleteDoc(doc.id)}
                      className="text-zinc-600 hover:text-rose-400 transition"
                      title="Delete contract"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>{doc.pageCount} {doc.pageCount === 1 ? 'Page' : 'Pages'}</span>
                    <span>{doc.fullText.length.toLocaleString()} chars</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectDoc(doc.id);
                      onClose();
                    }}
                    className={`w-full mt-3 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      isActive
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isActive ? 'Active Document' : 'Open in Workstation'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
