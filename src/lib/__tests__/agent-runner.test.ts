import { describe, it, expect } from 'vitest';
import {
  listSections,
  searchDocument,
  getPageContent,
  readSpan,
  executeAgentTool,
} from '../agent-tools';
import {
  runAgentLoop,
  extractQuoteCandidates,
} from '../agent-runner';
import type { ExtractedDocument, AgentStepEvent } from '@/types';

const sampleDoc: ExtractedDocument = {
  id: 'doc-123',
  filename: 'sample_contract.pdf',
  pageCount: 3,
  pages: [
    {
      pageNumber: 1,
      text: 'RECITALS\nThis Agreement is made between Alpha Corp and Beta LLC.\nThe parties agree to the terms set forth below.',
      startOffset: 0,
      endOffset: 110,
    },
    {
      pageNumber: 2,
      text: 'LIMITATION OF LIABILITY\nIn no event shall either party be liable for indirect damages.\nTotal liability shall not exceed fees paid in the prior 12 months.',
      startOffset: 112,
      endOffset: 265,
    },
    {
      pageNumber: 3,
      text: 'SIGNATURES\nIN WITNESS WHEREOF the parties have executed this Agreement.',
      startOffset: 267,
      endOffset: 337,
    },
  ],
  fullText:
    'RECITALS\nThis Agreement is made between Alpha Corp and Beta LLC.\nThe parties agree to the terms set forth below.\n\nLIMITATION OF LIABILITY\nIn no event shall either party be liable for indirect damages.\nTotal liability shall not exceed fees paid in the prior 12 months.\n\nSIGNATURES\nIN WITNESS WHEREOF the parties have executed this Agreement.',
  createdAt: Date.now(),
};

describe('agent-tools', () => {
  it('listSections extracts headings from document pages', () => {
    const sections = listSections(sampleDoc);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some((s) => s.title.includes('RECITALS'))).toBe(true);
    expect(sections.some((s) => s.title.includes('LIMITATION OF LIABILITY'))).toBe(true);
  });

  it('searchDocument finds keyword matches and builds context windows', () => {
    const hits = searchDocument(sampleDoc, 'liability', 2);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].pageNumber).toBe(2);
    expect(hits[0].context.toLowerCase()).toContain('liability');
  });

  it('getPageContent retrieves correct page text or error message', () => {
    const page2Text = getPageContent(sampleDoc, 2);
    expect(page2Text).toContain('LIMITATION OF LIABILITY');

    const invalidPage = getPageContent(sampleDoc, 99);
    expect(invalidPage).toContain('not found');
  });

  it('readSpan returns slice of full text', () => {
    const textSpan = readSpan(sampleDoc, 0, 8);
    expect(textSpan).toBe('RECITALS');
  });

  it('executeAgentTool handles invalid tools and parameters gracefully', () => {
    const invalidToolRes = executeAgentTool('non_existent_tool', {}, sampleDoc);
    expect(invalidToolRes.ok).toBe(false);

    const validToolRes = executeAgentTool('get_page_content', { pageNumber: 1 }, sampleDoc);
    expect(validToolRes.ok).toBe(true);
  });
});

describe('agent-runner', () => {
  it('extractQuoteCandidates parses <quote> XML tags strictly', () => {
    const text = 'The agreement provides <quote>Total liability shall not exceed fees paid</quote> for damages.';
    const candidates = extractQuoteCandidates(text);
    expect(candidates).toContain('Total liability shall not exceed fees paid');
  });

  it('runAgentLoop runs tool iterations and emits step events', async () => {
    const emittedSteps: AgentStepEvent[] = [];

    const result = await runAgentLoop(
      {
        docId: sampleDoc.id,
        question: 'What is the limitation of liability?',
        maxIterations: 5,
      },
      sampleDoc,
      {
        onStep: (step) => emittedSteps.push(step),
      }
    );

    expect(result.steps.length).toBeGreaterThan(0);
    expect(emittedSteps.length).toEqual(result.steps.length);
    expect(result.terminationReason).toBe('final_answer');
    expect(result.answer).toContain('liability');
    expect(result.citations.some((c) => c.isVerified)).toBe(true);
  });

  it('runAgentLoop respects maximum iteration cap of 6', async () => {
    const result = await runAgentLoop(
      {
        docId: sampleDoc.id,
        question: 'What are the terms?',
        maxIterations: 10, // Exceeds cap of 6
      },
      sampleDoc
    );

    expect(result.steps.length).toBeLessThanOrEqual(6);
  });
});
