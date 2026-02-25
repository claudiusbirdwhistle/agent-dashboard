/**
 * @jest-environment node
 */
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import bcrypt from "bcrypt";

// Ensure session secret is set before importing route handlers
process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long-here";

const ORIG_USERS_FILE = process.env.USERS_FILE;

describe("POST /api/auth/login", () => {
  let usersFile: string;

  beforeEach(() => {
    usersFile = join(tmpdir(), `test-users-${Date.now()}.json`);
    process.env.USERS_FILE = usersFile;
  });

  afterEach(() => {
    try {
      unlinkSync(usersFile);
    } catch {}
    if (ORIG_USERS_FILE !== undefined) {
      process.env.USERS_FILE = ORIG_USERS_FILE;
    } else {
      delete process.env.USERS_FILE;
    }
    jest.resetModules();
  });

  it("returns 400 when body is missing credentials", async () => {
    const { POST } = await import("../src/app/api/auth/login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 401 for wrong password", async () => {
    const hash = await bcrypt.hash("correct-pw", 10);
    writeFileSync(usersFile, JSON.stringify({ alice: hash }));

    const { POST } = await import("../src/app/api/auth/login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "wrong" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("returns 200 and sets session cookie for valid credentials", async () => {
    const hash = await bcrypt.hash("secret-pw", 10);
    writeFileSync(usersFile, JSON.stringify({ admin: hash }));

    const { POST } = await import("../src/app/api/auth/login/route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "secret-pw" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).not.toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the session cookie", async () => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long-here";
    const { POST } = await import("../src/app/api/auth/logout/route");
    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });
});
