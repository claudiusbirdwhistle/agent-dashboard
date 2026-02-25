'use strict';

const express = require('express');
const path = require('path');

const { auth, TOKEN } = require('./lib/auth');
const { createCoreRouter } = require('./routes/core');
const { createAgentModelRouter } = require('./routes/agent-model');
const { createToolsRouter } = require('./routes/tools');
const { createDirectivesRouter } = require('./directives');
const { createRateLimitRouter } = require('./rate-limit');
const { LOGIN_HTML } = require('./views/login');
const { FRONTEND_HTML } = require('./views/frontend');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;
const DIRECTIVES_FILE = path.join('/state', 'directives.json');
const LOG_DIR = '/var/log/agent';

app.use(express.json({ limit: '10kb' }));

// ── Authentication ──────────────────────────────────────────────────────
app.use('/api', auth);

// ── API routers ─────────────────────────────────────────────────────────
app.use('/api', createCoreRouter());
app.use('/api', createAgentModelRouter());
app.use('/api', createDirectivesRouter(DIRECTIVES_FILE));
app.use('/api', createRateLimitRouter(LOG_DIR));

// ── Research tools (API + HTML pages) ───────────────────────────────────
app.use(createToolsRouter());

// ── Static files ────────────────────────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, 'public')));

// ── Root route ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (TOKEN && !req.query.token) {
    return res.send(LOGIN_HTML);
  }
  if (TOKEN && req.query.token !== TOKEN) {
    return res.status(401).send(LOGIN_HTML);
  }
  res.send(FRONTEND_HTML.replace('__TOKEN__', TOKEN || ''));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Agent dashboard: http://0.0.0.0:' + PORT);
});
