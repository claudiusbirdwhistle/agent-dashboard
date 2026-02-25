/**
 * Fetch wrapper that attaches Bearer auth for Express API calls.
 * Used by server components and API routes; browser code goes through
 * Next.js rewrites which inject the token server-side.
 */

const EXPRESS_URL =
  process.env.EXPRESS_URL ?? process.env.NEXT_PUBLIC_EXPRESS_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = process.env.DASHBOARD_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${EXPRESS_URL}${path}`, { ...options, headers });
}
