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
"[project]/src/lib/agent-runner.ts [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

var e = new Error("Could not parse module '[project]/src/lib/agent-runner.ts'\n\nExpression expected");
e.code = 'MODULE_UNPARSABLE';
throw e;
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
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1iob282._.js.map