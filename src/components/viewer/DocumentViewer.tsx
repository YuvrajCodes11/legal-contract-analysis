import React, { useState, useEffect, useRef } from 'react';
import type { ExtractedDocument, JumpToCitationDetail } from '@/types';
import { useCitationJump } from '@/hooks/useCitationJump';
import { FileText, ChevronLeft, ChevronRight, Search, Target, ZoomIn, ZoomOut } from 'lucide-react';

interface DocumentViewerProps {
  document?: ExtractedDocument;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ document }) => {
  const [activePage, setActivePage] = useState<number>(1);
  const [highlightRange, setHighlightRange] = useState<{ startChar: number; endChar: number } | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Reset page & highlight when document changes
  useEffect(() => {
    setActivePage(1);
    setHighlightRange(null);
  }, [document?.id]);

  // Handle Citation Jump Events
  useCitationJump((detail: JumpToCitationDetail) => {
    if (!document || detail.docId !== document.id) return;

    setActivePage(detail.pageNumber);
    setHighlightRange({ startChar: detail.startChar, endChar: detail.endChar });

    // Scroll target page into view
    const pageEl = pageRefs.current[detail.pageNumber];
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 font-sans p-6 text-center">
        <FileText className="w-12 h-12 mb-3 text-zinc-700 stroke-1" />
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">No Document Loaded</h3>
        <p className="text-xs text-zinc-600 max-w-sm mt-1">
          Upload or select a PDF / DOCX contract from the library to view document pages and citation highlights.
        </p>
      </div>
    );
  }

  const renderPageTextWithHighlight = (pageText: string, pageStartOffset: number) => {
    if (!highlightRange && !searchTerm) {
      return <span>{pageText}</span>;
    }

    const elements: React.ReactNode[] = [];
    let currIdx = 0;
    const pageEndOffset = pageStartOffset + pageText.length;

    // Check if citation highlight falls on this page
    if (
      highlightRange &&
      highlightRange.startChar < pageEndOffset &&
      highlightRange.endChar > pageStartOffset
    ) {
      const relStart = Math.max(0, highlightRange.startChar - pageStartOffset);
      const relEnd = Math.min(pageText.length, highlightRange.endChar - pageStartOffset);

      if (relStart > 0) {
        elements.push(pageText.slice(0, relStart));
      }

      elements.push(
        <mark
          key="citation-highlight"
          className="bg-emerald-500/30 text-emerald-200 border-b-2 border-emerald-400 font-semibold px-0.5 py-0.5 rounded animate-pulse shadow-sm"
        >
          {pageText.slice(relStart, relEnd)}
        </mark>
      );

      if (relEnd < pageText.length) {
        elements.push(pageText.slice(relEnd));
      }

      return elements;
    }

    // Handle standard keyword search term highlight
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      const textLower = pageText.toLowerCase();
      let lastIdx = 0;
      let matchIdx = -1;

      while ((matchIdx = textLower.indexOf(termLower, lastIdx)) !== -1) {
        if (matchIdx > lastIdx) {
          elements.push(pageText.slice(lastIdx, matchIdx));
        }
        elements.push(
          <mark key={matchIdx} className="bg-amber-500/30 text-amber-200 px-0.5 rounded">
            {pageText.slice(matchIdx, matchIdx + searchTerm.length)}
          </mark>
        );
        lastIdx = matchIdx + searchTerm.length;
      }

      if (lastIdx < pageText.length) {
        elements.push(pageText.slice(lastIdx));
      }

      return elements;
    }

    return pageText;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-sans">
      {/* Document Viewer Control Bar */}
      <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-zinc-200 truncate">{document.filename}</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400 font-mono">
            {document.pageCount} {document.pageCount === 1 ? 'Page' : 'Pages'}
          </span>
        </div>

        {/* Search & Navigation Controls */}
        <div className="flex items-center gap-2">
          {/* Viewer Keyword Search */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1">
            <Search className="w-3.5 h-3.5 text-zinc-500 mr-1.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search page text..."
              className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-32"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(70, z - 10))}
              className="p-1 hover:text-zinc-200 text-zinc-400"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-zinc-400 px-1">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 hover:text-zinc-200 text-zinc-400"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5">
            <button
              onClick={() => setActivePage((p) => Math.max(1, p - 1))}
              disabled={activePage <= 1}
              className="p-1 hover:text-zinc-200 text-zinc-400 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-300 px-1">
              {activePage} / {document.pageCount}
            </span>
            <button
              onClick={() => setActivePage((p) => Math.min(document.pageCount, p + 1))}
              disabled={activePage >= document.pageCount}
              className="p-1 hover:text-zinc-200 text-zinc-400 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Pages Workspace Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950/90 flex flex-col items-center">
        {document.pages.map((page) => {
          const isActive = page.pageNumber === activePage;
          return (
            <div
              key={page.pageNumber}
              ref={(el) => { pageRefs.current[page.pageNumber] = el; }}
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              className={`w-full max-w-3xl bg-zinc-900 border rounded-md p-8 shadow-xl transition-all ${
                isActive ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-zinc-800/80'
              }`}
            >
              {/* Page Number Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4 font-mono text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-400">PAGE {page.pageNumber}</span>
                  <span className="text-[10px] text-zinc-600">[{page.startOffset} - {page.endOffset} chars]</span>
                </div>
                {highlightRange && highlightRange.startChar >= page.startOffset && highlightRange.startChar < page.endOffset && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    <Target className="w-3 h-3" />
                    <span>Citation Target Match</span>
                  </span>
                )}
              </div>

              {/* Page Content Body */}
              <div className="legal-document-text whitespace-pre-wrap select-text">
                {renderPageTextWithHighlight(page.text, page.startOffset)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
