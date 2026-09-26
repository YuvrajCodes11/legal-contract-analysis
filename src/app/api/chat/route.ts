import { NextRequest } from 'next/server';
import { documentStore } from '@/lib/document-store';
import { runAgentLoop } from '@/lib/agent-runner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentIds, question, documents: providedDocs } = body;

    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Parameter "question" is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetDocs = Array.isArray(providedDocs) && providedDocs.length > 0
      ? providedDocs
      : (() => {
          const docList = documentStore.listDocuments();
          const idsToSearch = Array.isArray(documentIds) && documentIds.length > 0
            ? documentIds
            : docList.map((d) => d.id);
          return idsToSearch
            .map((id) => documentStore.getDocument(id))
            .filter((d): d is NonNullable<typeof d> => d !== undefined);
        })();

    if (targetDocs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No uploaded documents found to analyze.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const result = await runAgentLoop(
            {
              docId: targetDocs[0].id,
              question,
              maxIterations: 6,
            },
            targetDocs,
            {
              onStep: (step) => {
                if (req.signal.aborted) return;
                sendEvent({ type: 'step', event: step });
              },
            }
          );

          if (req.signal.aborted) {
            controller.close();
            return;
          }

          sendEvent({
            type: 'done',
            answer: result.answer,
            citations: result.citations,
            steps: result.steps,
            terminationReason: result.terminationReason,
          });

          controller.close();
        } catch (err) {
          sendEvent({
            type: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Chat request failed: ${err instanceof Error ? err.message : String(err)}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
