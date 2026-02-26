'use strict';

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const JOBS_DIR = '/tmp/edgar-sentinel-jobs';
const RUNNER_SCRIPT = path.join('/tools', 'edgar-sentinel-runner.py');
const EDGAR_DIR = '/agent/edgar-sentinel';

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

    // Spawn python runner
    const proc = spawn('python3', [RUNNER_SCRIPT, jobDir], {
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

  return router;
}

module.exports = { createEdgarSentinelRouter };
