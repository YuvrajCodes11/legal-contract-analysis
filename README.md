# Legal Contract Analysis Workstation

A web app for analyzing legal contracts: upload a PDF or DOCX, ask questions about it in a chat interface, and get answers backed by verified, clickable quotes from the source document.

**Live deployment:** https://legal-contract-analysis.vercel.app

---

## What the app does

- **Upload & process** PDF and DOCX contracts. Unsupported file types are rejected with a clear message. Scanned/image-only PDFs with no readable text layer are detected and flagged to the user, rather than silently saved as empty documents.
- **Chat with a document** (or multiple documents at once) and get streamed answers, with the ability to stop generation mid-answer without losing what was already written.
- **Verified quotes**: every factual claim in an answer is backed by an exact quote. Before any quote is shown, the backend independently confirms it exists in the source document text — normalizing whitespace/line-break noise from PDF extraction so genuine quotes aren't wrongly rejected. If a quote can't be verified, it's shown flagged as unverified rather than presented as fact.
- **Citation highlighting**: clicking a verified quote jumps to and highlights that exact passage in the document viewer.
- **Multi-document questions**: select several uploaded contracts and ask one question across all of them; each quote is verified against its own source document and labeled with which document it came from.
- **Document comparison**: upload two versions of a contract and see differences at clause/paragraph level, categorized by severity (Critical / Substantive / Cosmetic), with a plain-language summary of what changed.
- **Agentic research (Part C, Option 2)**: instead of a fixed retrieval pipeline, the model is given real tools (`search_document`, `list_sections`, `get_page_content`, `read_span`) and decides, round by round, what to look up before answering — capped at 6 iterations, with tool calls streamed live to the UI as they happen.

---

## Screenshots

<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/c73a68aa-f932-497a-9bb8-3419377febac" />

<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/2e388086-7c89-4808-b12e-863dbb3e2756" />

## How to run it locally

**Requirements:** Node.js 18+, npm.

```bash
git clone https://github.com/YuvrajCodes11/legal-contract-analysis.git
cd legal-contract-analysis
npm install
```

Create a `.env.local` file in the project root:

```
GROQ_API_KEY=your_groq_api_key_here
```

Get a free key at https://console.groq.com. Without this key set, the app still runs — chat falls back to a keyword-search-only mode (clearly labeled as such in the answer) instead of the full agentic tool-calling loop.

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

**Production build** (matches what's deployed on Vercel):

```bash
npm run build
npx next start
```

---

## Tech stack

- **Next.js 16** (App Router), React 19, TypeScript
- **PDF text extraction**: [`unpdf`](https://github.com/unjs/unpdf) — chosen specifically because it works in serverless/edge runtimes without native dependencies (no canvas/DOMMatrix polyfills required, unlike `pdf-parse`)
- **DOCX text extraction**: `mammoth`
- **LLM provider**: Groq (`openai/gpt-oss-20b`), via `GROQ_API_KEY`
- **Storage**: in-memory (see "Known limitations" below)
- Deployed on **Vercel**

---

## What's finished

- PDF and DOCX upload, extraction, and processing status feedback
- Scanned/image-only PDF detection with a clear user-facing message
- Streaming chat answers with stop/cancel support, kept partial output
- Verified-quote pipeline: exact + fuzzy (whitespace/typography-normalized) matching against real source text, never fabricated
- Document library: list, open, delete
- Citation highlighting: click a quote → jump to and highlight the exact passage
- Multi-document chat: ask across several contracts at once, each quote scoped and labeled to its own source document
- Document comparison: clause-level diffing with Critical/Substantive/Cosmetic severity and filtering
- Real multi-round agentic tool-calling loop (Part C, Option 2), capped at 6 iterations, with live step-by-step tool trace shown in the UI
- Chat history persisted per document (stored in the browser)

## What's not finished / known limitations

- **Document storage is in-memory**, not a database. This means uploaded documents can be lost if the serverless function restarts or a request lands on a different instance. Chat requests now send the full document content directly to avoid depending on this store surviving between requests, which mitigates the main practical impact, but document *storage* itself is not yet persistent across restarts.
- **No semantic/embedding-based search** — retrieval is keyword-based (BM25-style token/exact-match overlap). A colloquial question that doesn't share vocabulary with the contract's formal clause language may not retrieve the right passage. This is the top priority for future work (see note below).
- **Part C Option 1 (tracked-changes DOCX redlining) was not attempted** — Option 2 (agentic research) was chosen instead.
- No OCR: scanned PDFs are correctly detected and flagged, but not processed — the user must supply a text-layer PDF.
- No Arabic/RTL layout support yet.
- Automated test suite (`src/lib/__tests__/`) has not been updated to match the latest agent-runner/agent-tools implementation and may show failures unrelated to the live app's behavior.

---

## Notes on quote verification, large documents, and Part C

[Legal_Contract_Analysis_Workstation_Architecture_Review.pdf](https://github.com/user-attachments/files/32689236/Legal_Contract_Analysis_Workstation_Architecture_Review.pdf)
