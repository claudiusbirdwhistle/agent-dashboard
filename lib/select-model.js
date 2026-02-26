'use strict';

/**
 * Auto model selection based on task complexity.
 *
 * Maps task descriptions to complexity tiers, then to Claude models:
 *   low    → Haiku   (config changes, acknowledgements, simple ops)
 *   medium → Sonnet  (standard dev: features, bug fixes, refactoring)
 *   high   → Opus    (research, architecture, audits, investigation)
 */

const MODEL_TIER = {
  low: 'claude-haiku-4-5-20251001',
  medium: 'claude-sonnet-4-6',
  high: 'claude-opus-4-6',
};

// Model ranking for floor comparisons (higher = more capable)
const MODEL_RANK = {
  'claude-haiku-4-5-20251001': 0,
  'claude-sonnet-4-6': 1,
  'claude-opus-4-6': 2,
};

// --- Complexity patterns ---

// Low: simple config, toggling, status changes
const LOW_PATTERNS = [
  /\b(set|change|switch|update)\b.*\bmodel\b/i,
  /\b(enable|disable)\b.*\bagent\b/i,
  /\bagent\b.*\b(enable|disable)\b/i,
  /\b(mark|set)\b.*\b(completed|done|finished|acknowledged)\b/i,
  /\b(acknowledge|dismiss)\b/i,
];

// High: research, architecture, investigation, auditing
const HIGH_PATTERNS = [
  /\bresearch\b/i,
  /\bfeasibility\b/i,
  /\binvestigat/i,
  /\barchitect/i,
  /\bdesign\b.*\b(system|modular|architecture)\b/i,
  /\b(system|modular|architecture)\b.*\bdesign\b/i,
  /\baudit\b/i,
  /\banalyz/i,
  /\bstrateg/i,
  /\bpropose\b.*\bimprovements?\b/i,
];

/**
 * Classify the complexity of a task description.
 *
 * @param {string} text - The task/directive description
 * @param {string} [type] - Directive type: 'task' | 'focus' | 'policy'
 * @param {string} [priority] - Directive priority: 'urgent' | 'normal' | 'background'
 * @returns {'low' | 'medium' | 'high'}
 */
function classifyComplexity(text, type, priority) {
  if (!text) return 'medium';

  // Policy directives are always low — just store a rule
  if (type === 'policy') return 'low';

  // Check high-complexity patterns first (they're more specific)
  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(text)) return 'high';
  }

  // Check low-complexity patterns
  for (const pattern of LOW_PATTERNS) {
    if (pattern.test(text)) return 'low';
  }

  // Default: medium
  return 'medium';
}

/**
 * Select the appropriate model for a given complexity tier.
 *
 * @param {'low' | 'medium' | 'high'} complexity
 * @param {string} [override] - Force a specific model (takes precedence over everything)
 * @param {string} [minimumModel] - Floor model — won't go below this tier
 * @returns {string} Model ID
 */
function selectModel(complexity, override, minimumModel) {
  // Explicit override always wins
  if (override && MODEL_RANK[override] !== undefined) {
    return override;
  }

  const selected = MODEL_TIER[complexity] || MODEL_TIER.medium;

  // Apply minimum floor
  if (minimumModel && MODEL_RANK[minimumModel] !== undefined) {
    if (MODEL_RANK[selected] < MODEL_RANK[minimumModel]) {
      return minimumModel;
    }
  }

  return selected;
}

module.exports = { classifyComplexity, selectModel, MODEL_TIER, MODEL_RANK };
