/**
 * @jest-environment node
 *
 * Tests for EDGAR Sentinel Express endpoints:
 *   POST /api/edgar-sentinel/run
 *   GET  /api/edgar-sentinel/jobs/:id
 *   POST /api/edgar-sentinel/jobs/:id/cancel
 *   GET  /api/edgar-sentinel/db-stats
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_TOKEN = "test-token";

// We'll override the JOBS_DIR and DB_PATH for tests
let testJobsDir: string;
let testDbPath: string;

function buildApp() {
  // Point the module to our test jobs dir & db by mocking env before require
  jest.resetModules();

  // Patch the module-level JOBS_DIR constant by injecting into the require cache
  // We do this by reading the file and replacing constants — instead, we mock child_process.spawn
  const { createEdgarSentinelRouter } = require("../../dashboard/routes/edgar-sentinel");

  const app = express();
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const hToken = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (hToken === TEST_TOKEN) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

  app.use("/api", createEdgarSentinelRouter());
  return app;
}

describe("EDGAR Sentinel API", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    testJobsDir = fs.mkdtempSync(path.join(os.tmpdir(), "edgar-test-"));
    testDbPath = path.join(testJobsDir, "test.db");
  });

  beforeEach(() => {
    jest.resetModules();
    // Mock child_process.spawn to prevent real Python execution in tests
    jest.mock("child_process", () => ({
      spawn: jest.fn(() => ({
        on: jest.fn(),
        kill: jest.fn(),
        stderr: { on: jest.fn() },
        stdout: { on: jest.fn() },
      })),
    }));
    app = buildApp();
  });

  afterAll(() => {
    fs.rmSync(testJobsDir, { recursive: true, force: true });
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it("returns 401 without Bearer token on /run", async () => {
    await request(app)
      .post("/api/edgar-sentinel/run")
      .send({ ingestion: {}, backtest: {} })
      .expect(401);
  });

  it("returns 401 without Bearer token on /db-stats", async () => {
    await request(app)
      .get("/api/edgar-sentinel/db-stats")
      .expect(401);
  });

  // ── POST /run ─────────────────────────────────────────────────────────────

  it("returns 400 when config is missing required fields", async () => {
    await request(app)
      .post("/api/edgar-sentinel/run")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ foo: "bar" })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toMatch(/invalid/i);
      });
  });

  it("creates a job and returns jobId when config is valid", async () => {
    const config = {
      ingestion: { tickers: "AAPL", formType: "10-K", startYear: 2024, endYear: 2025 },
      analysis: { dictionary: true, similarity: false, llm: false, llmModel: "" },
      signals: { bufferDays: 2, decayHalfLife: 90, compositeMethod: "equal" },
      backtest: {
        rebalanceFrequency: "quarterly",
        numQuantiles: 5,
        longQuantile: 1,
        shortQuantile: null,
        transactionCostBps: 10,
      },
    };

    const res = await request(app)
      .post("/api/edgar-sentinel/run")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send(config)
      .expect(200);

    expect(res.body.jobId).toBeDefined();
    expect(typeof res.body.jobId).toBe("string");
    expect(res.body.jobId).toMatch(/^es-/);
  });

  // ── GET /jobs/:id ─────────────────────────────────────────────────────────

  it("returns 404 for unknown job id", async () => {
    await request(app)
      .get("/api/edgar-sentinel/jobs/nonexistent-job")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .expect(404);
  });

  it("returns job status for a known job", async () => {
    const config = {
      ingestion: { tickers: "MSFT", formType: "10-K", startYear: 2024, endYear: 2025 },
      analysis: { dictionary: true, similarity: false, llm: false, llmModel: "" },
      signals: { bufferDays: 2, decayHalfLife: 90, compositeMethod: "equal" },
      backtest: {
        rebalanceFrequency: "quarterly",
        numQuantiles: 5,
        longQuantile: 1,
        shortQuantile: null,
        transactionCostBps: 10,
      },
    };

    const createRes = await request(app)
      .post("/api/edgar-sentinel/run")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send(config)
      .expect(200);

    const { jobId } = createRes.body;

    const statusRes = await request(app)
      .get(`/api/edgar-sentinel/jobs/${jobId}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .expect(200);

    expect(statusRes.body.id).toBe(jobId);
    expect(statusRes.body.stages).toHaveLength(4);
    expect(statusRes.body.stages[0].stage).toBe("ingestion");
    expect(statusRes.body.stages[1].stage).toBe("analysis");
    expect(statusRes.body.stages[2].stage).toBe("signals");
    expect(statusRes.body.stages[3].stage).toBe("backtest");
  });

  // ── GET /db-stats ─────────────────────────────────────────────────────────

  it("returns db-stats with expected shape when DB is missing", async () => {
    const res = await request(app)
      .get("/api/edgar-sentinel/db-stats")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .expect(200);

    // When DB doesn't exist or is empty, should return zeros
    expect(res.body).toHaveProperty("filings");
    expect(res.body).toHaveProperty("sentimentResults");
    expect(res.body).toHaveProperty("similarityResults");
    expect(res.body).toHaveProperty("compositeSignals");
    expect(res.body).toHaveProperty("tickers");
    expect(Array.isArray(res.body.tickers)).toBe(true);
  });

  it("db-stats returns numeric counts", async () => {
    const res = await request(app)
      .get("/api/edgar-sentinel/db-stats")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .expect(200);

    expect(typeof res.body.filings).toBe("number");
    expect(typeof res.body.sentimentResults).toBe("number");
    expect(typeof res.body.similarityResults).toBe("number");
    expect(typeof res.body.compositeSignals).toBe("number");
  });

  // ── POST /jobs/:id/cancel ─────────────────────────────────────────────────

  it("returns 404 when cancelling a non-existent job", async () => {
    await request(app)
      .post("/api/edgar-sentinel/jobs/ghost-job/cancel")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .expect(404);
  });

  it("returns 401 without auth on cancel", async () => {
    await request(app)
      .post("/api/edgar-sentinel/jobs/some-job/cancel")
      .expect(401);
  });
});
