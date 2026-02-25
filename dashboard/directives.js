'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const VALID_TYPES = ['task', 'focus', 'policy'];
const VALID_PRIORITIES = ['urgent', 'normal', 'background'];
const VALID_STATUSES = ['pending', 'acknowledged', 'completed', 'deferred', 'dismissed'];

function generateId() {
  const ms = Date.now();
  const hex = crypto.randomBytes(3).toString('hex');
  return `dir-${ms}-${hex}`;
}

function readDirectives(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeDirectives(file, directives) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.directives-${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(directives, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

/**
 * Creates an Express router for directive CRUD operations.
 * @param {string} directivesFile - Path to the directives JSON file.
 */
function createDirectivesRouter(directivesFile) {
  const router = express.Router();

  // POST /directives — create
  router.post('/directives', (req, res) => {
    const { text, type, priority } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'text is required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    const directive = {
      id: generateId(),
      text: text.trim(),
      type,
      priority,
      status: 'pending',
      created_at: new Date().toISOString(),
      acknowledged_at: null,
      completed_at: null,
      agent_notes: null,
    };

    const directives = readDirectives(directivesFile);
    directives.push(directive);
    writeDirectives(directivesFile, directives);

    return res.status(201).json(directive);
  });

  // GET /directives — list (optional ?status= filter)
  router.get('/directives', (req, res) => {
    const directives = readDirectives(directivesFile);
    const { status } = req.query;
    if (status) {
      return res.json(directives.filter((d) => d.status === status));
    }
    return res.json(directives);
  });

  // PATCH /directives/:id — update
  router.patch('/directives/:id', (req, res) => {
    const { id } = req.params;
    const directives = readDirectives(directivesFile);
    const index = directives.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: `Directive ${id} not found` });
    }

    const { status, agent_notes } = req.body;
    const directive = { ...directives[index] };

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      const now = new Date().toISOString();
      directive.status = status;
      if (status === 'acknowledged' && !directive.acknowledged_at) {
        directive.acknowledged_at = now;
      }
      if (status === 'completed' && !directive.completed_at) {
        directive.completed_at = now;
      }
    }

    if (agent_notes !== undefined) {
      directive.agent_notes = agent_notes;
    }

    directives[index] = directive;
    writeDirectives(directivesFile, directives);

    return res.json(directive);
  });

  // DELETE /directives/:id
  router.delete('/directives/:id', (req, res) => {
    const { id } = req.params;
    const directives = readDirectives(directivesFile);
    const index = directives.findIndex((d) => d.id === id);

    if (index === -1) {
      return res.status(404).json({ error: `Directive ${id} not found` });
    }

    const [removed] = directives.splice(index, 1);
    writeDirectives(directivesFile, directives);

    return res.json(removed);
  });

  return router;
}

module.exports = { createDirectivesRouter };
