'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { readFile, readJson, renderMarkdown, parseStreamJsonLog, walkDir } = require('../lib/helpers');

const STATE_DIR = '/state';
const OUTPUT_DIR = '/output';
const TOOLS_DIR = '/tools';
const LOG_DIR = '/var/log/agent';
const AGENT_DIR = '/agent';
const ENABLED_FLAG = path.join(STATE_DIR, 'agent_enabled');

const SUMMARY_DIR = '/output/summaries';
const SUMMARY_ARCHIVE_DIR = path.join(SUMMARY_DIR, 'archive');

function createCoreRouter() {
  const router = express.Router();

  // ── Status ──────────────────────────────────────────────────────────────
  router.get('/status', (req, res) => {
    const enabled = readFile(ENABLED_FLAG).trim() === 'enabled';
    let processStatus = 'idle';
    const pidFile = '/agent/.run/invoke.pid';
    const supervisorPidFile = '/agent/.run/supervisor.pid';
    try {
      const pid = readFile(pidFile).trim();
      if (pid && fs.existsSync('/proc/' + pid)) { processStatus = 'running'; }
      else {
        let supervisorRunning = false;
        try { execSync('sudo systemctl is-active agent-supervisor --quiet', { stdio: 'ignore' }); supervisorRunning = true; } catch {}
        if (!supervisorRunning) {
          const spid = readFile(supervisorPidFile).trim();
          if (spid && fs.existsSync('/proc/' + spid)) { supervisorRunning = true; }
        }
        if (supervisorRunning) { processStatus = 'sleeping'; }
      }
    } catch { /* idle */ }

    const phase = readJson(path.join(STATE_DIR, 'phase.json'));
    const health = readJson(path.join(STATE_DIR, 'health.json'));
    const devObj = readJson(path.join(STATE_DIR, 'dev-objectives.json'));
    const completedObj = readJson(path.join(STATE_DIR, 'dev-objectives-completed.json'));
    const activeItems = devObj?.items ?? [];
    const completedItems = Array.isArray(completedObj) ? completedObj : [];
    const objectives = [...activeItems, ...completedItems];
    const activeObjectives = Array.isArray(objectives) ? objectives.filter(o => o.status === 'active') : [];

    let totalInvocations = health?.total_invocations || 0;
    if (!totalInvocations) {
      try {
        const logFiles = fs.readdirSync('/var/log/agent/').filter(f => f.startsWith('invocation_') && f.endsWith('.log'));
        totalInvocations = logFiles.length;
      } catch { /* ignore */ }
    }

    let diskUsage = null;
    try {
      const df = execSync("df -h / | tail -1 | awk '{print $3, $4, $5}'", { encoding: 'utf-8' }).trim().split(' ');
      diskUsage = { used: df[0], available: df[1], percent: df[2] };
    } catch { /* ignore */ }

    res.json({
      enabled, processStatus,
      phase: phase?.phase || null,
      stallCount: health?.consecutive_stalls || health?.stall_count || 0,
      totalInvocations,
      activeObjectives: activeObjectives.length,
      objectives: Array.isArray(objectives) ? objectives : [],
      currentDirectiveId: devObj?.active?.current_directive_id || null,
      diskUsage
    });
  });

  // ── Unified Tasks ─────────────────────────────────────────────────────
  router.get('/tasks', (req, res) => {
    const directives = readJson(path.join(STATE_DIR, 'directives.json')) || [];
    const devObj = readJson(path.join(STATE_DIR, 'dev-objectives.json'));
    const completedObj = readJson(path.join(STATE_DIR, 'dev-objectives-completed.json'));
    const activeItems = devObj?.items ?? [];
    const completedItems = Array.isArray(completedObj) ? completedObj : [];
    const objectives = [...activeItems, ...completedItems];
    const activeId = devObj?.active?.id ?? null;
    const currentDirectiveId = devObj?.active?.current_directive_id ?? null;

    // Normalize directives → unified tasks
    const directiveTasks = (Array.isArray(directives) ? directives : []).map(d => ({
      id: d.id,
      text: d.text,
      source: 'user',
      status: d.status,
      priority: d.priority || 'normal',
      type: d.type || 'task',
      created_at: d.created_at,
      acknowledged_at: d.acknowledged_at || null,
      completed_at: d.completed_at || null,
      agent_notes: d.agent_notes || null,
      is_current: !!(currentDirectiveId && currentDirectiveId === d.id),
    }));

    // Normalize objectives → unified tasks
    const objectiveTasks = (Array.isArray(objectives) ? objectives : []).map(o => ({
      id: o.id,
      text: o.description,
      source: 'agent',
      status: o.status === 'active' ? 'acknowledged' : o.status === 'blocked' ? 'deferred' : o.status,
      priority: 'normal',
      type: 'task',
      created_at: o.created_at,
      acknowledged_at: o.status === 'active' ? o.created_at : null,
      completed_at: o.completed_at || null,
      agent_notes: null,
      is_current: !!(activeId && activeId === o.id && o.status === 'active'),
      depends_on: o.depends_on || [],
    }));

    const tasks = [...directiveTasks, ...objectiveTasks];
    res.json({ tasks, activeObjectiveId: activeId, currentDirectiveId });
  });

  // ── Toggle ──────────────────────────────────────────────────────────────
  router.post('/toggle', (req, res) => {
    const current = readFile(ENABLED_FLAG).trim();
    const newState = current === 'enabled' ? 'disabled' : 'enabled';
    fs.writeFileSync(ENABLED_FLAG, newState);
    if (newState === 'enabled') {
      try { execSync('sudo systemctl start agent-supervisor', { stdio: 'ignore' }); } catch {
        const spid = readFile('/agent/.run/supervisor.pid').trim();
        const alreadyRunning = spid && fs.existsSync('/proc/' + spid);
        if (!alreadyRunning) {
          try { execSync('nohup /agent/supervisor.sh >> /var/log/agent/daemon.log 2>&1 &', { stdio: 'ignore' }); } catch {}
        }
      }
    }
    res.json({ enabled: newState === 'enabled' });
  });

  // ── Directory listings ──────────────────────────────────────────────────
  router.get('/documents', (req, res) => { res.json(walkDir(OUTPUT_DIR, OUTPUT_DIR)); });
  router.get('/state', (req, res) => { res.json(walkDir(STATE_DIR, STATE_DIR)); });

  // ── File viewer ─────────────────────────────────────────────────────────
  router.get('/file', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const resolved = path.resolve(filePath);
    const allowed = [OUTPUT_DIR, STATE_DIR, TOOLS_DIR, LOG_DIR, AGENT_DIR];
    if (!allowed.some(dir => resolved === dir || resolved.startsWith(dir + '/'))) return res.status(403).json({ error: 'Access denied' });
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Not found' });
    const real = fs.realpathSync(resolved);
    if (!allowed.some(dir => real.startsWith(dir + '/') || real === dir)) return res.status(403).json({ error: 'Access denied (symlink)' });
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) return res.json({ type: 'directory', files: walkDir(resolved, resolved) });
    const ext = path.extname(resolved).toLowerCase();
    const content = fs.readFileSync(resolved, 'utf-8');
    res.json({
      type: 'file', path: resolved, name: path.basename(resolved), ext,
      size: stat.size, modified: stat.mtime, content,
      html: ['.md', '.markdown'].includes(ext) ? renderMarkdown(content) : null
    });
  });

  // ── Logs ────────────────────────────────────────────────────────────────
  router.get('/logs', (req, res) => {
    try {
      const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('invocation_')).sort().reverse().slice(0, 20);
      res.json(files.map(f => {
        const content = fs.readFileSync(path.join(LOG_DIR, f), 'utf-8').slice(-5000);
        const { format } = parseStreamJsonLog(content);
        return { name: f, content, format };
      }));
    } catch { res.json([]); }
  });

  // ── Journal ─────────────────────────────────────────────────────────────
  router.get('/journal', (req, res) => {
    const p = path.join(STATE_DIR, 'journal.md');
    if (!fs.existsSync(p)) return res.json({ content: '', html: '' });
    const content = fs.readFileSync(p, 'utf-8');
    res.json({ content, html: renderMarkdown(content) });
  });

  // ── Summary/digest ──────────────────────────────────────────────────────
  router.get('/summary', (req, res) => {
    const p = path.join(SUMMARY_DIR, 'latest.md');
    if (!fs.existsSync(p)) return res.json({ content: '', html: '', exists: false, modified: null });
    const content = fs.readFileSync(p, 'utf-8');
    const stat = fs.statSync(p);
    res.json({ content, html: renderMarkdown(content), exists: true, modified: stat.mtime });
  });

  router.get('/summary/archive', (req, res) => {
    try {
      if (!fs.existsSync(SUMMARY_ARCHIVE_DIR)) return res.json([]);
      const files = fs.readdirSync(SUMMARY_ARCHIVE_DIR)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 20);
      res.json(files.map(f => ({
        name: f,
        timestamp: f.replace('.md', ''),
        path: path.join(SUMMARY_ARCHIVE_DIR, f)
      })));
    } catch { res.json([]); }
  });

  // ── Live output ─────────────────────────────────────────────────────────
  router.get('/live', (req, res) => {
    const currentLog = path.join(LOG_DIR, 'current.log');
    let running = false, logFile = null, content = '', size = 0;
    const MAX_SIZE = 512000;
    try {
      const st = fs.lstatSync(currentLog);
      if (st.isSymbolicLink()) {
        const resolved = fs.realpathSync(currentLog);
        running = true;
        logFile = path.basename(resolved);
        content = fs.readFileSync(resolved, 'utf-8');
        size = content.length;
        if (content.length > MAX_SIZE) content = content.slice(-MAX_SIZE);
      }
    } catch {}
    if (!running) {
      try {
        const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('invocation_')).sort().reverse();
        if (files.length > 0) {
          logFile = files[0];
          content = fs.readFileSync(path.join(LOG_DIR, files[0]), 'utf-8');
          size = content.length;
          if (content.length > MAX_SIZE) content = content.slice(-MAX_SIZE);
        }
      } catch {}
    }
    const parsed = parseStreamJsonLog(content);
    res.json({ running, log: logFile, content, size, format: parsed.format, events: parsed.events });
  });

  return router;
}

module.exports = { createCoreRouter };
