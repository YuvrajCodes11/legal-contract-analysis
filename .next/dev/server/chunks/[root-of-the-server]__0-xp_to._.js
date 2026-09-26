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
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

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
"[project]/src/app/api/documents/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/document-store.ts [app-route] (ecmascript)");
;
;
async function GET(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const raw = searchParams.get('raw');
    if (id) {
        const doc = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].getDocument(id);
        if (!doc) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Document not found'
            }, {
                status: 404
            });
        }
        if (raw === 'true') {
            const fileData = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].getFileBuffer(id);
            if (fileData) {
                return new Response(new Uint8Array(fileData.buffer), {
                    headers: {
                        'Content-Type': fileData.mimeType,
                        'Content-Disposition': `inline; filename="${doc.filename}"`
                    }
                });
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            data: doc
        });
    }
    const list = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].listDocuments();
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true,
        data: list
    });
}
async function DELETE(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: 'ID parameter is required'
        }, {
            status: 400
        });
    }
    const deleted = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$document$2d$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["documentStore"].deleteDocument(id);
    if (!deleted) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: 'Document not found'
        }, {
            status: 404
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true,
        message: 'Document deleted successfully'
    });
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
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-xp_to._.js.map