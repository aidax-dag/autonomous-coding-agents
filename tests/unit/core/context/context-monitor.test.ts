/**
 * Context Monitor Tests
 */

import {
  ContextMonitor,
  createContextMonitor,
} from '../../../../src/core/context/context-monitor';
import { QualityLevel } from '../../../../src/core/context/interfaces/quality-curve.interface';
import type { TokenUsageStats } from '../../../../src/core/context/interfaces/context.interface';

// Suppress console output in tests
beforeAll(() => {
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// Helpers
// ============================================================================

function makeStats(usagePercent: number): TokenUsageStats {
  const total = 10000;
  const used = (usagePercent / 100) * total;
  return {
    total,
    used,
    remaining: total - used,
    usagePercent,
    reserved: 1000,
    available: Math.max(0, total - used - 1000),
  };
}

describe('ContextMonitor', () => {
  let onWarning: jest.Mock;
  let onCritical: jest.Mock;
  let onQualityDegraded: jest.Mock;
  let monitor: ContextMonitor;

  beforeEach(() => {
    onWarning = jest.fn();
    onCritical = jest.fn();
    onQualityDegraded = jest.fn();
    monitor = new ContextMonitor(
      { onWarning, onCritical, onQualityDegraded },
      { enabled: true, logLevel: 'error', checkInterval: 1000 },
    );
  });

  // ==========================================================================
  // check
  // ==========================================================================

  describe('check', () => {
    it('should trigger warning at 70% usage', () => {
      monitor.check(makeStats(70), QualityLevel.GOOD);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('should not trigger warning below 70%', () => {
      monitor.check(makeStats(69), QualityLevel.GOOD);
      expect(onWarning).not.toHaveBeenCalled();
    });

    it('should trigger critical at 85% usage', () => {
      monitor.check(makeStats(85), QualityLevel.DEGRADING);
      expect(onCritical).toHaveBeenCalledTimes(1);
    });

    it('should not trigger critical below 85%', () => {
      monitor.check(makeStats(84), QualityLevel.DEGRADING);
      expect(onCritical).not.toHaveBeenCalled();
    });

    it('should trigger warning only once until reset', () => {
      monitor.check(makeStats(75), QualityLevel.GOOD);
      monitor.check(makeStats(80), QualityLevel.GOOD);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('should reset warning trigger when usage drops', () => {
      monitor.check(makeStats(75), QualityLevel.GOOD);
      expect(onWarning).toHaveBeenCalledTimes(1);

      // Drop below threshold
      monitor.check(makeStats(60), QualityLevel.GOOD);

      // Should trigger again
      monitor.check(makeStats(75), QualityLevel.GOOD);
      expect(onWarning).toHaveBeenCalledTimes(2);
    });

    it('should trigger quality degradation', () => {
      monitor.check(makeStats(30), QualityLevel.PEAK);
      monitor.check(makeStats(55), QualityLevel.DEGRADING);
      expect(onQualityDegraded).toHaveBeenCalledWith(QualityLevel.DEGRADING);
    });

    it('should not trigger when quality stays same', () => {
      monitor.check(makeStats(10), QualityLevel.PEAK);
      monitor.check(makeStats(20), QualityLevel.PEAK);
      expect(onQualityDegraded).not.toHaveBeenCalled();
    });

    it('should not trigger when quality improves', () => {
      // First set to DEGRADING
      monitor.check(makeStats(55), QualityLevel.DEGRADING);
      onQualityDegraded.mockClear();

      // Then improve to GOOD
      monitor.check(makeStats(35), QualityLevel.GOOD);
      expect(onQualityDegraded).not.toHaveBeenCalled();
    });

    it('should not check when disabled', () => {
      monitor.configure({ enabled: false });
      monitor.check(makeStats(90), QualityLevel.POOR);
      expect(onWarning).not.toHaveBeenCalled();
      expect(onCritical).not.toHaveBeenCalled();
    });

    it('should handle both warning and critical in same check', () => {
      monitor.check(makeStats(90), QualityLevel.POOR);
      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onCritical).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // start / stop / isActive
  // ==========================================================================

  describe('start / stop / isActive', () => {
    it('should start inactive', () => {
      const m = new ContextMonitor({ onWarning: jest.fn() });
      expect(m.isActive()).toBe(false);
    });

    it('should activate on start', () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);
    });

    it('should deactivate on stop', () => {
      monitor.start();
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });
  });

  // ==========================================================================
  // configure / getConfig
  // ==========================================================================

  describe('configure / getConfig', () => {
    it('should update config', () => {
      monitor.configure({ checkInterval: 5000 });
      expect(monitor.getConfig().checkInterval).toBe(5000);
    });

    it('should merge with existing config', () => {
      monitor.configure({ logLevel: 'debug' });
      const cfg = monitor.getConfig();
      expect(cfg.logLevel).toBe('debug');
      expect(cfg.enabled).toBe(true); // preserved
    });

    it('should return a copy', () => {
      const cfg = monitor.getConfig();
      cfg.enabled = false;
      expect(monitor.getConfig().enabled).toBe(true);
    });
  });

  // ==========================================================================
  // setCallbacks
  // ==========================================================================

  describe('setCallbacks', () => {
    it('should update callbacks', () => {
      const newWarning = jest.fn();
      monitor.setCallbacks({ onWarning: newWarning });
      monitor.check(makeStats(75), QualityLevel.GOOD);
      expect(newWarning).toHaveBeenCalled();
      expect(onWarning).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createContextMonitor', () => {
    it('should create instance', () => {
      const m = createContextMonitor({ onWarning: jest.fn() });
      expect(m).toBeInstanceOf(ContextMonitor);
    });

    it('should accept config', () => {
      const m = createContextMonitor({ onWarning: jest.fn() }, { checkInterval: 2000 });
      expect(m.getConfig().checkInterval).toBe(2000);
    });
  });
});
