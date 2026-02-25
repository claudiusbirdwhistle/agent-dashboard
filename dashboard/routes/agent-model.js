'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const AGENT_ENV_FILE = path.join('/agent', 'agent.env');
const VALID_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'];
const MODEL_LABELS = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-6': 'Opus',
};

function createAgentModelRouter() {
  const router = express.Router();

  router.get('/agent-model', (req, res) => {
    try {
      const content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');
      const match = content.match(/^AGENT_MODEL=(.+)$/m);
      const model = match ? match[1].trim() : 'claude-sonnet-4-6';
      res.json({ model, label: MODEL_LABELS[model] || model, available: VALID_MODELS });
    } catch (err) {
      res.status(500).json({ error: 'Could not read agent.env' });
    }
  });

  router.put('/agent-model', (req, res) => {
    const { model } = req.body || {};
    if (!model || !VALID_MODELS.includes(model)) {
      return res.status(400).json({ error: `model must be one of: ${VALID_MODELS.join(', ')}` });
    }
    try {
      let content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');
      content = content.replace(/^AGENT_MODEL=.+$/m, `AGENT_MODEL=${model}`);
      const tmp = AGENT_ENV_FILE + '.tmp';
      fs.writeFileSync(tmp, content, 'utf-8');
      fs.renameSync(tmp, AGENT_ENV_FILE);
      res.json({ model, label: MODEL_LABELS[model] || model });
    } catch (err) {
      res.status(500).json({ error: 'Could not write agent.env' });
    }
  });

  return router;
}

module.exports = { createAgentModelRouter };
