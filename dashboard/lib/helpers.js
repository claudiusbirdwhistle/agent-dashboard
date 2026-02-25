'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function renderMarkdown(content) {
  return DOMPurify.sanitize(marked(content));
}

function readFile(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }

function parseStreamJsonLog(content) {
  const lines = content.split('\n');
  const events = [];
  let hasJsonEvents = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.type) { events.push(obj); hasJsonEvents = true; }
    } catch { /* skip non-JSON or truncated lines */ }
  }
  return { format: hasJsonEvents ? 'stream-json' : 'text', events: hasJsonEvents ? events : null };
}

function walkDir(dir, base) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const stat = fs.statSync(full);
    if (entry.isDirectory()) {
      if (entry.name === 'backups' || entry.name === 'node_modules' || entry.name === 'data' || entry.name === '.venv') continue;
      results.push({ name: entry.name, path: full, type: 'directory', children: walkDir(full, base) });
    } else {
      results.push({ name: entry.name, path: full, type: 'file', size: stat.size, modified: stat.mtime, ext: path.extname(entry.name).toLowerCase() });
    }
  }
  return results.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
}

module.exports = { renderMarkdown, readFile, readJson, parseStreamJsonLog, walkDir };
