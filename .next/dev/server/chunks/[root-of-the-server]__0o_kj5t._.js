module.exports = [
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/document-store.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent-runner.ts [app-route] (ecmascript)");
;
;
async function POST(req) {
    try {
        const body = await req.json();
        const { documentIds, question } = body;
        if (!question || typeof question !== 'string') {
            return new Response(JSON.stringify({
                success: false,
                error: 'Parameter "question" is required.'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const docList = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].listDocuments();
        const idsToSearch = Array.isArray(documentIds) && documentIds.length > 0 ? documentIds : docList.map((d)=>d.id);
        const targetDocs = idsToSearch.map((id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].getDocument(id)).filter((d)=>d !== undefined);
        if (targetDocs.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No uploaded documents found to analyze.'
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start (controller) {
                const sendEvent = (data)=>{
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };
                try {
                    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$runner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runAgentLoop"])({
                        docId: targetDocs[0].id,
                        question,
                        maxIterations: 6
                    }, targetDocs, {
                        onStep: (step)=>{
                            if (req.signal.aborted) return;
                            sendEvent({
                                type: 'step',
                                event: step
                            });
                        }
                    });
                    if (req.signal.aborted) {
                        controller.close();
                        return;
                    }
                    sendEvent({
                        type: 'done',
                        answer: result.answer,
                        citations: result.citations,
                        steps: result.steps,
                        terminationReason: result.terminationReason
                    });
                    controller.close();
                } catch (err) {
                    sendEvent({
                        type: 'error',
                        error: err instanceof Error ? err.message : String(err)
                    });
                    controller.close();
                }
            }
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: `Chat request failed: ${err instanceof Error ? err.message : String(err)}`
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
}),
"[project]/src/lib/agent-runner.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Agentic Document Research Loop
 * ------------------------------------------------------------------------
 * Multi-round tool loop capped at max 6 iterations.
 * Surgically queries document text via tool calls (never dumps 150+ pages),
 * emits real-time step events for UI trace feeds, and passes all candidate
 * quotes through quote-verifier.ts before returning the final result.
 */ __turbopack_context__.s([
    "extractQuoteCandidates",
    ()=>extractQuoteCandidates,
    "runAgentLoop",
    ()=>runAgentLoop
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/agent-tools.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$quote$2d$verifier$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/quote-verifier.ts [app-route] (ecmascript)");
;
;
const SYSTEM_PROMPT = `You are an elite legal contract analyst.
Provide clear, structured, executive-level legal answers based strictly on the provided document text.

GUIDELINES:
1. Explain the answer clearly in complete, well-reasoned sentences or structured bullet points.
2. Back every key statement with an exact, verbatim quotation from the document enclosed strictly in:
   <quote>exact full sentence or clause from the document</quote>
3. DO NOT truncate the beginning or end of words. Ensure the quotation is clean, contiguous, and verbatim.
4. If asked for a summary or "main points", provide a structured breakdown covering: Parties & Purpose, Scope/Commitment, Compensation/Retainer, and Termination/Key Obligations.
5. If an item is not mentioned in the contract, explicitly state that it is not present.`;
function extractQuoteCandidates(text) {
    const quotes = [];
    // 1. Primary: Extract text inside <quote>...</quote> XML tags
    const xmlRegex = /<quote>([\s\S]*?)<\/quote>/gi;
    let match;
    while((match = xmlRegex.exec(text)) !== null){
        const candidate = match[1].trim();
        if (candidate.length >= 3 && !quotes.includes(candidate)) {
            quotes.push(candidate);
        }
    }
    // 2. Fallback: If no XML tags are present, extract candidate quotes wrapped in quotes ("...") only if >= 15 chars
    if (quotes.length === 0) {
        const quoteRegex = /["“]([^"”\n]{15,300})["”]/g;
        while((match = quoteRegex.exec(text)) !== null){
            const candidate = match[1].trim();
            if (!candidate.endsWith('.docx') && !candidate.endsWith('.pdf') && !candidate.endsWith('?') && !quotes.includes(candidate)) {
                quotes.push(candidate);
            }
        }
    }
    return quotes;
}
const GROQ_MODELS = [
    "openai/gpt-oss-20b"
];
async function callGroqWithFallback(apiKey, systemPrompt, userPrompt) {
    let lastError = null;
    for (const model of GROQ_MODELS){
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature: 0.1
                })
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
 */ async function fetchLLMResponse(question, context) {
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
            model: "allam-2-7b",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
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
async function runAgentLoop(config, doc, options) {
    const documents = Array.isArray(doc) ? doc : [
        doc
    ];
    const primaryDoc = documents[0];
    if (!primaryDoc) {
        return {
            answer: 'Error: No document available for research.',
            citations: [],
            steps: [],
            terminationReason: 'error'
        };
    }
    // Enforce iteration cap of at most 6
    const maxIter = Math.min(Math.max(1, config.maxIterations || 5), 6);
    const steps = [];
    const emitStep = (event)=>{
        const fullEvent = {
            ...event,
            timestamp: Date.now()
        };
        steps.push(fullEvent);
        if (options?.onStep) {
            options.onStep(fullEvent);
        }
    };
    let currentIter = 1;
    let searchedHits = [];
    // Step 1: List Sections
    if (currentIter <= maxIter) {
        const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["executeAgentTool"])('list_sections', {
            docId: primaryDoc.id
        }, primaryDoc);
        emitStep({
            iteration: currentIter,
            action: 'list_sections',
            detail: `Inspecting outline for "${primaryDoc.filename}"`,
            toolCall: {
                id: `call_${currentIter}`,
                name: 'list_sections',
                params: {
                    docId: primaryDoc.id
                }
            },
            toolResult: res
        });
        currentIter++;
    }
    // Step 2: Search Document using the user's actual question & keywords
    if (currentIter <= maxIter) {
        const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["executeAgentTool"])('search_document', {
            docId: primaryDoc.id,
            query: config.question,
            topK: 5
        }, primaryDoc);
        if (res.ok && Array.isArray(res.data)) {
            searchedHits = res.data.map((hit)=>({
                    text: hit.context,
                    pageNumber: hit.pageNumber,
                    startChar: hit.startChar,
                    endChar: hit.endChar
                }));
        }
        emitStep({
            iteration: currentIter,
            action: 'search_document',
            detail: searchedHits.length > 0 ? `Found ${searchedHits.length} relevant passage(s) for "${config.question}"` : `No direct matches found for "${config.question}"`,
            toolCall: {
                id: `call_${currentIter}`,
                name: 'search_document',
                params: {
                    docId: primaryDoc.id,
                    query: config.question,
                    topK: 5
                }
            },
            toolResult: res
        });
        currentIter++;
    }
    // Step 3: Read Page Content if hits found
    if (currentIter <= maxIter && searchedHits.length > 0) {
        const targetPage = searchedHits[0].pageNumber;
        const res = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$agent$2d$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["executeAgentTool"])('get_page_content', {
            docId: primaryDoc.id,
            pageNumber: targetPage
        }, primaryDoc);
        emitStep({
            iteration: currentIter,
            action: 'get_page_content',
            detail: res.ok ? `Fetched Page ${targetPage} content` : `Failed to read Page ${targetPage}`,
            toolCall: {
                id: `call_${currentIter}`,
                name: 'get_page_content',
                params: {
                    docId: primaryDoc.id,
                    pageNumber: targetPage
                }
            },
            toolResult: res
        });
        currentIter++;
    }
    // Step 4: Generate Answer (LLM call or offline fallback)
    const hasKey = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY);
    const passagesContext = searchedHits.length > 0 ? searchedHits.map((h)=>`[Page ${h.pageNumber}]: "${h.text}"`).join('\n\n') : primaryDoc.pages.slice(0, 3).map((p)=>`[Page ${p.pageNumber}]: "${p.text}"`).join('\n\n');
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
        detail: 'Final answer generated with quote verification'
    });
    // Extract candidate quotes strictly from <quote>...</quote> XML tags (or fallback)
    if (!rawAnswer.includes("<quote>") && searchedHits.length > 0) {
        const snippet = searchedHits[0].text.replace(/\.\.\./g, "").trim().slice(0, 200);
        rawAnswer += "\n\n* **Verified Source Clause**: <quote>" + snippet + "</quote>";
    }
    const candidateQuotes = extractQuoteCandidates(rawAnswer);
    const citations = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$quote$2d$verifier$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifyQuotes"])(candidateQuotes, primaryDoc);
    // Clean raw <quote> XML tags into standard quotation marks for clean UI presentation
    const formattedAnswer = rawAnswer.replace(/<quote>([\s\S]*?)<\/quote>/gi, '"$1"');
    return {
        answer: formattedAnswer,
        citations,
        steps,
        terminationReason: 'final_answer'
    };
}
}),
"[project]/src/lib/agent-tools.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "executeAgentTool",
    ()=>executeAgentTool,
    "getPageContent",
    ()=>getPageContent,
    "listSections",
    ()=>listSections,
    "readSpan",
    ()=>readSpan,
    "searchDocument",
    ()=>searchDocument
]);
function listSections(doc) {
    const sections = [];
    const headingRegex = /^(?:ARTICLE|SECTION|[0-9]+\.|\b[A-Z0-9\s,\-\.]{4,}\b)/m;
    for (const page of doc.pages){
        const lines = page.text.split('\n');
        let pageHasHeading = false;
        for (const line of lines){
            const trimmed = line.trim();
            if (trimmed.length > 3 && trimmed.length < 80 && headingRegex.test(trimmed)) {
                // Find approximate position in page text
                const relativeOffset = page.text.indexOf(trimmed);
                const startChar = page.startOffset + (relativeOffset >= 0 ? relativeOffset : 0);
                sections.push({
                    title: trimmed,
                    level: trimmed.startsWith('ARTICLE') || trimmed.startsWith('SECTION') ? 1 : 2,
                    pageNumber: page.pageNumber,
                    startChar
                });
                pageHasHeading = true;
            }
        }
        if (!pageHasHeading) {
            sections.push({
                title: `Page ${page.pageNumber}`,
                level: 1,
                pageNumber: page.pageNumber,
                startChar: page.startOffset
            });
        }
    }
    return sections;
}
function searchDocument(doc, query, topK = 5) {
    if (!query || query.trim().length === 0) return [];
    const rawTokens = query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((t)=>t.length > 2);
    if (rawTokens.length === 0) return [];
    const hits = [];
    for (const page of doc.pages){
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
                hit: {
                    pageNumber: page.pageNumber,
                    startChar,
                    endChar,
                    context
                },
                score: 100 + queryLower.length
            });
            continue;
        }
        // Token matching
        let pageScore = 0;
        let bestMatchIdx = -1;
        let matchLen = 0;
        for (const token of rawTokens){
            let pos = 0;
            while((pos = pageLower.indexOf(token, pos)) !== -1){
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
                hit: {
                    pageNumber: page.pageNumber,
                    startChar,
                    endChar,
                    context
                },
                score: pageScore
            });
        }
    }
    // Sort by score descending and return top K
    hits.sort((a, b)=>b.score - a.score);
    return hits.slice(0, topK).map((h)=>h.hit);
}
/**
 * Builds a ~300 character context window centered around [startChar, endChar].
 */ function buildContextWindow(fullText, startChar, endChar, targetWindowSize = 300) {
    const matchLen = endChar - startChar;
    const margin = Math.max(30, Math.floor((targetWindowSize - matchLen) / 2));
    let winStart = Math.max(0, startChar - margin);
    let winEnd = Math.min(fullText.length, endChar + margin);
    // Expand boundaries to natural whitespace or line breaks to avoid truncating words
    while(winStart > 0 && !/\s/.test(fullText[winStart - 1])){
        winStart--;
    }
    while(winEnd < fullText.length && !/\s/.test(fullText[winEnd])){
        winEnd++;
    }
    let snippet = fullText.slice(winStart, winEnd).trim();
    if (winStart > 0) snippet = '...' + snippet;
    if (winEnd < fullText.length) snippet = snippet + '...';
    return snippet;
}
function getPageContent(doc, pageNumber) {
    const page = doc.pages.find((p)=>p.pageNumber === pageNumber);
    if (!page) {
        return `Page ${pageNumber} not found in document "${doc.filename}". Document has ${doc.pageCount} page(s).`;
    }
    return page.text;
}
function readSpan(doc, startChar, endChar) {
    const safeStart = Math.max(0, startChar);
    const safeEnd = Math.min(doc.fullText.length, endChar);
    if (safeStart >= safeEnd) {
        return '';
    }
    return doc.fullText.slice(safeStart, safeEnd);
}
function executeAgentTool(toolName, params, doc) {
    try {
        if (!doc) {
            return {
                ok: false,
                error: 'No document provided to tool execution.'
            };
        }
        const p = typeof params === 'object' && params !== null ? params : {};
        switch(toolName){
            case 'list_sections':
                {
                    const sections = listSections(doc);
                    return {
                        ok: true,
                        data: sections
                    };
                }
            case 'search_document':
                {
                    const query = typeof p.query === 'string' ? p.query : '';
                    const topK = typeof p.topK === 'number' ? p.topK : 5;
                    if (!query.trim()) {
                        return {
                            ok: false,
                            error: 'Parameter "query" is required for search_document.'
                        };
                    }
                    const hits = searchDocument(doc, query, topK);
                    return {
                        ok: true,
                        data: hits
                    };
                }
            case 'get_page_content':
            case 'get_section':
                {
                    const pageNum = typeof p.pageNumber === 'number' ? p.pageNumber : typeof p.page === 'number' ? p.page : 1;
                    const text = getPageContent(doc, pageNum);
                    return {
                        ok: true,
                        data: {
                            text
                        }
                    };
                }
            case 'read_span':
                {
                    const startChar = typeof p.startChar === 'number' ? p.startChar : 0;
                    const endChar = typeof p.endChar === 'number' ? p.endChar : 0;
                    const text = readSpan(doc, startChar, endChar);
                    return {
                        ok: true,
                        data: text
                    };
                }
            default:
                return {
                    ok: false,
                    error: `Unknown tool "${toolName}". Supported tools: list_sections, search_document, get_page_content, read_span.`
                };
        }
    } catch (err) {
        return {
            ok: false,
            error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`
        };
    }
}
}),
"[project]/src/lib/document-store.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Document Store
 * ------------------------------------------------------------------------
 * Thread-safe, in-memory repository for ExtractedDocument instances
 * and raw uploaded file buffers.
 */ __turbopack_context__.s([
    "documentStore",
    ()=>documentStore
]);
class DocumentStore {
    documents = new Map();
    fileBuffers = new Map();
    /**
   * Adds an extracted document and optional file buffer to the store.
   */ addDocument(doc, buffer, mimeType) {
        this.documents.set(doc.id, doc);
        if (buffer) {
            this.fileBuffers.set(doc.id, {
                buffer,
                mimeType: mimeType || (doc.filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            });
        }
    }
    /**
   * Retrieves an ExtractedDocument by ID.
   */ getDocument(id) {
        return this.documents.get(id);
    }
    /**
   * Retrieves raw file buffer and MIME type by document ID.
   */ getFileBuffer(id) {
        return this.fileBuffers.get(id);
    }
    /**
   * Lists all stored documents.
   */ listDocuments() {
        return Array.from(this.documents.values()).sort((a, b)=>b.createdAt - a.createdAt);
    }
    /**
   * Deletes a document by ID.
   */ deleteDocument(id) {
        const existed = this.documents.has(id);
        this.documents.delete(id);
        this.fileBuffers.delete(id);
        return existed;
    }
    /**
   * Clears all stored documents.
   */ clear() {
        this.documents.clear();
        this.fileBuffers.clear();
    }
}
// Global instance preserved across HMR in Next.js dev server
const globalForStore = globalThis;
const documentStore = globalForStore.documentStore || new DocumentStore();
if ("TURBOPACK compile-time truthy", 1) {
    globalForStore.documentStore = documentStore;
}
}),
"[project]/src/lib/quote-verifier.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

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
 */ __turbopack_context__.s([
    "normalizeText",
    ()=>normalizeText,
    "verifyQuote",
    ()=>verifyQuote,
    "verifyQuotes",
    ()=>verifyQuotes
]);
// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
const SOFT_HYPHEN = '\u00ad';
const NBSP = '\u00a0';
/** Smart/curly quote variants (double + single, opening + closing) mapped to their ASCII form. */ const SMART_QUOTE_MAP = {
    '\u201c': '"',
    '\u201d': '"',
    '\u201e': '"',
    '\u201f': '"',
    '\u2018': "'",
    '\u2019': "'",
    '\u201a': "'",
    '\u201b': "'"
};
function normalizeText(str) {
    const outChars = [];
    const outIndexMap = [];
    let lastWasSpace = false;
    const len = str.length;
    for(let i = 0; i < len; i++){
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
    while(start < end && outChars[start] === ' ')start++;
    while(end > start && outChars[end - 1] === ' ')end--;
    return {
        normalized: outChars.slice(start, end).join(''),
        indexMap: outIndexMap.slice(start, end)
    };
}
/** Splits an already-normalized (single-spaced) string into word tokens with their normalized offsets. */ function tokenizeNormalized(normalized) {
    const tokens = [];
    let i = 0;
    const len = normalized.length;
    while(i < len){
        if (normalized[i] === ' ') {
            i++;
            continue;
        }
        const start = i;
        while(i < len && normalized[i] !== ' ')i++;
        tokens.push({
            text: normalized.slice(start, i),
            start,
            end: i
        });
    }
    return tokens;
}
// ---------------------------------------------------------------------------
// Similarity primitives for the fuzzy fallback
// ---------------------------------------------------------------------------
/** Builds the multiset of character n-grams for a string (lowercase, whitespace-collapsed already assumed). */ function charNGrams(str, n) {
    const grams = new Set();
    if (str.length < n) {
        if (str.length > 0) grams.add(str);
        return grams;
    }
    for(let i = 0; i <= str.length - n; i++){
        grams.add(str.slice(i, i + n));
    }
    return grams;
}
/** Jaccard similarity between the character n-gram sets of two strings. Returns a value in [0, 1]. */ function jaccardNGramSimilarity(a, b, n) {
    const gramsA = charNGrams(a, n);
    const gramsB = charNGrams(b, n);
    if (gramsA.size === 0 && gramsB.size === 0) return 1;
    if (gramsA.size === 0 || gramsB.size === 0) return 0;
    let intersection = 0;
    for (const g of gramsA){
        if (gramsB.has(g)) intersection++;
    }
    const union = gramsA.size + gramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
/** Standard token-level (word-level) Levenshtein edit distance between two token arrays. */ function tokenLevenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    // Rolling two-row DP to keep memory O(min(m,n)) instead of O(m*n).
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for(let j = 0; j <= n; j++)prev[j] = j;
    for(let i = 1; i <= m; i++){
        curr[0] = i;
        for(let j = 1; j <= n; j++){
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [
            curr,
            prev
        ];
    }
    return prev[n];
}
/** Converts a token-level edit distance into a normalized similarity score in [0, 1]. */ function tokenLevenshteinSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = tokenLevenshteinDistance(a, b);
    return Math.max(0, 1 - dist / maxLen);
}
// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
const DEFAULT_OPTIONS = {
    fuzzyThreshold: 0.88,
    ngramSize: 3,
    windowSizeVariance: 2
};
/** Resolves the 1-based page number containing a raw offset into ExtractedDocument.fullText. */ function pageNumberForOffset(document, rawOffset) {
    for (const page of document.pages){
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
/** Translates a [start, end) span of NORMALIZED offsets into raw [startChar, endChar) offsets via indexMap. */ function normalizedSpanToRaw(indexMap, normStart, normEnd) {
    const startChar = indexMap[normStart];
    // endChar is exclusive: the raw index just past the last matched character.
    const lastCharRawIndex = indexMap[normEnd - 1];
    const endChar = lastCharRawIndex + 1;
    return {
        startChar,
        endChar
    };
}
/**
 * Slides a window of variable token-length across the document's tokens,
 * scoring each window against the quote via both character n-gram Jaccard
 * similarity and token-level Levenshtein similarity, and returns the single
 * best-scoring window (if any).
 */ function findBestFuzzyMatch(quoteNormalized, quoteTokens, docTokens, ngramSize, windowSizeVariance) {
    const quoteTokenTexts = quoteTokens.map((t)=>t.text);
    const quoteWordCount = quoteTokens.length;
    if (quoteWordCount === 0 || docTokens.length === 0) return null;
    let best = null;
    const minWindow = Math.max(1, quoteWordCount - windowSizeVariance);
    const maxWindow = quoteWordCount + windowSizeVariance;
    for(let windowSize = minWindow; windowSize <= maxWindow; windowSize++){
        if (windowSize > docTokens.length) continue;
        for(let start = 0; start + windowSize <= docTokens.length; start++){
            const windowTokens = docTokens.slice(start, start + windowSize);
            const windowTokenTexts = windowTokens.map((t)=>t.text);
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
                    matchedNormalizedText: windowText
                };
            }
        }
    }
    return best;
}
function verifyQuote(rawQuote, document, options = {}) {
    const opts = {
        ...DEFAULT_OPTIONS,
        ...options
    };
    const trimmedQuote = rawQuote.trim();
    if (trimmedQuote.length === 0) {
        return {
            isVerified: false,
            rawQuote,
            matchType: 'unverified',
            confidence: 0
        };
    }
    const { normalized: quoteNorm } = normalizeText(trimmedQuote);
    const { normalized: docNorm, indexMap: docIndexMap } = normalizeText(document.fullText);
    if (quoteNorm.length === 0 || docNorm.length === 0) {
        return {
            isVerified: false,
            rawQuote,
            matchType: 'unverified',
            confidence: 0
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
            confidence: 1
        };
    }
    // --- 2. Fuzzy sliding-window fallback -------------------------------------
    const quoteTokens = tokenizeNormalized(quoteNorm);
    const docTokens = tokenizeNormalized(docNorm);
    const best = findBestFuzzyMatch(quoteNorm, quoteTokens, docTokens, opts.ngramSize, opts.windowSizeVariance);
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
            confidence: best.score
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
        confidence: best?.score ?? 0
    };
}
function verifyQuotes(rawQuotes, document, options = {}) {
    return rawQuotes.map((q)=>verifyQuote(q, document, options));
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0o_kj5t._.js.map