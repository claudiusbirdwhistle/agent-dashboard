'use strict';

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLAUDE_BIN = '/home/agent/.local/bin/claude';
const SESSIONS_FILE = '/state/chat-sessions.json';
const CLAUDE_SESSIONS_DIR = '/home/agent/.claude/projects/-agent';

/** Load session index from disk */
function loadSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/** Save session index to disk atomically */
function saveSessions(sessions) {
  const tmp = SESSIONS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2));
  fs.renameSync(tmp, SESSIONS_FILE);
}

/** Track a chat session in the index */
function trackSession(sessionId, firstMessage, model) {
  const sessions = loadSessions();
  const existing = sessions.find(s => s.id === sessionId);
  if (existing) {
    existing.lastActive = new Date().toISOString();
    existing.messageCount = (existing.messageCount || 0) + 1;
  } else {
    sessions.unshift({
      id: sessionId,
      preview: firstMessage.slice(0, 120),
      model: model || 'sonnet',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messageCount: 1,
    });
  }
  // Keep last 50 sessions
  if (sessions.length > 50) sessions.length = 50;
  saveSessions(sessions);
}

/** Parse messages from a session's JSONL file */
async function loadSessionMessages(sessionId) {
  const filePath = path.join(CLAUDE_SESSIONS_DIR, sessionId + '.jsonl');
  if (!fs.existsSync(filePath)) return [];

  const messages = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'user' && evt.message && evt.message.role === 'user') {
        // Extract text content from user message
        const content = typeof evt.message.content === 'string'
          ? evt.message.content
          : Array.isArray(evt.message.content)
            ? evt.message.content.filter(b => b.type === 'text').map(b => b.text).join('')
            : '';
        if (content) {
          messages.push({ role: 'user', content });
        }
      } else if (evt.type === 'assistant' && evt.message && evt.message.content) {
        // Extract text from assistant message (skip tool use, thinking)
        const textBlocks = evt.message.content.filter(b => b.type === 'text');
        const text = textBlocks.map(b => b.text).join('');
        if (text) {
          // Replace or add the last assistant message (partials accumulate)
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = text;
          } else {
            messages.push({ role: 'assistant', content: text });
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

function createChatRouter() {
  const router = express.Router();

  // List past chat sessions
  router.get('/chat/sessions', (_req, res) => {
    const sessions = loadSessions();
    res.json(sessions);
  });

  // Load messages for a specific session
  router.get('/chat/sessions/:id/messages', async (req, res) => {
    try {
      const messages = await loadSessionMessages(req.params.id);
      res.json({ messages });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/chat/send', (req, res) => {
    const { message, sessionId, model, effort } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Verify claude binary exists
    if (!fs.existsSync(CLAUDE_BIN)) {
      return res.status(500).json({ error: 'Claude CLI not found' });
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const validModels = ['sonnet', 'opus', 'haiku'];
    const validEfforts = ['low', 'medium', 'high'];
    const selectedModel = validModels.includes(model) ? model : 'sonnet';
    const selectedEffort = validEfforts.includes(effort) ? effort : 'high';

    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--dangerously-skip-permissions',
      '--model', selectedModel,
      '--effort', selectedEffort,
      '--system-prompt',
      'You are a helpful assistant embedded in a dashboard. Be concise. Use markdown formatting when appropriate.',
    ];

    if (sessionId) {
      args.push('--resume', sessionId);
    }

    // Build environment: inherit everything but remove nested-session blockers
    const env = Object.assign({}, process.env, {
      HOME: '/home/agent',
      TERM: 'xterm-256color',
    });
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(CLAUDE_BIN, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/agent',
    });

    // Write message to stdin and close
    child.stdin.write(message);
    child.stdin.end();

    let detectedSessionId = sessionId || null;
    const isNewSession = !sessionId;
    let lastTextLen = 0;
    let buffer = '';

    function sendSSE(event, data) {
      try {
        res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
      } catch {
        // client disconnected
      }
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let evt;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }

        if (evt.type === 'system' && evt.subtype === 'init') {
          detectedSessionId = evt.session_id;
          sendSSE('init', { sessionId: evt.session_id, model: evt.model });
          // Track the session
          trackSession(evt.session_id, message, selectedModel);
        } else if (evt.type === 'assistant' && evt.message && evt.message.content) {
          for (const block of evt.message.content) {
            if (block.type === 'text' && block.text) {
              const newText = block.text;
              if (newText.length > lastTextLen) {
                const delta = newText.slice(lastTextLen);
                lastTextLen = newText.length;
                sendSSE('text', { delta });
              }
            }
          }
        } else if (evt.type === 'result') {
          // Update session activity on result
          if (detectedSessionId) {
            trackSession(detectedSessionId, message, selectedModel);
          }
          sendSSE('result', {
            sessionId: evt.session_id || detectedSessionId,
            result: evt.result || '',
            cost: evt.total_cost_usd,
          });
        }
      }
    });

    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('ExperimentalWarning') && !msg.includes('Warning')) {
        sendSSE('error', { message: msg });
      }
    });

    child.on('close', (code, signal) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer);
          if (evt.type === 'result') {
            sendSSE('result', {
              sessionId: evt.session_id || detectedSessionId,
              result: evt.result || '',
              cost: evt.total_cost_usd,
            });
          }
        } catch {
          // ignore
        }
      }
      sendSSE('done', { sessionId: detectedSessionId, exitCode: code, signal });
      res.end();
    });

    child.on('error', (err) => {
      sendSSE('error', { message: 'Failed to start Claude: ' + err.message });
      res.end();
    });

    // Clean up if client disconnects before response is done
    res.on('close', () => {
      if (!child.killed) child.kill('SIGTERM');
    });
  });

  return router;
}

module.exports = { createChatRouter };
