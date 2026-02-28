/**
 * Dedicated SSE proxy for chat streaming.
 * Bypasses the catch-all proxy to ensure proper SSE streaming headers.
 */
const EXPRESS_URL = process.env.EXPRESS_URL ?? "http://localhost:3000";
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN ?? "";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();

  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (DASHBOARD_TOKEN) {
    headers.set("authorization", `Bearer ${DASHBOARD_TOKEN}`);
  }

  let res: globalThis.Response;
  try {
    res = await fetch(`${EXPRESS_URL}/api/chat/send`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Express unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Stream the SSE response through to the client
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
