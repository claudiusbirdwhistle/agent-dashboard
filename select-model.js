#!/usr/bin/env node
'use strict';

/**
 * CLI wrapper for auto model selection.
 *
 * Reads state files, classifies the next task's complexity,
 * and outputs the recommended model ID to stdout.
 *
 * Usage: node select-model.js [--minimum <model>] [--override <model>]
 *
 * Exit codes:
 *   0 — success (model printed to stdout)
 *   1 — error (falls back to AGENT_MODEL or sonnet)
 */

const fs = require('fs');
const path = require('path');
const { classifyComplexity, selectModel } = require('./lib/select-model');

const STATE_DIR = process.env.STATE_DIR || '/state';

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  let override = null;
  let minimum = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--override' && args[i + 1]) override = args[++i];
    if (args[i] === '--minimum' && args[i + 1]) minimum = args[++i];
  }

  // Read state to find the active task
  const objectives = readJSON(path.join(STATE_DIR, 'dev-objectives.json'));
  const directives = readJSON(path.join(STATE_DIR, 'directives.json'));
  const nextPrompt = readText(path.join(STATE_DIR, 'next_prompt.txt'));

  // Find the active directive text
  let taskText = nextPrompt;
  let directiveType = undefined;
  let directivePriority = undefined;

  if (objectives?.active?.current_directive_id && Array.isArray(directives)) {
    const active = directives.find(d => d.id === objectives.active.current_directive_id);
    if (active) {
      taskText = active.text;
      directiveType = active.type;
      directivePriority = active.priority;
    }
  }

  // If no directive, try to use the active objective description
  if (!taskText && objectives?.active?.id) {
    const activeItem = objectives.items?.find(i => i.id === objectives.active.id);
    if (activeItem) taskText = activeItem.description;
  }

  const complexity = classifyComplexity(taskText, directiveType, directivePriority);
  const model = selectModel(complexity, override, minimum);

  // Output model and complexity info
  process.stdout.write(model);

  // Log selection reasoning to stderr (captured by invoke.sh logging)
  process.stderr.write(`[select-model] complexity=${complexity} model=${model} task="${(taskText || '').slice(0, 80)}"\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[select-model] error: ${err.message}\n`);
  // Fallback: output the env default
  process.stdout.write(process.env.AGENT_MODEL || 'claude-sonnet-4-6');
  process.exit(1);
}
