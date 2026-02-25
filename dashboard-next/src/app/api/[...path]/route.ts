/**
 * Catch-all proxy to the Express backend.
 * Runs server-side, so it can safely inject the DASHBOARD_TOKEN Bearer header.
 * Specific routes (e.g. /api/auth/login) are matched first by Next.js and
 * never reach this handler.
 */
import { NextRequest, NextResponse } from "next/server";

const EXPRESS_URL = process.env.EXPRESS_URL ?? "http://localhost:3000";
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN ?? "";

async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const url = `${EXPRESS_URL}${pathname}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (DASHBOARD_TOKEN) headers.set("authorization", `Bearer ${DASHBOARD_TOKEN}`);

  const init: RequestInit = { method: request.method, headers };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return NextResponse.json({ error: "Express unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) responseHeaders.set("content-type", ct);

  return new NextResponse(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const PUT = proxy;
