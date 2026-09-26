/**
 * Agent Tools Implementation
 * ------------------------------------------------------------------------
 * High-performance, fault-tolerant tools for the document research loop.
 *
 * Tools provided:
 *  - list_sections: Returns structural headings or page list outline.
 *  - search_document: BM25/keyword overlap search over document chunks.
 *  - get_page_content / get_section: Retrieves full text for a specific page.
 *  - read_span: Surgical character-span extraction from full text.
 */

import type {
  ExtractedDocument,
  DocumentSection,
  SearchHit,
  AgentToolResult,
} from '@/types';

/**
 * Parses document pages to identify headings (or returns page-based sections).
 */
export function listSections(doc: ExtractedDocument): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const headingRegex = /^(?:ARTICLE|SECTION|[0-9]+\.|\b[A-Z0-9\s,\-\.]{4,}\b)/m;

  for (const page of doc.pages) {
    const lines = page.text.split('\n');
    let pageHasHeading = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 80 && headingRegex.test(trimmed)) {
        // Find approximate position in page text
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

/**
 * Performs keyword and token-overlap search across document pages.
 * Returns top-K hits with a ~300 character context window centered on the match.
 */
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

    // Check exact query string first
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

    // Token matching
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

  // Sort by score descending and return top K
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK).map((h) => h.hit);
}

/**
 * Builds a ~300 character context window centered around [startChar, endChar].
 */
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

  // Expand boundaries to natural whitespace or line breaks to avoid truncating words
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

/**
 * Returns exact text for a given page number.
 */
export function getPageContent(doc: ExtractedDocument, pageNumber: number): string {
  const page = doc.pages.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    return `Page ${pageNumber} not found in document "${doc.filename}". Document has ${doc.pageCount} page(s).`;
  }
  return page.text;
}

/**
 * Returns exact character span from document full text.
 */
export function readSpan(doc: ExtractedDocument, startChar: number, endChar: number): string {
  const safeStart = Math.max(0, startChar);
  const safeEnd = Math.min(doc.fullText.length, endChar);
  if (safeStart >= safeEnd) {
    return '';
  }
  return doc.fullText.slice(safeStart, safeEnd);
}

/**
 * Fault-tolerant execution dispatcher for agent tools.
 * Catches invalid parameters, unknown tool names, or malformed inputs without throwing.
 */
export function executeAgentTool(
  toolName: string,
  params: unknown,
  doc: ExtractedDocument
): AgentToolResult {
  try {
    if (!doc) {
      return { ok: false, error: 'No document provided to tool execution.' };
    }

    const p = (typeof params === 'object' && params !== null ? params : {}) as Record<string, unknown>;

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
        return { ok: false, error: `Unknown tool "${toolName}". Supported tools: list_sections, search_document, get_page_content, read_span.` };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
