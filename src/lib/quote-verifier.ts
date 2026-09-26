/**
 * Verified Quote Verification Engine
 * ------------------------------------------------------------------------
 * Model-supplied quotes and offsets are NEVER trusted directly. Every quote
 * a downstream LLM claims to have found in a document is re-verified against
 * the actual extracted source text here before it is allowed to render as a
 * citation. If verification fails, the caller must strip the quote or flag
 * it as `[UNVERIFIED QUOTE]` — this module never fabricates a match.
 *
 * Pipeline:
 *   1. normalizeText()   - whitespace/typography-insensitive normalization
 *                          with a full offset map back to the raw string.
 *   2. verifyQuote()     - exact substring match on normalized text first;
 *                          falls back to a sliding-window fuzzy search
 *                          (character n-gram Jaccard + token-level
 *                          Levenshtein) to absorb OCR/extraction jitter.
 */

import type {
  ExtractedDocument,
  NormalizedTextResult,
  QuoteVerificationResult,
  VerifyQuoteOptions,
} from '@/types';

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const SOFT_HYPHEN = '\u00ad';
const NBSP = '\u00a0';

/** Smart/curly quote variants (double + single, opening + closing) mapped to their ASCII form. */
const SMART_QUOTE_MAP: Record<string, string> = {
  '\u201c': '"', // “
  '\u201d': '"', // ”
  '\u201e': '"', // „
  '\u201f': '"', // ‟
  '\u2018': "'", // ‘
  '\u2019': "'", // ’
  '\u201a': "'", // ‚
  '\u201b': "'", // ‛
};

/**
 * Normalizes raw extracted text for robust comparison:
 *  - Soft hyphens (U+00AD) are removed entirely (they are invisible
 *    hyphenation artifacts, not real characters).
 *  - Non-breaking spaces (U+00A0) are treated as ordinary spaces.
 *  - Smart/curly quotes are folded to their straight ASCII equivalents.
 *  - \r\n, \r, \n, \t and runs of spaces are all collapsed into a single
 *    space, so that a quote spanning a line-wrap or paragraph break in the
 *    raw text still matches a flat, single-line quote.
 *  - Leading/trailing whitespace is trimmed.
 *
 * Returns both the normalized string AND an indexMap of equal length, where
 * indexMap[i] is the offset in the ORIGINAL raw string of the raw character
 * that produced normalized[i]. This lets every downstream match on the
 * normalized text be translated back to exact raw-string offsets.
 */
export function normalizeText(str: string): NormalizedTextResult {
  const outChars: string[] = [];
  const outIndexMap: number[] = [];

  let lastWasSpace = false;
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const ch = str[i];

    // Soft hyphens are invisible hyphenation hints — drop them completely.
    // They contribute no character to the normalized output and no index.
    if (ch === SOFT_HYPHEN) {
      continue;
    }

    let mapped = ch;

    if (ch === NBSP) {
      mapped = ' ';
    } else if (ch in SMART_QUOTE_MAP) {
      mapped = SMART_QUOTE_MAP[ch];
    } else if (ch === '\r' || ch === '\n' || ch === '\t' || ch === ' ' || ch === '\f' || ch === '\v') {
      mapped = ' ';
    }

    const isSpace = mapped === ' ';

    if (isSpace) {
      if (lastWasSpace) {
        // Collapse consecutive whitespace: skip, don't emit another space.
        continue;
      }
      outChars.push(' ');
      outIndexMap.push(i);
      lastWasSpace = true;
      continue;
    }

    outChars.push(mapped);
    outIndexMap.push(i);
    lastWasSpace = false;
  }

  // Trim leading/trailing collapsed whitespace, keeping indexMap in sync.
  let start = 0;
  let end = outChars.length;
  while (start < end && outChars[start] === ' ') start++;
  while (end > start && outChars[end - 1] === ' ') end--;

  return {
    normalized: outChars.slice(start, end).join(''),
    indexMap: outIndexMap.slice(start, end),
  };
}

// ---------------------------------------------------------------------------
// Tokenization (used by the fuzzy fallback only)
// ---------------------------------------------------------------------------

interface Token {
  text: string;
  /** Offset of this token's first character within the NORMALIZED string it was tokenized from. */
  start: number;
  /** Exclusive offset of this token's last character + 1, within the same normalized string. */
  end: number;
}

/** Splits an already-normalized (single-spaced) string into word tokens with their normalized offsets. */
function tokenizeNormalized(normalized: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = normalized.length;

  while (i < len) {
    if (normalized[i] === ' ') {
      i++;
      continue;
    }
    const start = i;
    while (i < len && normalized[i] !== ' ') i++;
    tokens.push({ text: normalized.slice(start, i), start, end: i });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Similarity primitives for the fuzzy fallback
// ---------------------------------------------------------------------------

/** Builds the multiset of character n-grams for a string (lowercase, whitespace-collapsed already assumed). */
function charNGrams(str: string, n: number): Set<string> {
  const grams = new Set<string>();
  if (str.length < n) {
    if (str.length > 0) grams.add(str);
    return grams;
  }
  for (let i = 0; i <= str.length - n; i++) {
    grams.add(str.slice(i, i + n));
  }
  return grams;
}

/** Jaccard similarity between the character n-gram sets of two strings. Returns a value in [0, 1]. */
function jaccardNGramSimilarity(a: string, b: string, n: number): number {
  const gramsA = charNGrams(a, n);
  const gramsB = charNGrams(b, n);
  if (gramsA.size === 0 && gramsB.size === 0) return 1;
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let intersection = 0;
  for (const g of gramsA) {
    if (gramsB.has(g)) intersection++;
  }
  const union = gramsA.size + gramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Standard token-level (word-level) Levenshtein edit distance between two token arrays. */
function tokenLevenshteinDistance(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Rolling two-row DP to keep memory O(min(m,n)) instead of O(m*n).
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution / match
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Converts a token-level edit distance into a normalized similarity score in [0, 1]. */
function tokenLevenshteinSimilarity(a: string[], b: string[]): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = tokenLevenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<VerifyQuoteOptions> = {
  fuzzyThreshold: 0.88,
  ngramSize: 3,
  windowSizeVariance: 2,
};

/** Resolves the 1-based page number containing a raw offset into ExtractedDocument.fullText. */
function pageNumberForOffset(document: ExtractedDocument, rawOffset: number): number | undefined {
  for (const page of document.pages) {
    if (rawOffset >= page.startOffset && rawOffset < page.endOffset) {
      return page.pageNumber;
    }
  }
  // Offset lands exactly on the final character of the last page (endOffset is exclusive).
  const lastPage = document.pages[document.pages.length - 1];
  if (lastPage && rawOffset === lastPage.endOffset) {
    return lastPage.pageNumber;
  }
  return undefined;
}

/** Translates a [start, end) span of NORMALIZED offsets into raw [startChar, endChar) offsets via indexMap. */
function normalizedSpanToRaw(
  indexMap: number[],
  normStart: number,
  normEnd: number,
): { startChar: number; endChar: number } {
  const startChar = indexMap[normStart];
  // endChar is exclusive: the raw index just past the last matched character.
  const lastCharRawIndex = indexMap[normEnd - 1];
  const endChar = lastCharRawIndex + 1;
  return { startChar, endChar };
}

interface FuzzyCandidate {
  score: number;
  normStart: number;
  normEnd: number;
  matchedNormalizedText: string;
}

/**
 * Slides a window of variable token-length across the document's tokens,
 * scoring each window against the quote via both character n-gram Jaccard
 * similarity and token-level Levenshtein similarity, and returns the single
 * best-scoring window (if any).
 */
function findBestFuzzyMatch(
  quoteNormalized: string,
  quoteTokens: Token[],
  docTokens: Token[],
  ngramSize: number,
  windowSizeVariance: number,
): FuzzyCandidate | null {
  const quoteTokenTexts = quoteTokens.map((t) => t.text);
  const quoteWordCount = quoteTokens.length;

  if (quoteWordCount === 0 || docTokens.length === 0) return null;

  let best: FuzzyCandidate | null = null;

  const minWindow = Math.max(1, quoteWordCount - windowSizeVariance);
  const maxWindow = quoteWordCount + windowSizeVariance;

  for (let windowSize = minWindow; windowSize <= maxWindow; windowSize++) {
    if (windowSize > docTokens.length) continue;

    for (let start = 0; start + windowSize <= docTokens.length; start++) {
      const windowTokens = docTokens.slice(start, start + windowSize);
      const windowTokenTexts = windowTokens.map((t) => t.text);
      const windowNormStart = windowTokens[0].start;
      const windowNormEnd = windowTokens[windowTokens.length - 1].end;

      // Reconstruct the exact normalized substring (preserves the single
      // spaces between tokens as they appear in the source).
      const windowText = windowTokenTexts.join(' ');

      const ngramScore = jaccardNGramSimilarity(windowText, quoteNormalized, ngramSize);
      const tokenScore = tokenLevenshteinSimilarity(windowTokenTexts, quoteTokenTexts);
      const score = Math.max(ngramScore, tokenScore);

      if (!best || score > best.score) {
        best = {
          score,
          normStart: windowNormStart,
          normEnd: windowNormEnd,
          matchedNormalizedText: windowText,
        };
      }
    }
  }

  return best;
}

/**
 * Verifies that `rawQuote` genuinely appears in `document`, never trusting
 * any model-supplied page number or character offset. Tries an exact match
 * on normalized text first; if that fails (e.g. due to OCR noise or minor
 * extraction jitter), falls back to a sliding-window fuzzy search.
 *
 * If no match clears the fuzzy threshold, returns `isVerified: false` with
 * no matchedText/pageNumber/offsets — callers MUST treat this as
 * `[UNVERIFIED QUOTE]` and must not render it as a trustworthy citation.
 */
export function verifyQuote(
  rawQuote: string,
  document: ExtractedDocument,
  options: VerifyQuoteOptions = {},
): QuoteVerificationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const trimmedQuote = rawQuote.trim();
  if (trimmedQuote.length === 0) {
    return {
      isVerified: false,
      rawQuote,
      matchType: 'unverified',
      confidence: 0,
    };
  }

  const { normalized: quoteNorm } = normalizeText(trimmedQuote);
  const { normalized: docNorm, indexMap: docIndexMap } = normalizeText(document.fullText);

  if (quoteNorm.length === 0 || docNorm.length === 0) {
    return {
      isVerified: false,
      rawQuote,
      matchType: 'unverified',
      confidence: 0,
    };
  }

  // --- 1. Exact match on normalized text -----------------------------------
  const exactIdx = docNorm.indexOf(quoteNorm);
  if (exactIdx !== -1) {
    const normStart = exactIdx;
    const normEnd = exactIdx + quoteNorm.length; // exclusive
    const { startChar, endChar } = normalizedSpanToRaw(docIndexMap, normStart, normEnd);
    const matchedText = document.fullText.slice(startChar, endChar);
    const pageNumber = pageNumberForOffset(document, startChar);

    return {
      isVerified: true,
      rawQuote,
      matchedText,
      pageNumber,
      startChar,
      endChar,
      matchType: 'exact',
      confidence: 1,
    };
  }

  // --- 2. Fuzzy sliding-window fallback -------------------------------------
  const quoteTokens = tokenizeNormalized(quoteNorm);
  const docTokens = tokenizeNormalized(docNorm);

  const best = findBestFuzzyMatch(
    quoteNorm,
    quoteTokens,
    docTokens,
    opts.ngramSize,
    opts.windowSizeVariance,
  );

  if (best && best.score >= opts.fuzzyThreshold) {
    const { startChar, endChar } = normalizedSpanToRaw(docIndexMap, best.normStart, best.normEnd);
    const matchedText = document.fullText.slice(startChar, endChar);
    const pageNumber = pageNumberForOffset(document, startChar);

    return {
      isVerified: true,
      rawQuote,
      matchedText,
      pageNumber,
      startChar,
      endChar,
      matchType: 'fuzzy',
      confidence: best.score,
    };
  }

  // --- 3. Unverified ---------------------------------------------------------
  // The quote could not be located in the source document at or above the
  // fuzzy threshold. The caller MUST strip it or render it flagged as
  // `[UNVERIFIED QUOTE]` — never trust a model-supplied citation past this point.
  return {
    isVerified: false,
    rawQuote,
    matchType: 'unverified',
    confidence: best?.score ?? 0,
  };
}

/**
 * Batch convenience wrapper: verifies a list of model-supplied quotes against
 * a single document, preserving input order.
 */
export function verifyQuotes(
  rawQuotes: string[],
  document: ExtractedDocument,
  options: VerifyQuoteOptions = {},
): QuoteVerificationResult[] {
  return rawQuotes.map((q) => verifyQuote(q, document, options));
}
