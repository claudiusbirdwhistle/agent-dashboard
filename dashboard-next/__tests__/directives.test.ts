/**
 * @jest-environment node
 *
 * Tests for Express directive CRUD endpoints:
 *   POST   /api/directives
 *   GET    /api/directives
 *   PATCH  /api/directives/:id
 *   DELETE /api/directives/:id
 *
 * Imports the dashboard directives router and mounts it on a minimal Express
 * app so tests are isolated from the full server.
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_TOKEN = "test-bearer-token";

function buildApp(directivesFile: string) {
  const app = express();
  app.use(express.json({ limit: "50kb" }));

  // Same auth middleware pattern as server.js
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

describe("Directives API", () => {
  let tmpDir: string;
  let directivesFile: string;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "directives-test-"));
    directivesFile = path.join(tmpDir, "directives.json");
    app = buildApp(directivesFile);
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── 401 without auth ─────────────────────────────────────────────────────

  it("GET /api/directives returns 401 without auth token", async () => {
    const res = await request(app).get("/api/directives");
    expect(res.status).toBe(401);
  });

  it("POST /api/directives returns 401 without auth token", async () => {
    const res = await request(app)
      .post("/api/directives")
      .send({ text: "do something", type: "task", priority: "normal" });
    expect(res.status).toBe(401);
  });

  // ── POST /api/directives — create ────────────────────────────────────────

  it("POST creates a directive with required fields", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Add CORS headers", type: "task", priority: "normal" });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^dir-\d+-[0-9a-f]{6}$/);
    expect(res.body.text).toBe("Add CORS headers");
    expect(res.body.type).toBe("task");
    expect(res.body.priority).toBe("normal");
    expect(res.body.status).toBe("pending");
    expect(res.body.created_at).toBeTruthy();
  });

  it("POST rejects missing text", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ type: "task", priority: "normal" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("POST rejects invalid type", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "do it", type: "invalid-type", priority: "normal" });

    expect(res.status).toBe(400);
  });

  it("POST rejects invalid priority", async () => {
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "do it", type: "task", priority: "invalid-priority" });

    expect(res.status).toBe(400);
  });

  it("POST rejects oversized body (>50kb)", async () => {
    const bigText = "x".repeat(60_000);
    const res = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: bigText, type: "task", priority: "normal" });

    // Express json({ limit }) returns 413 for payloads over the limit
    expect(res.status).toBe(413);
  });

  // ── GET /api/directives — list ───────────────────────────────────────────

  it("GET returns empty array when no directives file exists", async () => {
    const res = await request(app)
      .get("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET returns all directives", async () => {
    await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "First", type: "task", priority: "normal" });

    await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Second", type: "focus", priority: "urgent" });

    const res = await request(app)
      .get("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET ?status= filters by status", async () => {
    await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "A", type: "task", priority: "normal" });

    const all = await request(app)
      .get("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    const id = all.body[0].id;

    await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ status: "acknowledged" });

    const pending = await request(app)
      .get("/api/directives?status=pending")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(pending.body).toHaveLength(0);

    const acked = await request(app)
      .get("/api/directives?status=acknowledged")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(acked.body).toHaveLength(1);
  });

  // ── PATCH /api/directives/:id — update ──────────────────────────────────

  it("PATCH updates directive status", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Do work", type: "task", priority: "normal" });

    const id = created.body.id;

    const res = await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ status: "acknowledged" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("acknowledged");
    expect(res.body.acknowledged_at).toBeTruthy();
  });

  it("PATCH updates agent_notes", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Write tests", type: "task", priority: "normal" });

    const id = created.body.id;

    const res = await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ agent_notes: "Started, 50% done" });

    expect(res.status).toBe(200);
    expect(res.body.agent_notes).toBe("Started, 50% done");
  });

  it("PATCH returns 404 for unknown id", async () => {
    const res = await request(app)
      .patch("/api/directives/dir-0000000-000000")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ status: "acknowledged" });

    expect(res.status).toBe(404);
  });

  it("PATCH rejects invalid status value", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Do work", type: "task", priority: "normal" });

    const id = created.body.id;

    const res = await request(app)
      .patch(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ status: "not-a-real-status" });

    expect(res.status).toBe(400);
  });

  // ── DELETE /api/directives/:id ───────────────────────────────────────────

  it("DELETE removes the directive", async () => {
    const created = await request(app)
      .post("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ text: "Temporary task", type: "task", priority: "background" });

    const id = created.body.id;

    const del = await request(app)
      .delete(`/api/directives/${id}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(del.status).toBe(200);

    const list = await request(app)
      .get("/api/directives")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(list.body).toHaveLength(0);
  });

  it("DELETE returns 404 for unknown id", async () => {
    const res = await request(app)
      .delete("/api/directives/dir-0000000-000000")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);

    expect(res.status).toBe(404);
  });
});
