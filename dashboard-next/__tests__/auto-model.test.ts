/**
 * @jest-environment node
 *
 * Tests for auto-model selection API endpoints:
 *   GET  /api/auto-model
 *   PUT  /api/auto-model
 *
 * Uses a temp copy of agent.env so tests don't modify the real config.
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_TOKEN = "test-bearer-token";

const SAMPLE_ENV = `# Agent config
AGENT_MODEL=claude-opus-4-6
AGENT_AUTO_MODEL=true
AGENT_MIN_MODEL=claude-sonnet-4-6
DASHBOARD_TOKEN=fake
`;

function buildApp(envFile: string) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const hToken = (req.headers.authorization ?? "").replace(
      /^Bearer\s+/i,
      ""
    );
    if (hToken === TEST_TOKEN) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

  // Monkey-patch the env file path used by agent-model router
  const origReadFileSync = fs.readFileSync;
  const origWriteFileSync = fs.writeFileSync;
  const origRenameSync = fs.renameSync;
  const agentEnvPath = path.join("/agent", "agent.env");

  // Intercept file operations to use our temp file
  jest.spyOn(fs, "readFileSync").mockImplementation((p: any, ...args: any[]) => {
    if (p === agentEnvPath) return origReadFileSync(envFile, ...args);
    return origReadFileSync(p, ...args);
  });
  jest.spyOn(fs, "writeFileSync").mockImplementation((p: any, ...args: any[]) => {
    const target = String(p).startsWith(agentEnvPath) ? envFile + ".tmp" : p;
    return origWriteFileSync(target as string, ...args);
  });
  jest.spyOn(fs, "renameSync").mockImplementation((src: any, dest: any) => {
    if (String(dest) === agentEnvPath) return origRenameSync(envFile + ".tmp", envFile);
    return origRenameSync(src, dest);
  });

  // Clear module cache so the router picks up our mocks
  delete require.cache[require.resolve("../../dashboard/routes/agent-model")];
  const { createAgentModelRouter } = require("../../dashboard/routes/agent-model");
  app.use("/api", createAgentModelRouter());

  return app;
}

describe("auto-model API", () => {
  let tmpDir: string;
  let envFile: string;
  let app: express.Express;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-model-test-"));
    envFile = path.join(tmpDir, "agent.env");
    fs.writeFileSync(envFile, SAMPLE_ENV);
    app = buildApp(envFile);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("GET /api/auto-model", () => {
    it("returns current auto-model settings", async () => {
      const res = await request(app)
        .get("/api/auto-model")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .expect(200);

      expect(res.body.enabled).toBe(true);
      expect(res.body.minimumModel).toBe("claude-sonnet-4-6");
      expect(res.body.available).toEqual(expect.arrayContaining([
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
      ]));
    });

    it("returns enabled=false when AGENT_AUTO_MODEL is not true", async () => {
      fs.writeFileSync(envFile, SAMPLE_ENV.replace("AGENT_AUTO_MODEL=true", "AGENT_AUTO_MODEL=false"));
      const res = await request(app)
        .get("/api/auto-model")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .expect(200);

      expect(res.body.enabled).toBe(false);
    });

    it("requires authentication", async () => {
      await request(app).get("/api/auto-model").expect(401);
    });
  });

  describe("PUT /api/auto-model", () => {
    it("toggles auto-model on/off", async () => {
      // Disable
      const res1 = await request(app)
        .put("/api/auto-model")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .send({ enabled: false })
        .expect(200);

      expect(res1.body.enabled).toBe(false);

      // Verify persisted
      const content = fs.readFileSync(envFile, "utf-8");
      expect(content).toMatch(/AGENT_AUTO_MODEL=false/);
    });

    it("updates minimum model", async () => {
      const res = await request(app)
        .put("/api/auto-model")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .send({ minimumModel: "claude-opus-4-6" })
        .expect(200);

      expect(res.body.minimumModel).toBe("claude-opus-4-6");
    });

    it("rejects invalid minimum model", async () => {
      const res = await request(app)
        .put("/api/auto-model")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .send({ minimumModel: "gpt-4" })
        .expect(200);

      // Should not change (invalid model ignored)
      expect(res.body.minimumModel).toBe("claude-sonnet-4-6");
    });

    it("requires authentication", async () => {
      await request(app)
        .put("/api/auto-model")
        .send({ enabled: false })
        .expect(401);
    });
  });
});
