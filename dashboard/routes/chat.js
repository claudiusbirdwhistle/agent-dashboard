'use strict';

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');

const CLAUDE_BIN = '/home/agent/.local/bin/claude';

function createChatRouter() {
  const router = express.Router();

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
