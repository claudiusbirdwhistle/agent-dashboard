'use strict';

const express = require('express');
const { execSync } = require('child_process');

/**
 * Parse the most recent rate_limit_event from invocation logs.
 * Reads the current log in reverse for efficiency (latest event first).
 *
 * @param {string} logDir - Path to the directory containing invocation logs
 * @returns {object} Normalized rate limit info
 */
function getLatestRateLimit(logDir) {
  const cmd = `(tac ${logDir}/current.log 2>/dev/null || tac "$(ls -t ${logDir}/invocation_*.log 2>/dev/null | head -1)" 2>/dev/null) | grep -m1 '^{"type":"rate_limit_event"'`;
  const line = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
  const event = JSON.parse(line);
  const info = event.rate_limit_info || {};
  return {
    type: info.rateLimitType || null,
    utilization: info.utilization ?? null,
    status: info.status || null,
    resetsAt: info.resetsAt ? new Date(info.resetsAt * 1000).toISOString() : null,
    isUsingOverage: info.isUsingOverage ?? false,
    surpassedThreshold: info.surpassedThreshold ?? null,
  };
}

const EMPTY_RESPONSE = {
  type: null,
  utilization: null,
  status: null,
  resetsAt: null,
  isUsingOverage: false,
  surpassedThreshold: null,
};

/**
 * Creates an Express router with the rate-limit endpoint.
 *
 * @param {string} logDir - Path to the log directory
 * @returns {express.Router}
 */
function createRateLimitRouter(logDir) {
  const router = express.Router();

  router.get('/rate-limit', (_req, res) => {
    try {
      res.json(getLatestRateLimit(logDir));
    } catch {
      res.json({ ...EMPTY_RESPONSE });
    }
  });

  return router;
}

module.exports = { createRateLimitRouter, getLatestRateLimit, EMPTY_RESPONSE };
