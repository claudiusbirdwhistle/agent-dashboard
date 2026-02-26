/**
 * Tests for auto model selection based on task complexity.
 * Module: /agent/lib/select-model.js
 */

const { selectModel, classifyComplexity } = require('../../lib/select-model');

describe('select-model', () => {
  describe('classifyComplexity', () => {
    it('classifies simple config tasks as low complexity', () => {
      expect(classifyComplexity('Set your active agent model to Sonnet')).toBe('low');
      expect(classifyComplexity('Change model to Haiku')).toBe('low');
      expect(classifyComplexity('Enable the agent')).toBe('low');
      expect(classifyComplexity('Disable the agent')).toBe('low');
      expect(classifyComplexity('Mark objective as completed')).toBe('low');
    });

    it('classifies standard dev tasks as medium complexity', () => {
      expect(classifyComplexity('Add a delete button to the user profile')).toBe('medium');
      expect(classifyComplexity('Fix the layout bug in the sidebar component')).toBe('medium');
      expect(classifyComplexity('Refactor server.js into smaller modules')).toBe('medium');
      expect(classifyComplexity('Implement dark mode toggle')).toBe('medium');
      expect(classifyComplexity('Create a new API endpoint for user settings')).toBe('medium');
    });

    it('classifies research and architecture tasks as high complexity', () => {
      expect(classifyComplexity('Research feasibility of a trading signal generator based on sentiment')).toBe('high');
      expect(classifyComplexity('Design modular architecture for the EDGAR system')).toBe('high');
      expect(classifyComplexity('Investigate auto-model switching strategy')).toBe('high');
      expect(classifyComplexity('Audit invocation logs for optimization opportunities')).toBe('high');
      expect(classifyComplexity('Analyze the codebase architecture and propose improvements')).toBe('high');
    });

    it('defaults to medium for ambiguous tasks', () => {
      expect(classifyComplexity('Do the thing')).toBe('medium');
      expect(classifyComplexity('')).toBe('medium');
    });
  });

  describe('selectModel', () => {
    it('returns haiku for low complexity', () => {
      expect(selectModel('low')).toBe('claude-haiku-4-5-20251001');
    });

    it('returns sonnet for medium complexity', () => {
      expect(selectModel('medium')).toBe('claude-sonnet-4-6');
    });

    it('returns opus for high complexity', () => {
      expect(selectModel('high')).toBe('claude-opus-4-6');
    });

    it('respects explicit model override', () => {
      expect(selectModel('low', 'claude-opus-4-6')).toBe('claude-opus-4-6');
      expect(selectModel('high', 'claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
    });

    it('respects minimum model floor', () => {
      // If minimum is sonnet, haiku tasks get bumped to sonnet
      expect(selectModel('low', undefined, 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
      // Medium stays at sonnet (already meets minimum)
      expect(selectModel('medium', undefined, 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
      // High stays at opus (exceeds minimum)
      expect(selectModel('high', undefined, 'claude-sonnet-4-6')).toBe('claude-opus-4-6');
    });

    it('override takes precedence over minimum floor', () => {
      expect(selectModel('low', 'claude-haiku-4-5-20251001', 'claude-opus-4-6')).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('classifyComplexity with directive context', () => {
    it('considers directive type in classification', () => {
      // Policy directives are simple — just store a rule
      expect(classifyComplexity('Always use conventional commits', 'policy')).toBe('low');
    });

    it('considers priority in classification', () => {
      // Urgent simple tasks stay low
      expect(classifyComplexity('Disable the agent', undefined, 'urgent')).toBe('low');
    });

    it('boosts complexity for background research tasks', () => {
      // Background tasks that involve design/architecture are high
      expect(classifyComplexity('Design modular architecture for EDGAR', 'task', 'background')).toBe('high');
    });
  });
});
