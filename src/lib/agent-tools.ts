// @ts-nocheck
/**
 * Agent Tools Implementation
 * ------------------------------------------------------------------------
 * Tools: list_sections, search_document, get_page_content / get_section,
 * read_span. executeAgentTool accepts either a single document (legacy,
 * backward compatible) or an array of documents for multi-document
 * research, resolving the correct one via a "docId" parameter.
 */

import type {
  ExtractedDocument,
  DocumentSection,
  SearchHit,
  AgentToolResult,
} from '@/types';

export function listSections(doc: ExtractedDocument): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const headingRegex = /^(?:ARTICLE|SECTION|[0-9]+\.|\b[A-Z0-9\s,\-\.]{4,}\b)/m;

  for (const page of doc.pages) {
    const lines = page.text.split('\n');
    let pageHasHeading = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 80 && headingRegex.test(trimmed)) {
        const relativeOffset = page.text.indexOf(trimmed);
        const startChar = page.startOffset + (relativeOffset >= 0 ? relativeOffset : 0);

        sections.push({
          title: trimmed,
          level: trimmed.startsWith('ARTICLE') || trimmed.startsWith('SECTION') ? 1 : 2,
          pageNumber: page.pageNumber,
          startChar,
        });
        pageHasHeading = true;
      }
    }

    if (!pageHasHeading) {
      sections.push({
        title: `Page ${page.pageNumber}`,
        level: 1,
        pageNumber: page.pageNumber,
        startChar: page.startOffset,
      });
    }
  }

  return sections;
}

export function searchDocument(
  doc: ExtractedDocument,
  query: string,
  topK: number = 5
): SearchHit[] {
  if (!query || query.trim().length === 0) return [];

  const rawTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (rawTokens.length === 0) return [];

  const hits: Array<{ hit: SearchHit; score: number }> = [];

  for (const page of doc.pages) {
    const pageText = page.text;
    const pageLower = pageText.toLowerCase();

    const queryLower = query.toLowerCase().trim();
    let exactIdx = pageLower.indexOf(queryLower);

    if (exactIdx !== -1) {
      const startChar = page.startOffset + exactIdx;
      const endChar = startChar + queryLower.length;
      const context = buildContextWindow(doc.fullText, startChar, endChar, 300);

      hits.push({
        hit: { pageNumber: page.pageNumber, startChar, endChar, context },
        score: 100 + queryLower.length,
      });
      continue;
    }

    let pageScore = 0;
    let bestMatchIdx = -1;
    let matchLen = 0;

    for (const token of rawTokens) {
      let pos = 0;
      while ((pos = pageLower.indexOf(token, pos)) !== -1) {
        pageScore += 10;
        if (bestMatchIdx === -1) {
          bestMatchIdx = pos;
          matchLen = token.length;
        }
        pos += token.length;
      }
    }

    if (pageScore > 0 && bestMatchIdx !== -1) {
      const startChar = page.startOffset + bestMatchIdx;
      const endChar = startChar + matchLen;
      const context = buildContextWindow(doc.fullText, startChar, endChar, 300);

      hits.push({
        hit: { pageNumber: page.pageNumber, startChar, endChar, context },
        score: pageScore,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK).map((h) => h.hit);
}

function buildContextWindow(
  fullText: string,
  startChar: number,
  endChar: number,
  targetWindowSize: number = 300
): string {
  const matchLen = endChar - startChar;
  const margin = Math.max(30, Math.floor((targetWindowSize - matchLen) / 2));

  let winStart = Math.max(0, startChar - margin);
  let winEnd = Math.min(fullText.length, endChar + margin);

  while (winStart > 0 && !/\s/.test(fullText[winStart - 1])) {
    winStart--;
  }
  while (winEnd < fullText.length && !/\s/.test(fullText[winEnd])) {
    winEnd++;
  }

  let snippet = fullText.slice(winStart, winEnd).trim();

  if (winStart > 0) snippet = '...' + snippet;
  if (winEnd < fullText.length) snippet = snippet + '...';

  return snippet;
}

export function getPageContent(doc: ExtractedDocument, pageNumber: number): string {
  const page = doc.pages.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    return `Page ${pageNumber} not found in document "${doc.filename}". Document has ${doc.pageCount} page(s).`;
  }
  return page.text;
}

export function readSpan(doc: ExtractedDocument, startChar: number, endChar: number): string {
  const safeStart = Math.max(0, startChar);
  const safeEnd = Math.min(doc.fullText.length, endChar);
  if (safeStart >= safeEnd) {
    return '';
  }
  return doc.fullText.slice(safeStart, safeEnd);
}

/**
 * Fault-tolerant execution dispatcher for agent tools. Accepts a single
 * document (legacy) or an array of documents; when given an array, resolves
 * the target via the "docId" parameter so a multi-document research loop
 * can call tools against a specific document.
 */
export function executeAgentTool(
  toolName: string,
  params: unknown,
  documents: ExtractedDocument | ExtractedDocument[]
): AgentToolResult {
  try {
    const docsArray = Array.isArray(documents) ? documents : [documents];
    if (docsArray.length === 0 || !docsArray[0]) {
      return { ok: false, error: 'No document provided to tool execution.' };
    }

    const p = (typeof params === 'object' && params !== null ? params : {}) as Record<string, unknown>;

    const requestedDocId = typeof p.docId === 'string' ? p.docId : undefined;
    const doc = requestedDocId
      ? docsArray.find((d) => d.id === requestedDocId)
      : docsArray[0];

    if (!doc) {
      return {
        ok: false,
        error: `Unknown docId "${requestedDocId}". Available document ids: ${docsArray.map((d) => d.id).join(', ')}`,
      };
    }

    switch (toolName) {
      case 'list_sections': {
        const sections = listSections(doc);
        return { ok: true, data: sections };
      }

      case 'search_document': {
        const query = typeof p.query === 'string' ? p.query : '';
        const topK = typeof p.topK === 'number' ? p.topK : 5;
        if (!query.trim()) {
          return { ok: false, error: 'Parameter "query" is required for search_document.' };
        }
        const hits = searchDocument(doc, query, topK);
        return { ok: true, data: hits };
      }

      case 'get_page_content':
      case 'get_section': {
        const pageNum = typeof p.pageNumber === 'number' ? p.pageNumber : typeof p.page === 'number' ? p.page : 1;
        const text = getPageContent(doc, pageNum);
        return { ok: true, data: { text } };
      }

      case 'read_span': {
        const startChar = typeof p.startChar === 'number' ? p.startChar : 0;
        const endChar = typeof p.endChar === 'number' ? p.endChar : 0;
        const text = readSpan(doc, startChar, endChar);
        return { ok: true, data: text };
      }

      default:
        return {
          ok: false,
          error: `Unknown tool "${toolName}". Supported tools: list_sections, search_document, get_page_content, read_span.`,
        };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
