import { sealData } from "iron-session";
import { validateUser } from "@/lib/auth";

const SESSION_COOKIE_NAME = "session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

function getPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { username, password } = body as { username?: string; password?: string };

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Missing credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const valid = await validateUser(username, password);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionData = { username, loggedInAt: new Date().toISOString() };
  const sealed = await sealData(sessionData, {
    password: getPassword(),
    ttl: SESSION_TTL,
  });

  const cookie = [
    `${SESSION_COOKIE_NAME}=${sealed}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_TTL}`,
    "SameSite=Lax",
  ].join("; ");

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
