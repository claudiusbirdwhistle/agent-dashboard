'use strict';

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const JOBS_DIR = '/tmp/edgar-sentinel-jobs';
const RUNNER_SCRIPT = path.join('/tools', 'edgar-sentinel-runner.py');
const EDGAR_DIR = '/agent/edgar-sentinel';
const DB_PATH = path.join(EDGAR_DIR, 'data', 'edgar_sentinel.db');

// Ensure jobs directory exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

// Track running processes for cancellation
const runningProcs = new Map();

function readJobFile(jobId) {
  const statusPath = path.join(JOBS_DIR, jobId, 'status.json');
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch {
    return null;
  }
}

function createEdgarSentinelRouter() {
  const router = express.Router();

  // POST /edgar-sentinel/run — start a pipeline job
  router.post('/edgar-sentinel/run', (req, res) => {
    const config = req.body;
    if (!config || !config.ingestion || !config.backtest) {
      return res.status(400).json({ error: 'Invalid pipeline config' });
    }

    const jobId = `es-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const jobDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    // Write initial status
    const initialStatus = {
      id: jobId,
      status: 'pending',
      currentStage: 'idle',
      stages: [
        { stage: 'ingestion', status: 'pending' },
        { stage: 'analysis', status: 'pending' },
        { stage: 'signals', status: 'pending' },
        { stage: 'backtest', status: 'pending' },
        { stage: 'validation', status: 'pending' },
      ],
      results: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };
    fs.writeFileSync(
      path.join(jobDir, 'status.json'),
      JSON.stringify(initialStatus, null, 2)
    );

    // Write config for the runner
    fs.writeFileSync(
      path.join(jobDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // Spawn python runner using the edgar-sentinel venv so all deps are available
    const venvPython = path.join(EDGAR_DIR, 'venv', 'bin', 'python3');
    const proc = spawn(venvPython, [RUNNER_SCRIPT, jobDir], {
      cwd: EDGAR_DIR,
      env: {
        ...process.env,
        PYTHONPATH: path.join(EDGAR_DIR, 'src'),
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningProcs.set(jobId, proc);

    // Capture stderr for debugging
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      runningProcs.delete(jobId);

      // Read final status
      const job = readJobFile(jobId);
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        // Process ended without proper status update
        job.status = code === 0 ? 'completed' : 'failed';
        job.completedAt = new Date().toISOString();
        if (code !== 0) {
          job.error = stderr.slice(-500) || `Process exited with code ${code}`;
        }
        fs.writeFileSync(
          path.join(jobDir, 'status.json'),
          JSON.stringify(job, null, 2)
        );
      }

      // Save stderr log
      if (stderr) {
        fs.writeFileSync(path.join(jobDir, 'stderr.log'), stderr);
      }
    });

    res.json({ jobId });
  });

  // GET /edgar-sentinel/jobs/:id — get job status
  router.get('/edgar-sentinel/jobs/:id', (req, res) => {
    const job = readJobFile(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  });

  // POST /edgar-sentinel/jobs/:id/cancel — cancel a running job
  router.post('/edgar-sentinel/jobs/:id/cancel', (req, res) => {
    const { id } = req.params;
    const proc = runningProcs.get(id);
    if (!proc) {
      return res.status(404).json({ error: 'No running process for this job' });
    }

    proc.kill('SIGTERM');
    runningProcs.delete(id);

    // Update status
    const job = readJobFile(id);
    if (job) {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.completedAt = new Date().toISOString();
      const jobDir = path.join(JOBS_DIR, id);
      fs.writeFileSync(
        path.join(jobDir, 'status.json'),
        JSON.stringify(job, null, 2)
      );
    }

    res.json({ ok: true });
  });

  // GET /edgar-sentinel/db-stats — current database statistics
  router.get('/edgar-sentinel/db-stats', (req, res) => {
    if (!fs.existsSync(DB_PATH)) {
      return res.json({
        filings: 0,
        filingSections: 0,
        sentimentResults: 0,
        similarityResults: 0,
        individualSignals: 0,
        compositeSignals: 0,
        tickers: [],
        dbPath: DB_PATH,
        dbExists: false,
      });
    }

    // Use synchronous sqlite3 via child_process so we don't add a DB dep to server.js
    const { execSync } = require('child_process');
    try {
      const query = [
        "SELECT 'filings' AS t, COUNT(*) AS n FROM filings",
        "UNION ALL SELECT 'filing_sections', COUNT(*) FROM filing_sections",
        "UNION ALL SELECT 'sentiment_results', COUNT(*) FROM sentiment_results",
        "UNION ALL SELECT 'similarity_results', COUNT(*) FROM similarity_results",
        "UNION ALL SELECT 'individual_signals', COUNT(*) FROM signals",
        "UNION ALL SELECT 'composite_signals', COUNT(*) FROM composite_signals;",
      ].join(' ');

      const output = execSync(`sqlite3 "${DB_PATH}" "${query}"`, {
        timeout: 5000,
        encoding: 'utf8',
      }).trim();

      const counts = {};
      for (const line of output.split('\n')) {
        const [table, n] = line.split('|');
        if (table && n !== undefined) counts[table.trim()] = parseInt(n.trim(), 10);
      }

      // Get tickers
      const tickersOut = execSync(
        `sqlite3 "${DB_PATH}" "SELECT DISTINCT ticker FROM filings WHERE ticker IS NOT NULL ORDER BY ticker;"`,
        { timeout: 5000, encoding: 'utf8' }
      ).trim();

      const tickers = tickersOut ? tickersOut.split('\n').map((t) => t.trim()).filter(Boolean) : [];

      return res.json({
        filings: counts['filings'] ?? 0,
        filingSections: counts['filing_sections'] ?? 0,
        sentimentResults: counts['sentiment_results'] ?? 0,
        similarityResults: counts['similarity_results'] ?? 0,
        individualSignals: counts['individual_signals'] ?? 0,
        compositeSignals: counts['composite_signals'] ?? 0,
        tickers,
        dbPath: DB_PATH,
        dbExists: true,
      });
    } catch (err) {
      // sqlite3 not installed or query failed — return zeros
      return res.json({
        filings: 0,
        filingSections: 0,
        sentimentResults: 0,
        similarityResults: 0,
        individualSignals: 0,
        compositeSignals: 0,
        tickers: [],
        dbPath: DB_PATH,
        dbExists: fs.existsSync(DB_PATH),
        error: String(err.message || err).slice(0, 200),
      });
    }
  });

  return router;
}

module.exports = { createEdgarSentinelRouter };
