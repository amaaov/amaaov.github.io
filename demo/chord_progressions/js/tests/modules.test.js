import { expect } from '@jest/globals';
import resourceManager from '../utils/resource-manager.js';
import { musicalPatterns, generateNewPattern, generateBassPattern } from '../patterns/musical-patterns.js';
import { getAudioContext, initAudioContext, ensureAudioContext } from '../audio/context.js';

describe('Resource Manager', () => {
  beforeEach(() => {
    resourceManager.cleanup();
  });

  test('tracks and cleans up event listeners', () => {
    const element = document.createElement('div');
    const handler = jest.fn();

    resourceManager.addEventListenerTracked(element, 'click', handler);
    expect(resourceManager.eventListeners.size).toBe(1);

    resourceManager.cleanup();
    expect(resourceManager.eventListeners.size).toBe(0);
  });

  test('tracks and cleans up intervals', () => {
    const callback = jest.fn();
    const id = resourceManager.setIntervalTracked(callback, 100);

    expect(resourceManager.intervals.has(id)).toBe(true);

    resourceManager.cleanup();
    expect(resourceManager.intervals.size).toBe(0);
  });

  test('tracks and cleans up audio nodes', () => {
    const mockNode = {
      stop: jest.fn(),
      disconnect: jest.fn()
    };

    resourceManager.trackAudioNode(mockNode);
    expect(resourceManager.audioNodes.size).toBe(1);

    resourceManager.cleanup();
    expect(mockNode.stop).toHaveBeenCalled();
    expect(mockNode.disconnect).toHaveBeenCalled();
    expect(resourceManager.audioNodes.size).toBe(0);
  });
});

describe('Musical Patterns', () => {
  test('generates patterns for all available styles', () => {
    const mockChord = {
      dataset: {
        frequencies: '440,550,660'
      }
    };

    Object.keys(musicalPatterns).forEach(style => {
      const pattern = generateNewPattern(mockChord, style);
      expect(pattern).toHaveProperty('frequencies');
      expect(pattern).toHaveProperty('durations');
      expect(pattern.style).toBe(style);
    });
  });

  test('generates bass patterns', () => {
    const mockChord = {
      dataset: {
        frequencies: '440,550,660'
      }
    };

    const pattern1 = generateBassPattern(mockChord);
    expect(Array.isArray(pattern1)).toBe(true);
    expect(pattern1.length).toBeGreaterThan(0);

    const pattern2 = generateBassPattern(mockChord, pattern1);
    expect(Array.isArray(pattern2)).toBe(true);
    expect(pattern2).not.toEqual(pattern1);
  });
});

describe('Audio Context', () => {
  beforeEach(() => {
    // Mock Web Audio API
    global.AudioContext = jest.fn().mockImplementation(() => ({
      state: 'suspended',
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn()
    }));
  });

  test('initializes audio context', async () => {
    const context = await initAudioContext();
    expect(context).toBeDefined();
    expect(global.AudioContext).toHaveBeenCalled();
  });

  test('ensures audio context is running', async () => {
    const context = await ensureAudioContext();
    expect(context).toBeDefined();
    expect(context.resume).toHaveBeenCalled();
  });

  test('returns existing audio context', () => {
    const context = getAudioContext();
    expect(context).toBeDefined();
  });
});
