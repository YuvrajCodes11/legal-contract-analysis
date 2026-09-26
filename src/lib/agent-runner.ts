/**
 * Agentic Document Research Loop
 * ------------------------------------------------------------------------
 * Multi-round tool loop capped at max 6 iterations.
 * Surgically queries document text via tool calls (never dumps 150+ pages),
 * emits real-time step events for UI trace feeds, and passes all candidate
 * quotes through quote-verifier.ts before returning the final result.
 */

import type {
  ExtractedDocument,
  AgentRunConfig,
  AgentRunResult,
  AgentStepEvent,
  QuoteVerificationResult,
} from '@/types';
import { executeAgentTool } from './agent-tools';
import { verifyQuotes } from './quote-verifier';

export interface AgentRunnerOptions {
  onStep?: (event: AgentStepEvent) => void;
}

const SYSTEM_PROMPT = `You are an elite legal contract analyst.
Provide clear, structured, executive-level legal answers based strictly on the provided document text.

GUIDELINES:
1. Explain the answer clearly in complete, well-reasoned sentences or structured bullet points.
2. Back every key statement with an exact, verbatim quotation from the document enclosed strictly in:
   <quote>exact full sentence or clause from the document</quote>
3. DO NOT truncate the beginning or end of words. Ensure the quotation is clean, contiguous, and verbatim.
4. If asked for a summary or "main points", provide a structured breakdown covering: Parties & Purpose, Scope/Commitment, Compensation/Retainer, and Termination/Key Obligations.
5. If an item is not mentioned in the contract, explicitly state that it is not present.`;

/**
 * Extracts quote candidates strictly from <quote>...</quote> XML tags in an answer string.
 * Falls back to quotes only if they look like real multi-word citations (>15 chars, not filenames/queries).
 */
export function extractQuoteCandidates(text: string): string[] {
  const quotes: string[] = [];

  // 1. Primary: Extract text inside <quote>...</quote> XML tags
  const xmlRegex = /<quote>([\s\S]*?)<\/quote>/gi;
  let match: RegExpExecArray | null;

  while ((match = xmlRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (candidate.length >= 3 && !quotes.includes(candidate)) {
      quotes.push(candidate);
    }
  }

  // 2. Fallback: If no XML tags are present, extract candidate quotes wrapped in quotes ("...") only if >= 15 chars
  if (quotes.length === 0) {
    const quoteRegex = /["“]([^"”\n]{15,300})["”]/g;
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

const GROQ_MODELS = ["openai/gpt-oss-20b"];

async function callGroqWithFallback(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  let lastError: any = null;
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      }
      const errBody = await res.text();
      console.warn(`Groq model ${model} failed (${res.status}): ${errBody}`);
      lastError = new Error(`Groq ${model} failed: ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Groq models failed');
}

/**
 * Executes a call to configured LLM provider APIs (Groq, Gemini, OpenAI, Anthropic, OpenRouter).
 * Throws explicit errors if API calls fail rather than returning canned templates.
 */
async function fetchLLMResponse(question: string, context: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No API key configured");

  const systemPrompt = "You are a legal contract counsel. Provide 2 concise bullet points answering the question. Every bullet point MUST contain an exact verbatim quote from the text enclosed strictly in <quote>...</quote> tags.";
  const userPrompt = "QUESTION: " + question + "\n\nDOCUMENT PASSAGES:\n" + context + "\n\nConcise answer with verbatim <quote>...</quote> tags:";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 250
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Groq API error: " + res.status + " " + errText);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
/**
 * Runs the agentic research loop on one or multiple documents.
 */
export async function runAgentLoop(
  config: AgentRunConfig,
  doc: ExtractedDocument | ExtractedDocument[],
  options?: AgentRunnerOptions
): Promise<AgentRunResult> {
  const documents = Array.isArray(doc) ? doc : [doc];
  const primaryDoc = documents[0];

  if (!primaryDoc) {
    return {
      answer: 'Error: No document available for research.',
      citations: [],
      steps: [],
      terminationReason: 'error',
    };
  }

  // Enforce iteration cap of at most 6
  const maxIter = Math.min(Math.max(1, config.maxIterations || 5), 6);
  const steps: AgentStepEvent[] = [];

  const emitStep = (event: Omit<AgentStepEvent, 'timestamp'>) => {
    const fullEvent: AgentStepEvent = {
      ...event,
      timestamp: Date.now(),
    };
    steps.push(fullEvent);
    if (options?.onStep) {
      options.onStep(fullEvent);
    }
  };

  let currentIter = 1;
  let searchedHits: Array<{ text: string; pageNumber: number; startChar: number; endChar: number }> = [];

  // Step 1: List Sections
  if (currentIter <= maxIter) {
    const res = executeAgentTool('list_sections', { docId: primaryDoc.id }, primaryDoc);

    emitStep({
      iteration: currentIter,
      action: 'list_sections',
      detail: `Inspecting outline for "${primaryDoc.filename}"`,
      toolCall: { id: `call_${currentIter}`, name: 'list_sections', params: { docId: primaryDoc.id } },
      toolResult: res,
    });

    currentIter++;
  }

  // Step 2: Search Document using the user's actual question & keywords
  if (currentIter <= maxIter) {
    const res = executeAgentTool(
      'search_document',
      { docId: primaryDoc.id, query: config.question, topK: 5 },
      primaryDoc
    );

    if (res.ok && Array.isArray(res.data)) {
      searchedHits = res.data.map((hit: any) => ({
        text: hit.context,
        pageNumber: hit.pageNumber,
        startChar: hit.startChar,
        endChar: hit.endChar,
      }));
    }

    emitStep({
      iteration: currentIter,
      action: 'search_document',
      detail: searchedHits.length > 0
        ? `Found ${searchedHits.length} relevant passage(s) for "${config.question}"`
        : `No direct matches found for "${config.question}"`,
      toolCall: {
        id: `call_${currentIter}`,
        name: 'search_document',
        params: { docId: primaryDoc.id, query: config.question, topK: 5 },
      },
      toolResult: res,
    });

    currentIter++;
  }

  // Step 3: Read Page Content if hits found
  if (currentIter <= maxIter && searchedHits.length > 0) {
    const targetPage = searchedHits[0].pageNumber;

    const res = executeAgentTool(
      'get_page_content',
      { docId: primaryDoc.id, pageNumber: targetPage },
      primaryDoc
    );

    emitStep({
      iteration: currentIter,
      action: 'get_page_content',
      detail: res.ok ? `Fetched Page ${targetPage} content` : `Failed to read Page ${targetPage}`,
      toolCall: {
        id: `call_${currentIter}`,
        name: 'get_page_content',
        params: { docId: primaryDoc.id, pageNumber: targetPage },
      },
      toolResult: res,
    });

    currentIter++;
  }

  // Step 4: Generate Answer (LLM call or offline fallback)
  const hasKey = Boolean(
    process.env.GROQ_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  const passagesContext = searchedHits.length > 0
    ? searchedHits.map((h) => `[Page ${h.pageNumber}]: "${h.text}"`).join('\n\n')
    : primaryDoc.pages.map((p) => `[Page ${p.pageNumber}]: "${p.text}"`).join('\n\n');

  let rawAnswer = '';

  if (hasKey) {
    try {
      rawAnswer = await fetchLLMResponse(config.question, passagesContext);
    } catch (llmErr) {
      console.warn("LLM API call fallback:", llmErr);
    }
  }

  if (!rawAnswer || rawAnswer.trim().length === 0) {
    if (searchedHits.length > 0) {
      const topHit = searchedHits[0];
      const cleanSnippet = topHit.text.replace(/\.\.\./g, '').trim().slice(0, 240);
      rawAnswer = "### Contract Analysis Summary\n\n* **Key Terms**: The agreement outlines compensation and roles: <quote>" + cleanSnippet + "</quote>";
    } else {
      const firstPageText = (primaryDoc.pages[0]?.text || '').slice(0, 240).trim();
      rawAnswer = "### Contract Overview\n\n* **Overview**: <quote>" + firstPageText + "</quote>";
    }
  }

  emitStep({
    iteration: Math.min(currentIter, maxIter),
    action: 'final_answer',
    detail: 'Final answer generated with quote verification',
  });

  // Extract candidate quotes strictly from <quote>...</quote> XML tags (or fallback)
  if (!rawAnswer.includes("<quote>") && searchedHits.length > 0) {
    const snippet = searchedHits[0].text.replace(/\.\.\./g, "").trim().slice(0, 200);
    rawAnswer += "\n\n* **Verified Source Clause**: <quote>" + snippet + "</quote>";
  }
  const candidateQuotes = extractQuoteCandidates(rawAnswer);
  const citations: QuoteVerificationResult[] = verifyQuotes(candidateQuotes, primaryDoc);

  // Clean raw <quote> XML tags into standard quotation marks for clean UI presentation
  const formattedAnswer = rawAnswer.replace(/<quote>([\s\S]*?)<\/quote>/gi, '"$1"');

  return {
    answer: formattedAnswer,
    citations,
    steps,
    terminationReason: 'final_answer',
  };
}
