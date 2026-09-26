// @ts-nocheck
/**
 * Agentic Document Research Loop
 * ------------------------------------------------------------------------
 * The model is given real tool definitions (search_document, list_sections,
 * get_page_content, read_span) and decides, round by round, which to call
 * and on which document, before producing a final answer. Capped at 6
 * iterations. Every candidate quote in the final answer is independently
 * re-verified against the actual document text via quote-verifier.ts before
 * being returned as a citation — the model's own claims are never trusted.
 *
 * Falls back to an honest keyword-search-only mode (clearly labeled as such)
 * if no LLM API key is configured, rather than failing the request.
 */

import type {
  ExtractedDocument,
  AgentRunConfig,
  AgentRunResult,
  AgentStepEvent,
  QuoteVerificationResult,
} from '@/types';
import { executeAgentTool } from './agent-tools';
import { verifyQuote } from './quote-verifier';

export interface AgentRunnerOptions {
  onStep?: (event: AgentStepEvent) => void;
}

const GROQ_MODEL = 'openai/gpt-oss-20b';

/**
 * Extracts quote candidates strictly from <quote>...</quote> XML tags.
 * Falls back to quoted strings only if they look like real multi-word
 * citations (>15 chars, not filenames/queries).
 */
export function extractQuoteCandidates(text: string): string[] {
  const quotes: string[] = [];

  const xmlRegex = /<quote>([\s\S]*?)<\/quote>/gi;
  let match: RegExpExecArray | null;

  while ((match = xmlRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (candidate.length >= 3 && !quotes.includes(candidate)) {
      quotes.push(candidate);
    }
  }

  if (quotes.length === 0) {
    const quoteRegex = /["\u201c]([^"\u201d\n]{15,300})["\u201d]/g;
    while ((match = quoteRegex.exec(text)) !== null) {
      const candidate = match[1].trim();
      if (
        !candidate.endsWith('.docx') &&
        !candidate.endsWith('.pdf') &&
        !candidate.endsWith('?') &&
        !quotes.includes(candidate)
      ) {
        quotes.push(candidate);
      }
    }
  }

  return quotes;
}

function buildToolsSchema() {
  return [
    {
      type: 'function',
      function: {
        name: 'search_document',
        description:
          "Keyword search across a single document's pages. Returns up to topK passages with page numbers and surrounding context. Use this first to locate relevant material before reading full pages.",
        parameters: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'The id of the document to search, from AVAILABLE DOCUMENTS.' },
            query: { type: 'string', description: 'Search phrase or keywords.' },
            topK: { type: 'number', description: 'Max number of hits to return (default 5).' },
          },
          required: ['docId', 'query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_sections',
        description: "Lists a document's structural outline (headings/pages) to help decide where to look.",
        parameters: {
          type: 'object',
          properties: { docId: { type: 'string' } },
          required: ['docId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_page_content',
        description: 'Retrieves the full text of one specific page of a document.',
        parameters: {
          type: 'object',
          properties: {
            docId: { type: 'string' },
            pageNumber: { type: 'number' },
          },
          required: ['docId', 'pageNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_span',
        description: "Reads an exact character range from a document's full text.",
        parameters: {
          type: 'object',
          properties: {
            docId: { type: 'string' },
            startChar: { type: 'number' },
            endChar: { type: 'number' },
          },
          required: ['docId', 'startChar', 'endChar'],
        },
      },
    },
  ];
}

function buildSystemPrompt(documents: ExtractedDocument[]): string {
  const docList = documents
    .map((d) => `- id="${d.id}" filename="${d.filename}" pageCount=${d.pageCount}`)
    .join('\n');

  return `You are an elite legal contract analyst with tool access to the documents listed below. You do NOT have their text in this prompt — you must call tools to read them before answering.

AVAILABLE DOCUMENTS:
${docList}

TOOLS: search_document, list_sections, get_page_content, read_span. Always pass the exact "docId" shown above.

RULES:
1. Call tools to gather evidence before answering. Do not answer from assumption.
2. If the question spans multiple documents, call tools on each relevant document and compare them in your final answer rather than only answering about one.
3. Back every factual claim with an exact, verbatim quotation enclosed strictly in <quote>...</quote> tags. Never paraphrase inside the tags, and never truncate or alter the quoted text.
4. You have a hard cap of a few tool-call rounds. If you only had time to check some pages/sections of a large document, say so explicitly in your final answer instead of claiming full coverage (e.g. "I checked pages 1-3 and found no mention of X; the remaining pages were not reviewed").
5. If information is not present in what you reviewed, state that clearly rather than inventing an answer.
6. When your research is complete, reply with your final answer as plain text with no further tool calls.`;
}

async function callGroqChatWithTools(messages: any[], tools: any[]): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key configured (set GROQ_API_KEY in environment variables).');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  return res.json();
}

/** Verifies candidate quotes against every provided document, attaching which document each verified quote came from. */
function verifyQuotesAcrossDocuments(
  quotes: string[],
  documents: ExtractedDocument[]
): (QuoteVerificationResult & { docId?: string; docFilename?: string })[] {
  return quotes.map((q) => {
    let best: (QuoteVerificationResult & { docId?: string; docFilename?: string }) | null = null;

    for (const d of documents) {
      const result = verifyQuote(q, d);
      const withDoc = { ...result, docId: d.id, docFilename: d.filename };

      if (result.isVerified) {
        if (!best || !best.isVerified || result.confidence > best.confidence) {
          best = withDoc;
        }
        if (result.matchType === 'exact') break;
      } else if (!best) {
        best = withDoc;
      }
    }

    return best || { isVerified: false, rawQuote: q, matchType: 'unverified', confidence: 0 };
  });
}

function runOfflineFallback(
  config: AgentRunConfig,
  documents: ExtractedDocument[],
  maxIter: number,
  emitStep: (event: Omit<AgentStepEvent, 'timestamp'>) => void
): AgentRunResult {
  let iteration = 1;
  const allHits: Array<{ text: string; pageNumber: number; docId: string; filename: string }> = [];

  for (const d of documents) {
    if (iteration > maxIter) break;

    const res = executeAgentTool('search_document', { docId: d.id, query: config.question, topK: 3 }, documents);

    emitStep({
      iteration,
      action: 'search_document',
      detail:
        res.ok && Array.isArray(res.data) && res.data.length > 0
          ? `Found ${res.data.length} passage(s) in "${d.filename}"`
          : `No direct keyword matches in "${d.filename}"`,
      toolCall: { id: `call_${iteration}`, name: 'search_document', params: { docId: d.id, query: config.question } },
      toolResult: res,
    });

    if (res.ok && Array.isArray(res.data)) {
      for (const hit of res.data as any[]) {
        allHits.push({ text: hit.context, pageNumber: hit.pageNumber, docId: d.id, filename: d.filename });
      }
    }
    iteration++;
  }

  let answer: string;
  if (allHits.length > 0) {
    const lines = allHits
      .slice(0, 5)
      .map(
        (h) =>
          `From "${h.filename}" (Page ${h.pageNumber}): <quote>${h.text.replace(/\.\.\./g, '').trim().slice(0, 200)}</quote>`
      );
    answer =
      `### Research Findings (offline mode \u2014 no LLM API key configured)\n\n${lines.join('\n\n')}\n\n` +
      `_This is a keyword-search fallback, not a full reasoning pass, and only reflects passages matching your literal search terms. Configure GROQ_API_KEY for full agentic analysis._`;
  } else {
    answer =
      `No passages matching "${config.question}" were found via keyword search across ${documents.length} document(s). ` +
      `This does not guarantee the information is absent \u2014 only that these exact keywords were not found. Configure GROQ_API_KEY for full agentic analysis.`;
  }

  emitStep({ iteration: Math.min(iteration, maxIter), action: 'final_answer', detail: 'Offline fallback answer generated (no LLM configured)' });

  const candidateQuotes = extractQuoteCandidates(answer);
  const citations = verifyQuotesAcrossDocuments(candidateQuotes, documents);
  const formattedAnswer = answer.replace(/<quote>([\s\S]*?)<\/quote>/gi, '"$1"');

  return { answer: formattedAnswer, citations, steps: [], terminationReason: 'final_answer' };
}

/**
 * Runs the agentic research loop across one or multiple documents.
 */
export async function runAgentLoop(
  config: AgentRunConfig,
  doc: ExtractedDocument | ExtractedDocument[],
  options?: AgentRunnerOptions
): Promise<AgentRunResult> {
  const documents = (Array.isArray(doc) ? doc : [doc]).filter(Boolean);

  if (documents.length === 0) {
    return { answer: 'Error: No document available for research.', citations: [], steps: [], terminationReason: 'error' };
  }

  const maxIter = Math.min(Math.max(1, config.maxIterations || 5), 6);
  const steps: AgentStepEvent[] = [];

  const emitStep = (event: Omit<AgentStepEvent, 'timestamp'>) => {
    const fullEvent: AgentStepEvent = { ...event, timestamp: Date.now() };
    steps.push(fullEvent);
    options?.onStep?.(fullEvent);
  };

  const hasKey = Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);

  if (!hasKey) {
    const result = runOfflineFallback(config, documents, maxIter, emitStep);
    return { ...result, steps };
  }

  const tools = buildToolsSchema();
  const messages: any[] = [
    { role: 'system', content: buildSystemPrompt(documents) },
    { role: 'user', content: config.question },
  ];

  let finalAnswer = '';
  let iteration = 1;
  let hitMaxIterations = true;

  try {
    while (iteration <= maxIter) {
      const response = await callGroqChatWithTools(messages, tools);
      const choice = response.choices?.[0];
      const msg = choice?.message;

      if (!msg) {
        throw new Error('Malformed LLM response: no message returned.');
      }

      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        messages.push(msg);

        for (const tc of msg.tool_calls) {
          const toolName = tc.function?.name || 'unknown_tool';
          let args: Record<string, unknown> = {};
          try {
            args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
          } catch {
            args = {};
          }

          const result = executeAgentTool(toolName, args, documents);
          const knownAction = ['list_sections', 'search_document', 'get_page_content', 'get_section', 'read_span'].includes(toolName)
            ? toolName
            : 'search_document';

          emitStep({
            iteration,
            action: knownAction as any,
            detail: result.ok
              ? `${toolName}(${JSON.stringify(args)}) \u2192 ok`
              : `${toolName}(${JSON.stringify(args)}) \u2192 error: ${result.error}`,
            toolCall: { id: tc.id || `call_${iteration}`, name: toolName, params: args },
            toolResult: result,
          });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }

        iteration++;
        continue;
      }

      finalAnswer = msg.content || '';
      hitMaxIterations = false;
      emitStep({ iteration, action: 'final_answer', detail: 'Model produced a final answer after tool research.' });
      break;
    }
  } catch (err) {
    emitStep({ iteration, action: 'error', detail: err instanceof Error ? err.message : String(err) });
    return {
      answer: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
      citations: [],
      steps,
      terminationReason: 'error',
    };
  }

  if (!finalAnswer) {
    finalAnswer = hitMaxIterations
      ? 'I reached the maximum number of research steps before finishing. Based on what I reviewed so far, I could not form a complete, verified answer \u2014 please try a narrower question or ask again.'
      : 'I was unable to generate an answer.';
    emitStep({
      iteration: Math.min(iteration, maxIter),
      action: 'final_answer',
      detail: 'Terminated without a model-generated final answer.',
    });
  }

  const candidateQuotes = extractQuoteCandidates(finalAnswer);
  const citations = verifyQuotesAcrossDocuments(candidateQuotes, documents);
  const formattedAnswer = finalAnswer.replace(/<quote>([\s\S]*?)<\/quote>/gi, '"$1"');

  return {
    answer: formattedAnswer,
    citations,
    steps,
    terminationReason: hitMaxIterations ? 'max_iterations_reached' : 'final_answer',
  };
}
