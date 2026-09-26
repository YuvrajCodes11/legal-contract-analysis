/**
 * Structural & Semantic Document Comparison Engine
 * ------------------------------------------------------------------------
 * Paragraph/clause-level comparison between two document versions.
 * Evaluates material substance changes (liability caps, indemnities,
 * payment schedules, termination terms) vs minor cosmetic wording changes.
 * Categorizes differences by severity: CRITICAL, SUBSTANTIVE, or COSMETIC.
 */

import type {
  ExtractedDocument,
  Clause,
  ClauseAlignment,
  ClauseChange,
  ClauseSeverity,
  ComparisonResult,
} from '@/types';
import { CRITICAL_CLAUSE_KEYWORDS } from '@/types';

/**
 * Extracts clauses/paragraphs from an ExtractedDocument with exact character offsets.
 */
export function extractClauses(doc: ExtractedDocument): Clause[] {
  const clauses: Clause[] = [];
  let clauseIndex = 0;

  for (const page of doc.pages) {
    const paragraphs = page.text.split(/\n{2,}/);
    let pageOffset = page.startOffset;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) {
        pageOffset += para.length + 2;
        continue;
      }

      const paraStart = page.text.indexOf(trimmed, pageOffset - page.startOffset);
      const startChar = page.startOffset + (paraStart >= 0 ? paraStart : 0);
      const endChar = startChar + trimmed.length;

      // Extract optional heading if first line is uppercase/title
      const lines = trimmed.split('\n');
      let heading: string | undefined;
      if (lines.length > 1 && lines[0].length < 80) {
        heading = lines[0].trim();
      }

      clauses.push({
        index: clauseIndex++,
        pageNumber: page.pageNumber,
        startChar,
        endChar,
        text: trimmed,
        heading,
      });

      pageOffset = endChar;
    }
  }

  return clauses;
}

/**
 * Calculates token-level Jaccard similarity between two texts in [0, 1].
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(textA.toLowerCase().match(/\w+/g) || []);
  const tokensB = new Set(textB.toLowerCase().match(/\w+/g) || []);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks whether text or heading contains any critical legal keyword.
 */
function isCriticalClause(text: string, heading?: string): boolean {
  const target = (text + ' ' + (heading || '')).toLowerCase();
  return CRITICAL_CLAUSE_KEYWORDS.some((kw) => target.includes(kw));
}

/**
 * Evaluates the severity of a clause change (CRITICAL, SUBSTANTIVE, or COSMETIC).
 */
function evaluateSeverity(
  clauseA: Clause | null,
  clauseB: Clause | null,
  similarity: number
): ClauseSeverity {
  const text = (clauseA?.text || '') + ' ' + (clauseB?.text || '');
  const heading = clauseA?.heading || clauseB?.heading;

  if (isCriticalClause(text, heading)) {
    return 'CRITICAL';
  }

  if (similarity < 0.75) {
    return 'SUBSTANTIVE';
  }

  return 'COSMETIC';
}

/**
 * Generates a concise executive summary for a clause change.
 */
function generateChangeSummary(
  changeType: ClauseChange['changeType'],
  severity: ClauseSeverity,
  clauseA: Clause | null,
  clauseB: Clause | null
): string {
  const headingStr = clauseB?.heading || clauseA?.heading || 'Un-captioned Clause';

  if (changeType === 'added') {
    return `New clause added (${headingStr}). Impact: ${severity.toLowerCase()}.`;
  }
  if (changeType === 'removed') {
    return `Clause removed (${headingStr}). Impact: ${severity.toLowerCase()}.`;
  }
  if (changeType === 'modified') {
    if (severity === 'CRITICAL') {
      return `Critical legal term modified in "${headingStr}". Material risk revision detected.`;
    }
    if (severity === 'SUBSTANTIVE') {
      return `Substantive wording modification in "${headingStr}".`;
    }
    return `Minor formatting/cosmetic adjustment in "${headingStr}".`;
  }
  return `No material changes in "${headingStr}".`;
}

/**
 * Aligns and compares two ExtractedDocument objects.
 */
export function compareDocuments(
  docA: ExtractedDocument,
  docB: ExtractedDocument
): ComparisonResult {
  const clausesA = extractClauses(docA);
  const clausesB = extractClauses(docB);

  const matchedBIndices = new Set<number>();
  const changes: ClauseChange[] = [];

  const summary = {
    critical: 0,
    substantive: 0,
    cosmetic: 0,
    unchanged: 0,
  };

  // Compare clauses in Doc A against Doc B
  for (const cA of clausesA) {
    let bestMatchIdx: number | null = null;
    let bestSim = 0;

    for (const cB of clausesB) {
      if (matchedBIndices.has(cB.index)) continue;

      const sim = calculateTextSimilarity(cA.text, cB.text);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatchIdx = cB.index;
      }
    }

    if (bestMatchIdx !== null && bestSim > 0.4) {
      matchedBIndices.add(bestMatchIdx);
      const cB = clausesB[bestMatchIdx];

      const alignment: ClauseAlignment = {
        clauseIndexA: cA.index,
        clauseIndexB: cB.index,
        similarity: bestSim,
      };

      if (bestSim >= 0.98) {
        changes.push({
          alignment,
          severity: 'COSMETIC',
          summary: generateChangeSummary('unchanged', 'COSMETIC', cA, cB),
          changeType: 'unchanged',
        });
        summary.unchanged++;
      } else {
        const severity = evaluateSeverity(cA, cB, bestSim);
        changes.push({
          alignment,
          severity,
          summary: generateChangeSummary('modified', severity, cA, cB),
          changeType: 'modified',
        });

        if (severity === 'CRITICAL') summary.critical++;
        else if (severity === 'SUBSTANTIVE') summary.substantive++;
        else summary.cosmetic++;
      }
    } else {
      // Removed clause in B
      const alignment: ClauseAlignment = {
        clauseIndexA: cA.index,
        clauseIndexB: null,
        similarity: 0,
      };
      const severity = evaluateSeverity(cA, null, 0);

      changes.push({
        alignment,
        severity,
        summary: generateChangeSummary('removed', severity, cA, null),
        changeType: 'removed',
      });

      if (severity === 'CRITICAL') summary.critical++;
      else if (severity === 'SUBSTANTIVE') summary.substantive++;
      else summary.cosmetic++;
    }
  }

  // Identify added clauses in Doc B
  for (const cB of clausesB) {
    if (!matchedBIndices.has(cB.index)) {
      const alignment: ClauseAlignment = {
        clauseIndexA: null,
        clauseIndexB: cB.index,
        similarity: 0,
      };
      const severity = evaluateSeverity(null, cB, 0);

      changes.push({
        alignment,
        severity,
        summary: generateChangeSummary('added', severity, null, cB),
        changeType: 'added',
      });

      if (severity === 'CRITICAL') summary.critical++;
      else if (severity === 'SUBSTANTIVE') summary.substantive++;
      else summary.cosmetic++;
    }
  }

  return {
    documentAId: docA.id,
    documentBId: docB.id,
    changes,
    summary,
  };
}
