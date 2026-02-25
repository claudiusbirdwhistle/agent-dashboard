'use strict';

const fs = require('fs');
const path = require('path');
const { TOKEN } = require('./auth');

/**
 * Returns an Express handler that serves an HTML page from /public with token injection.
 * @param {string} filename - HTML filename inside the public directory
 * @param {string} label - Human-readable label for the 404 message
 */
function serveHtmlPage(filename, label) {
  return (req, res) => {
    if (TOKEN && !req.query.token) return res.redirect('/?token=');
    if (TOKEN && req.query.token !== TOKEN) return res.status(401).send('Unauthorized');
    const p = path.join(__dirname, '..', 'public', filename);
    if (!fs.existsSync(p)) return res.status(404).send(`${label} page not built yet`);
    let html = fs.readFileSync(p, 'utf-8');
    html = html.replace('__TOKEN__', TOKEN || '');
    res.send(html);
  };
}

module.exports = { serveHtmlPage };
