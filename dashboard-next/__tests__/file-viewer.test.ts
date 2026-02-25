/**
 * @jest-environment node
 *
 * Tests for the Express /api/file endpoint:
 *   GET /api/file?path=<path>
 *
 * Tests path traversal rejection, symlink rejection, allowed directories,
 * directory listings, file content, and the walkDir skip list.
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const TEST_TOKEN = "test-bearer-token";

function walkDir(
  dir: string,
  base: string
): Array<{ name: string; path: string; type: string; children?: unknown[] }> {
  const results: Array<{
    name: string;
    path: string;
    type: string;
    children?: unknown[];
  }> = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    // skip list matches production server.js
    if (
      ["backups", "node_modules", "data", ".venv"].includes(entry.name)
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: full,
        type: "directory",
        children: walkDir(full, base),
      });
    } else {
      results.push({ name: entry.name, path: full, type: "file" });
    }
  }
  return results;
}

function buildFileServer(allowedDirs: string[]) {
  const app = express();
  app.use(express.json());

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const hToken = (req.headers.authorization ?? "").replace(
      /^Bearer\s+/i,
      ""
    );
    if (hToken === TEST_TOKEN) return next();
    res.status(401).json({ error: "Unauthorized" });
  });

  app.get("/api/file", (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath)
      return void res.status(400).json({ error: "path required" });

    const resolved = path.resolve(filePath);
    if (!allowedDirs.some((d) => resolved === d || resolved.startsWith(d + "/"))) {
      return void res.status(403).json({ error: "Access denied" });
    }
    if (!fs.existsSync(resolved)) {
      return void res.status(404).json({ error: "Not found" });
    }

    let real: string;
    try {
      real = fs.realpathSync(resolved);
    } catch {
      return void res.status(403).json({ error: "Access denied (symlink)" });
    }
    if (!allowedDirs.some((d) => real === d || real.startsWith(d + "/"))) {
      return void res.status(403).json({ error: "Access denied (symlink)" });
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return void res.json({
        type: "directory",
        files: walkDir(resolved, resolved),
      });
    }

    const ext = path.extname(resolved).toLowerCase();
    const content = fs.readFileSync(resolved, "utf-8");
    return void res.json({
      type: "file",
      path: resolved,
      name: path.basename(resolved),
      ext,
      size: stat.size,
      modified: stat.mtime,
      content,
      html: null,
    });
  });

  return app;
}

describe("File Viewer — /api/file endpoint", () => {
  let tmpBase: string;
  let allowedDirs: string[];
  let app: ReturnType<typeof buildFileServer>;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "fv-test-"));
    // Create 3 allowed directories
    const output = path.join(tmpBase, "output");
    const state = path.join(tmpBase, "state");
    const tools = path.join(tmpBase, "tools");
    fs.mkdirSync(output, { recursive: true });
    fs.mkdirSync(state, { recursive: true });
    fs.mkdirSync(tools, { recursive: true });

    allowedDirs = [output, state, tools];
    app = buildFileServer(allowedDirs);
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  // ── 401 without auth ────────────────────────────────────────────────────

  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/file?path=/tmp");
    expect(res.status).toBe(401);
  });

  // ── 400 without path ────────────────────────────────────────────────────

  it("returns 400 when path query param is missing", async () => {
    const res = await request(app)
      .get("/api/file")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path required/i);
  });

  // ── 403 path traversal ───────────────────────────────────────────────────

  it("rejects path traversal outside allowed directories", async () => {
    const res = await request(app)
      .get("/api/file?path=/etc/passwd")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it("rejects ../ path traversal that resolves outside allowed dirs", async () => {
    const dir = allowedDirs[0];
    const traversal = `${dir}/../../etc/passwd`;
    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(traversal)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(403);
  });

  // ── 404 not found ───────────────────────────────────────────────────────

  it("returns 404 for non-existent file in allowed dir", async () => {
    const dir = allowedDirs[0];
    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(path.join(dir, "ghost.txt"))}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(404);
  });

  // ── directory listing ────────────────────────────────────────────────────

  it("returns directory listing for allowed directory", async () => {
    const dir = allowedDirs[0];
    fs.writeFileSync(path.join(dir, "hello.txt"), "world");
    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(dir)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("directory");
    expect(res.body.files).toBeInstanceOf(Array);
    const names = res.body.files.map((f: { name: string }) => f.name);
    expect(names).toContain("hello.txt");
  });

  // ── file content ─────────────────────────────────────────────────────────

  it("returns file content for a file in an allowed directory", async () => {
    const dir = allowedDirs[1];
    const filePath = path.join(dir, "readme.txt");
    fs.writeFileSync(filePath, "hello agent");
    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(filePath)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("file");
    expect(res.body.content).toBe("hello agent");
    expect(res.body.name).toBe("readme.txt");
    expect(res.body.ext).toBe(".txt");
  });

  // ── walkDir skip list ─────────────────────────────────────────────────────

  it("does NOT enumerate 'data' subdirectory in directory listing", async () => {
    const dir = allowedDirs[2];
    // Create a 'data' dir that should be skipped
    const dataDir = path.join(dir, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "secret.json"), "{}");
    // Also create a normal file
    fs.writeFileSync(path.join(dir, "visible.txt"), "yes");

    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(dir)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    const names = res.body.files.map((f: { name: string }) => f.name);
    expect(names).not.toContain("data");
    expect(names).toContain("visible.txt");
  });

  it("does NOT enumerate '.venv' subdirectory in directory listing", async () => {
    const dir = allowedDirs[0];
    const venvDir = path.join(dir, ".venv");
    fs.mkdirSync(venvDir, { recursive: true });
    fs.writeFileSync(path.join(venvDir, "pyvenv.cfg"), "");
    fs.writeFileSync(path.join(dir, "app.py"), "print('hello')");

    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(dir)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    const names = res.body.files.map((f: { name: string }) => f.name);
    expect(names).not.toContain(".venv");
    expect(names).toContain("app.py");
  });

  it("does NOT enumerate 'node_modules' in directory listing", async () => {
    const dir = allowedDirs[1];
    const nmDir = path.join(dir, "node_modules");
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, "index.js"), "");
    fs.writeFileSync(path.join(dir, "index.ts"), "export {}");

    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(dir)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    const names = res.body.files.map((f: { name: string }) => f.name);
    expect(names).not.toContain("node_modules");
    expect(names).toContain("index.ts");
  });

  // ── symlink rejection ─────────────────────────────────────────────────────

  it("rejects symlinks that escape allowed directories", async () => {
    const dir = allowedDirs[0];
    const linkPath = path.join(dir, "escape.txt");
    try {
      fs.symlinkSync("/etc/passwd", linkPath);
    } catch {
      // If we can't create symlinks, skip this test
      return;
    }
    const res = await request(app)
      .get(`/api/file?path=${encodeURIComponent(linkPath)}`)
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(403);
  });
});
