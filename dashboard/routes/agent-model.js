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

  // --- Auto-model selection settings ---

  router.get('/auto-model', (req, res) => {
    try {
      const content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');
      const enabledMatch = content.match(/^AGENT_AUTO_MODEL=(.+)$/m);
      const minMatch = content.match(/^AGENT_MIN_MODEL=(.+)$/m);
      const enabled = enabledMatch ? enabledMatch[1].trim() === 'true' : false;
      const minimumModel = minMatch ? minMatch[1].trim() : 'claude-sonnet-4-6';
      res.json({ enabled, minimumModel, available: VALID_MODELS });
    } catch (err) {
      res.status(500).json({ error: 'Could not read agent.env' });
    }
  });

  router.put('/auto-model', (req, res) => {
    const { enabled, minimumModel } = req.body || {};
    try {
      let content = fs.readFileSync(AGENT_ENV_FILE, 'utf-8');

      if (typeof enabled === 'boolean') {
        const val = enabled ? 'true' : 'false';
        if (content.match(/^AGENT_AUTO_MODEL=.+$/m)) {
          content = content.replace(/^AGENT_AUTO_MODEL=.+$/m, `AGENT_AUTO_MODEL=${val}`);
        } else {
          content += `\nAGENT_AUTO_MODEL=${val}\n`;
        }
      }

      if (minimumModel && VALID_MODELS.includes(minimumModel)) {
        if (content.match(/^AGENT_MIN_MODEL=.+$/m)) {
          content = content.replace(/^AGENT_MIN_MODEL=.+$/m, `AGENT_MIN_MODEL=${minimumModel}`);
        } else {
          content += `\nAGENT_MIN_MODEL=${minimumModel}\n`;
        }
      }

      const tmp = AGENT_ENV_FILE + '.tmp';
      fs.writeFileSync(tmp, content, 'utf-8');
      fs.renameSync(tmp, AGENT_ENV_FILE);

      const enabledMatch = content.match(/^AGENT_AUTO_MODEL=(.+)$/m);
      const minMatch = content.match(/^AGENT_MIN_MODEL=(.+)$/m);
      res.json({
        enabled: enabledMatch ? enabledMatch[1].trim() === 'true' : false,
        minimumModel: minMatch ? minMatch[1].trim() : 'claude-sonnet-4-6',
      });
    } catch (err) {
      res.status(500).json({ error: 'Could not write agent.env' });
    }
  });

  return router;
}

module.exports = { createAgentModelRouter };
