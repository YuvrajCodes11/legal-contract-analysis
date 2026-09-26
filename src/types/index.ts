/**
 * Foundational domain types for the legal contract analysis platform.
 *
 * These types are consumed by:
 *  - src/lib/extractor.ts        (document ingestion)
 *  - src/lib/quote-verifier.ts   (verified citation engine)
 *  - src/lib/agent-runner.ts     (agentic research loop)
 *  - src/lib/comparator.ts       (multi-document compare)
 *  - src/app/api/**\/route.ts     (API layer)
 *  - src/components/**\/*.tsx     (presentation layer)
 */

// ---------------------------------------------------------------------------
// 1. Document extraction
// ---------------------------------------------------------------------------

/** A single page of a source document, with its offsets into `fullText`. */
export interface DocumentPage {
  pageNumber: number;
  text: string;
  /** Inclusive start offset of this page's text within ExtractedDocument.fullText */
  startOffset: number;
  /** Exclusive end offset of this page's text within ExtractedDocument.fullText */
  endOffset: number;
}

export interface ExtractedDocument {
  id: string;
  filename: string;
  pageCount: number;
  pages: DocumentPage[];
  fullText: string;
  createdAt: number;
}

/** Discriminated result of an extraction attempt, so callers must handle the scanned-PDF trap. */
export type ExtractionResult =
  | { status: 'OK'; document: ExtractedDocument }
  | {
      status: 'SCANNED_PDF_NO_TEXT';
      message: string;
      filename: string;
      averageCharsPerPage: number;
      totalAlphanumericChars: number;
    }
  | { status: 'UNSUPPORTED_FORMAT'; message: string; filename: string }
  | { status: 'EXTRACTION_ERROR'; message: string; filename: string };

export interface ExtractionThresholds {
  /** Reject if (totalCharacters / pageCount) is below this value. */
  minAvgCharsPerPage: number;
  /** Reject if total extracted alphanumeric characters is below this value. */
  minTotalAlphanumericChars: number;
}

export const DEFAULT_EXTRACTION_THRESHOLDS: ExtractionThresholds = {
  minAvgCharsPerPage: 40,
  minTotalAlphanumericChars: 100,
};

// ---------------------------------------------------------------------------
// 2. Quote verification
// ---------------------------------------------------------------------------

/** Result of normalizing raw source text for robust, whitespace/typography-insensitive matching. */
export interface NormalizedTextResult {
  normalized: string;
  /**
   * indexMap[i] is the offset, in the ORIGINAL raw string, of the character that
   * produced normalized[i]. Length always equals normalized.length.
   */
  indexMap: number[];
}

export type QuoteMatchType = 'exact' | 'fuzzy' | 'unverified';

export interface QuoteVerificationResult {
  isVerified: boolean;
  rawQuote: string;
  /** The actual text found in the source document (may differ slightly from rawQuote if fuzzy-matched). */
  matchedText?: string;
  pageNumber?: number;
  /** Inclusive start offset into ExtractedDocument.fullText (raw, not normalized). */
  startChar?: number;
  /** Exclusive end offset into ExtractedDocument.fullText (raw, not normalized). */
  endChar?: number;
  matchType: QuoteMatchType;
  /** 1.0 for exact matches; similarity score in [0,1) for fuzzy matches. */
  confidence: number;
}

export interface VerifyQuoteOptions {
  /** Minimum similarity score (Jaccard n-gram or token-Levenshtein derived) to accept a fuzzy match. Default 0.88. */
  fuzzyThreshold?: number;
  /** N-gram size used for the Jaccard character n-gram similarity check. Default 3. */
  ngramSize?: number;
  /** How many tokens longer/shorter than the quote a candidate window may be, to absorb OCR drop/insert noise. Default 2. */
  windowSizeVariance?: number;
}

// ---------------------------------------------------------------------------
// 3. Agentic research loop
// ---------------------------------------------------------------------------

export type AgentToolName =
  | 'list_sections'
  | 'search_document'
  | 'get_page_content'
  | 'read_span';

export interface ListSectionsParams {
  docId: string;
}

export interface SearchDocumentParams {
  docId: string;
  query: string;
}

export interface GetPageContentParams {
  docId: string;
  pageNumber: number;
}

export interface ReadSpanParams {
  docId: string;
  startChar: number;
  endChar: number;
}

export type AgentToolParams =
  | ListSectionsParams
  | SearchDocumentParams
  | GetPageContentParams
  | ReadSpanParams;

export interface DocumentSection {
  title: string;
  level: number;
  pageNumber: number;
  startChar: number;
}

export interface SearchHit {
  pageNumber: number;
  startChar: number;
  endChar: number;
  /** ~300 char window centered on the match, per spec. */
  context: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  params: unknown;
}

export type AgentToolResult =
  | { ok: true; data: DocumentSection[] | SearchHit[] | string | { text: string } }
  | { ok: false; error: string };

export type AgentStepAction = AgentToolName | 'final_answer' | 'error';

export interface AgentStepEvent {
  iteration: number;
  action: AgentStepAction;
  detail: string;
  toolCall?: AgentToolCall;
  toolResult?: AgentToolResult;
  timestamp: number;
}

export interface AgentRunConfig {
  docId: string;
  question: string;
  maxIterations: number; // hard cap: 5
}

export interface AgentRunResult {
  answer: string;
  citations: QuoteVerificationResult[];
  steps: AgentStepEvent[];
  terminationReason: 'final_answer' | 'max_iterations_reached' | 'error';
}

// ---------------------------------------------------------------------------
// 4. Interactive citation highlighting
// ---------------------------------------------------------------------------

export interface JumpToCitationDetail {
  docId: string;
  pageNumber: number;
  startChar: number;
  endChar: number;
}

/** CustomEvent name dispatched by citation UI, consumed by the document viewer. */
export const JUMP_TO_CITATION_EVENT = 'jumpToCitation' as const;

export interface HighlightRect {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// 5. Multi-document compare
// ---------------------------------------------------------------------------

export type ClauseSeverity = 'CRITICAL' | 'SUBSTANTIVE' | 'COSMETIC';

export const CRITICAL_CLAUSE_KEYWORDS = [
  'liability',
  'indemnif',
  'termination',
  'payment terms',
  'limitation of liability',
  'cap on liability',
] as const;

export interface Clause {
  index: number;
  pageNumber: number;
  startChar: number;
  endChar: number;
  text: string;
  heading?: string;
}

export interface ClauseAlignment {
  clauseIndexA: number | null;
  clauseIndexB: number | null;
  similarity: number;
}

export interface ClauseChange {
  alignment: ClauseAlignment;
  severity: ClauseSeverity;
  summary: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface ComparisonResult {
  documentAId: string;
  documentBId: string;
  changes: ClauseChange[];
  summary: {
    critical: number;
    substantive: number;
    cosmetic: number;
    unchanged: number;
  };
}

// ---------------------------------------------------------------------------
// Shared API envelope
// ---------------------------------------------------------------------------

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
