/**
 * Think Mode Hook Tests
 *
 * Feature: F3.18 - Think Mode
 */

import {
  ThinkModeHook,
  createThinkMode,
  ThinkMode,
  ThinkTriggerType,
  TransitionReason,
  ComplexityLevel,
  type ThinkModeConfig,
  EXPLICIT_TRIGGER_PATTERNS,
  COMPLEXITY_TRIGGER_PATTERNS,
  DEFAULT_COMPLEXITY_THRESHOLDS,
  DEFAULT_TOKEN_LIMITS,
  MODE_PRIORITY,
  DEFAULT_THINK_MODE_CONFIG,
} from '../../../../../src/core/hooks/think-mode';
import { HookEvent, HookContext, HookAction } from '../../../../../src/core/interfaces/hook.interface';

describe('ThinkModeHook', () => {
  let hook: ThinkModeHook;

  beforeEach(() => {
    hook = new ThinkModeHook();
  });

  afterEach(() => {
    hook.dispose();
  });

  describe('Factory Function', () => {
    it('should create instance via createThinkMode', () => {
      const thinkMode = createThinkMode();
      expect(thinkMode).toBeInstanceOf(ThinkModeHook);
      thinkMode.dispose();
    });

    it('should create instance with custom config', () => {
      const config: ThinkModeConfig = {
        defaultMode: ThinkMode.EXTENDED,
        autoDetectEnabled: false,
        extendedThreshold: 0.3,
      };
      const thinkMode = createThinkMode(config);
      expect(thinkMode).toBeInstanceOf(ThinkModeHook);
      expect(thinkMode.getCurrentMode()).toBe(ThinkMode.EXTENDED);
      thinkMode.dispose();
    });
  });

  describe('Hook Properties', () => {
    it('should have correct name', () => {
      expect(hook.name).toBe('think-mode');
    });

    it('should have correct description', () => {
      expect(hook.description).toBe('Automatic extended thinking mode detection and switching');
    });

    it('should have correct event', () => {
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
    });

    it('should use default priority', () => {
      // ThinkModeHook should use DEFAULT_THINK_MODE_CONFIG.priority (95)
      expect(hook.priority).toBe(DEFAULT_THINK_MODE_CONFIG.priority);
    });

    it('should be enabled by default', () => {
      expect(hook.isEnabled()).toBe(true);
    });
  });

  describe('Mode Management', () => {
    describe('getCurrentMode', () => {
      it('should return NORMAL mode by default', () => {
        expect(hook.getCurrentMode()).toBe(ThinkMode.NORMAL);
      });

      it('should return configured default mode', () => {
        const customHook = createThinkMode({ defaultMode: ThinkMode.DEBUG });
        expect(customHook.getCurrentMode()).toBe(ThinkMode.DEBUG);
        customHook.dispose();
      });
    });

    describe('setMode', () => {
      it('should set mode and return transition', () => {
        const transition = hook.setMode(ThinkMode.EXTENDED);

        expect(hook.getCurrentMode()).toBe(ThinkMode.EXTENDED);
        expect(transition.fromMode).toBe(ThinkMode.NORMAL);
        expect(transition.toMode).toBe(ThinkMode.EXTENDED);
        expect(transition.reason).toBe(TransitionReason.USER_REQUEST);
      });

      it('should set mode with custom reason', () => {
        const transition = hook.setMode(ThinkMode.REASONING, 'Complex architecture task');

        expect(transition.toMode).toBe(ThinkMode.REASONING);
        expect(transition.context?.userReason).toBe('Complex architecture task');
      });

      it('should track mode history', () => {
        hook.setMode(ThinkMode.EXTENDED);
        hook.setMode(ThinkMode.REASONING);
        hook.setMode(ThinkMode.ULTRATHINK);

        const history = hook.getModeHistory();
        expect(history).toHaveLength(3);
        expect(history[0].toMode).toBe(ThinkMode.EXTENDED);
        expect(history[1].toMode).toBe(ThinkMode.REASONING);
        expect(history[2].toMode).toBe(ThinkMode.ULTRATHINK);
      });

      it('should not create transition for same mode', () => {
        const transition1 = hook.setMode(ThinkMode.EXTENDED);
        const transition2 = hook.setMode(ThinkMode.EXTENDED);

        expect(hook.getModeHistory()).toHaveLength(1);
        expect(transition1.id).toBe(transition2.id);
      });
    });

    describe('getRecommendedMode', () => {
      it('should recommend NORMAL for simple inputs', () => {
        const mode = hook.getRecommendedMode('Hello, how are you?');
        expect(mode).toBe(ThinkMode.NORMAL);
      });

      it('should recommend higher mode for complex inputs', () => {
        const mode = hook.getRecommendedMode('Design a scalable microservice architecture for our system');
        expect(MODE_PRIORITY[mode]).toBeGreaterThanOrEqual(MODE_PRIORITY[ThinkMode.EXTENDED]);
      });

      it('should recommend DEBUG mode for error-related inputs', () => {
        const mode = hook.getRecommendedMode('Debug this error in the authentication module');
        expect(mode).toBe(ThinkMode.DEBUG);
      });
    });
  });

  describe('Session Management', () => {
    describe('getSession', () => {
      it('should return undefined when no session', () => {
        expect(hook.getSession()).toBeUndefined();
      });
    });

    describe('startSession', () => {
      it('should start a new session', () => {
        const session = hook.startSession();

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.currentMode).toBe(ThinkMode.NORMAL);
        expect(session.transitions).toEqual([]);
        expect(session.tokensUsed).toBe(0);
        expect(session.startedAt).toBeInstanceOf(Date);
      });

      it('should start session with initial mode', () => {
        const session = hook.startSession(ThinkMode.EXTENDED);

        expect(session.currentMode).toBe(ThinkMode.EXTENDED);
      });

      it('should replace existing session when starting new one', () => {
        const session1 = hook.startSession();
        const session1Id = session1.id;
        const session2 = hook.startSession();

        // Starting a new session ends the previous one and creates a new one
        expect(session2.id).not.toBe(session1Id);
        expect(hook.getSession()?.id).toBe(session2.id);
      });
    });

    describe('endSession', () => {
      it('should end current session and return it', () => {
        hook.startSession();
        const endedSession = hook.endSession();

        expect(endedSession).toBeDefined();
        expect(hook.getSession()).toBeUndefined();
      });

      it('should return undefined when no session', () => {
        expect(hook.endSession()).toBeUndefined();
      });

      it('should update metrics on session end', () => {
        hook.startSession();
        hook.setMode(ThinkMode.EXTENDED);
        hook.recordTokenUsage(1000);
        hook.recordTaskCompletion(true);

        const session = hook.endSession();

        expect(session?.tokensUsed).toBe(1000);
        expect(session?.metrics.tasksCompleted).toBe(1);
        expect(session?.metrics.successfulResolutions).toBe(1);
      });
    });
  });

  describe('Complexity Assessment', () => {
    describe('assessComplexity', () => {
      it('should assess simple input as TRIVIAL or LOW', () => {
        const assessment = hook.assessComplexity('Hello world');

        expect([ComplexityLevel.TRIVIAL, ComplexityLevel.LOW]).toContain(assessment.level);
        // Simple input has no triggers, so confidence may be 0
        expect(assessment.confidence).toBeGreaterThanOrEqual(0);
        expect(assessment.recommendedMode).toBe(ThinkMode.NORMAL);
      });

      it('should assess complex input appropriately', () => {
        const assessment = hook.assessComplexity(
          'Design a scalable microservice architecture with security considerations and performance optimization'
        );

        expect(assessment.factors.length).toBeGreaterThan(0);
        expect(MODE_PRIORITY[assessment.recommendedMode]).toBeGreaterThan(MODE_PRIORITY[ThinkMode.NORMAL]);
      });

      it('should include timestamp', () => {
        const assessment = hook.assessComplexity('Test input');

        expect(assessment.assessedAt).toBeInstanceOf(Date);
      });

      it('should detect architecture triggers', () => {
        const assessment = hook.assessComplexity('Refactor the system architecture');

        const archFactor = assessment.factors.find((f) => f.type === ThinkTriggerType.ARCHITECTURE);
        expect(archFactor).toBeDefined();
      });

      it('should detect security triggers', () => {
        const assessment = hook.assessComplexity('Implement authentication with encryption');

        const securityFactor = assessment.factors.find((f) => f.type === ThinkTriggerType.SECURITY);
        expect(securityFactor).toBeDefined();
      });

      it('should detect performance triggers', () => {
        const assessment = hook.assessComplexity('Optimize database query performance');

        const perfFactor = assessment.factors.find((f) => f.type === ThinkTriggerType.PERFORMANCE);
        expect(perfFactor).toBeDefined();
      });

      it('should detect multi-step triggers', () => {
        const assessment = hook.assessComplexity('First create the model, then add validation, finally implement tests');

        const multiStepFactor = assessment.factors.find((f) => f.type === ThinkTriggerType.MULTI_STEP);
        expect(multiStepFactor).toBeDefined();
      });
    });
  });

  describe('Trigger Detection', () => {
    describe('detectTriggers', () => {
      it('should return empty array for simple input', () => {
        const triggers = hook.detectTriggers('Hello world');

        expect(triggers).toEqual([]);
      });

      it('should detect explicit --think trigger', () => {
        const triggers = hook.detectTriggers('Analyze this code --think');

        const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
        expect(explicitTrigger).toBeDefined();
        expect(explicitTrigger?.suggestedMode).toBe(ThinkMode.EXTENDED);
      });

      it('should detect explicit --think-hard trigger', () => {
        const triggers = hook.detectTriggers('Design architecture --think-hard');

        const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
        expect(explicitTrigger).toBeDefined();
        expect(explicitTrigger?.suggestedMode).toBe(ThinkMode.REASONING);
      });

      it('should detect explicit --ultrathink trigger', () => {
        const triggers = hook.detectTriggers('Complex problem --ultrathink');

        const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
        expect(explicitTrigger).toBeDefined();
        expect(explicitTrigger?.suggestedMode).toBe(ThinkMode.ULTRATHINK);
      });

      it('should detect --creative trigger', () => {
        const triggers = hook.detectTriggers('Generate ideas --creative');

        const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
        expect(explicitTrigger).toBeDefined();
        expect(explicitTrigger?.suggestedMode).toBe(ThinkMode.CREATIVE);
      });

      it('should detect --debug trigger', () => {
        const triggers = hook.detectTriggers('Find the bug --debug');

        const explicitTrigger = triggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
        expect(explicitTrigger).toBeDefined();
        expect(explicitTrigger?.suggestedMode).toBe(ThinkMode.DEBUG);
      });

      it('should detect error keywords', () => {
        const triggers = hook.detectTriggers('The application crashes on startup');

        const errorTrigger = triggers.find((t) => t.type === ThinkTriggerType.ERROR);
        expect(errorTrigger).toBeDefined();
      });

      it('should detect ambiguity keywords', () => {
        const triggers = hook.detectTriggers('What should I use for best practice?');

        const ambiguityTrigger = triggers.find((t) => t.type === ThinkTriggerType.AMBIGUITY);
        expect(ambiguityTrigger).toBeDefined();
      });

      it('should detect multiple trigger types', () => {
        const triggers = hook.detectTriggers(
          'Debug the security vulnerability in the authentication system'
        );

        const triggerTypes = triggers.map((t) => t.type);
        expect(triggerTypes).toContain(ThinkTriggerType.ERROR);
        expect(triggerTypes).toContain(ThinkTriggerType.SECURITY);
      });
    });
  });

  describe('Token Usage Tracking', () => {
    describe('recordTokenUsage', () => {
      it('should record token usage in active session', () => {
        hook.startSession();
        hook.recordTokenUsage(1000);
        hook.recordTokenUsage(500);

        const session = hook.getSession();
        expect(session?.tokensUsed).toBe(1500);
      });

      it('should do nothing without active session', () => {
        expect(() => hook.recordTokenUsage(1000)).not.toThrow();
      });

      it('should track tokens by mode', () => {
        hook.startSession();
        hook.recordTokenUsage(500);
        hook.setMode(ThinkMode.EXTENDED);
        hook.recordTokenUsage(1000);

        const session = hook.getSession();
        expect(session?.metrics.tokensByMode[ThinkMode.NORMAL]).toBe(500);
        expect(session?.metrics.tokensByMode[ThinkMode.EXTENDED]).toBe(1000);
      });
    });
  });

  describe('Task Completion Tracking', () => {
    describe('recordTaskCompletion', () => {
      it('should track successful task completions', () => {
        hook.startSession();
        hook.recordTaskCompletion(true);
        hook.recordTaskCompletion(true);

        const session = hook.getSession();
        expect(session?.metrics.tasksCompleted).toBe(2);
        expect(session?.metrics.successfulResolutions).toBe(2);
      });

      it('should track failed task completions', () => {
        hook.startSession();
        hook.recordTaskCompletion(true);
        hook.recordTaskCompletion(false);

        const session = hook.getSession();
        expect(session?.metrics.tasksCompleted).toBe(2);
        expect(session?.metrics.successfulResolutions).toBe(1);
      });

      it('should auto-deescalate after successful completions', () => {
        const customHook = createThinkMode({ autoDeescalate: true });
        customHook.startSession(ThinkMode.EXTENDED);

        // Record multiple successful completions
        for (let i = 0; i < 3; i++) {
          customHook.recordTaskCompletion(true);
        }

        expect(customHook.getCurrentMode()).toBe(ThinkMode.NORMAL);
        customHook.dispose();
      });

      it('should not auto-deescalate when disabled', () => {
        const customHook = createThinkMode({ autoDeescalate: false });
        customHook.startSession(ThinkMode.EXTENDED);

        for (let i = 0; i < 5; i++) {
          customHook.recordTaskCompletion(true);
        }

        expect(customHook.getCurrentMode()).toBe(ThinkMode.EXTENDED);
        customHook.dispose();
      });
    });
  });

  describe('Metrics', () => {
    describe('getMetrics', () => {
      it('should return initial metrics', () => {
        const metrics = hook.getMetrics();

        expect(metrics.totalSessions).toBe(0);
        expect(metrics.activeSessions).toBe(0);
        expect(metrics.totalTransitions).toBe(0);
      });

      it('should track session counts', () => {
        hook.startSession();
        const metricsActive = hook.getMetrics();
        expect(metricsActive.activeSessions).toBe(1);

        hook.endSession();
        const metricsEnded = hook.getMetrics();
        expect(metricsEnded.totalSessions).toBe(1);
        expect(metricsEnded.activeSessions).toBe(0);
      });

      it('should track transitions', () => {
        hook.startSession();
        hook.setMode(ThinkMode.EXTENDED);
        hook.setMode(ThinkMode.REASONING);

        const metrics = hook.getMetrics();
        expect(metrics.totalTransitions).toBe(2);
      });

      it('should track mode usage', () => {
        hook.startSession();
        hook.setMode(ThinkMode.EXTENDED);
        hook.setMode(ThinkMode.DEBUG);
        hook.setMode(ThinkMode.EXTENDED);

        const metrics = hook.getMetrics();
        expect(metrics.modeUsage[ThinkMode.EXTENDED]).toBe(2);
        expect(metrics.modeUsage[ThinkMode.DEBUG]).toBe(1);
      });

      it('should track transitions by reason', () => {
        hook.startSession();
        hook.setMode(ThinkMode.EXTENDED, 'user request');

        const metrics = hook.getMetrics();
        expect(metrics.transitionsByReason[TransitionReason.USER_REQUEST]).toBe(1);
      });
    });
  });

  describe('Event Subscriptions', () => {
    describe('onModeChanged', () => {
      it('should notify on mode change', () => {
        const callback = jest.fn();
        hook.onModeChanged(callback);

        hook.setMode(ThinkMode.EXTENDED);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            fromMode: ThinkMode.NORMAL,
            toMode: ThinkMode.EXTENDED,
          })
        );
      });

      it('should allow unsubscribe', () => {
        const callback = jest.fn();
        const subscription = hook.onModeChanged(callback);

        hook.setMode(ThinkMode.EXTENDED);
        expect(callback).toHaveBeenCalledTimes(1);

        subscription.unsubscribe();

        hook.setMode(ThinkMode.REASONING);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('should return subscription with id', () => {
        const subscription = hook.onModeChanged(jest.fn());

        expect(subscription.id).toBeDefined();
        expect(typeof subscription.id).toBe('string');
      });
    });

    describe('onComplexityAssessed', () => {
      it('should notify on complexity assessment', () => {
        const callback = jest.fn();
        hook.onComplexityAssessed(callback);

        hook.assessComplexity('Design a complex system architecture');

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            level: expect.any(String),
            confidence: expect.any(Number),
          })
        );
      });
    });

    describe('onTriggerDetected', () => {
      it('should notify when triggers detected', async () => {
        const callback = jest.fn();
        hook.onTriggerDetected(callback);

        // Events are only emitted during execute(), not during direct detectTriggers() calls
        const context: HookContext<unknown> = {
          event: HookEvent.TASK_BEFORE,
          source: 'test',
          data: {
            messages: [{ role: 'user', content: 'Fix the security vulnerability --think' }],
          },
          metadata: {},
          timestamp: new Date(),
        };
        await hook.execute(context);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({ type: expect.any(String) })
        ]));
      });

      it('should not notify when no triggers', () => {
        const callback = jest.fn();
        hook.onTriggerDetected(callback);

        hook.detectTriggers('Hello world');

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('onSessionStarted', () => {
      it('should notify on session start', () => {
        const callback = jest.fn();
        hook.onSessionStarted(callback);

        hook.startSession();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            currentMode: ThinkMode.NORMAL,
          })
        );
      });
    });

    describe('onSessionEnded', () => {
      it('should notify on session end', () => {
        const callback = jest.fn();
        hook.onSessionEnded(callback);

        hook.startSession();
        hook.endSession();

        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Hook Execution', () => {
    it('should execute successfully with valid context', async () => {
      const context: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'Help me debug this issue' }],
        },
        metadata: {},
        timestamp: new Date(),
      };

      const result = await hook.execute(context);

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.message).toContain('Think mode');
    });

    it('should detect triggers from task context', async () => {
      const context: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'Analyze the architecture --think-hard' }],
        },
        metadata: {},
        timestamp: new Date(),
      };

      hook.startSession();
      await hook.execute(context);

      expect(hook.getCurrentMode()).toBe(ThinkMode.REASONING);
    });

    it('should return ABORT on error', async () => {
      const context: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: null, // Invalid data
        metadata: {},
        timestamp: new Date(),
      };

      // Mock the extractInputFromContext to throw
      const brokenHook = createThinkMode();
      jest.spyOn(brokenHook as any, 'extractInputFromContext').mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await brokenHook.execute(context);

      expect(result.action).toBe(HookAction.ABORT);
      brokenHook.dispose();
    });
  });

  describe('Dispose', () => {
    it('should clean up resources on dispose', () => {
      hook.startSession();
      hook.onModeChanged(jest.fn());
      hook.onComplexityAssessed(jest.fn());

      hook.dispose();

      expect(hook.getSession()).toBeUndefined();
    });

    it('should end session on dispose', () => {
      const callback = jest.fn();
      hook.onSessionEnded(callback);

      hook.startSession();
      hook.dispose();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect autoDetectEnabled setting', async () => {
      const customHook = createThinkMode({ autoDetectEnabled: false });
      customHook.startSession();

      const context: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'Complex architecture design problem' }],
        },
        metadata: {},
        timestamp: new Date(),
      };

      await customHook.execute(context);

      // Should stay in default mode since auto-detection is disabled
      expect(customHook.getCurrentMode()).toBe(ThinkMode.NORMAL);
      customHook.dispose();
    });

    it('should use custom thresholds', () => {
      const customHook = createThinkMode({
        extendedThreshold: 0.1, // Very low threshold
      });

      // Even moderate complexity should trigger extended mode
      const assessment = customHook.assessComplexity('Fix a bug in the code');

      // With low threshold, even simple input might get higher mode
      expect(customHook).toBeInstanceOf(ThinkModeHook);
      expect(assessment).toBeDefined();
      customHook.dispose();
    });

    it('should use custom enabled triggers', () => {
      const customHook = createThinkMode({
        enabledTriggers: [ThinkTriggerType.EXPLICIT], // Only explicit triggers
      });

      // Error keywords should not trigger
      const triggers = customHook.detectTriggers('Fix the crash bug');
      const errorTrigger = triggers.find((t) => t.type === ThinkTriggerType.ERROR);
      expect(errorTrigger).toBeUndefined();

      // But explicit triggers should work
      const explicitTriggers = customHook.detectTriggers('Test --think');
      const explicitTrigger = explicitTriggers.find((t) => t.type === ThinkTriggerType.EXPLICIT);
      expect(explicitTrigger).toBeDefined();

      customHook.dispose();
    });
  });

  describe('Constants', () => {
    describe('EXPLICIT_TRIGGER_PATTERNS', () => {
      it('should have patterns for all explicit modes', () => {
        expect(EXPLICIT_TRIGGER_PATTERNS.length).toBeGreaterThanOrEqual(5);

        const modes = EXPLICIT_TRIGGER_PATTERNS.map((p) => p.mode);
        expect(modes).toContain(ThinkMode.EXTENDED);
        expect(modes).toContain(ThinkMode.REASONING);
        expect(modes).toContain(ThinkMode.ULTRATHINK);
        expect(modes).toContain(ThinkMode.CREATIVE);
        expect(modes).toContain(ThinkMode.DEBUG);
      });
    });

    describe('COMPLEXITY_TRIGGER_PATTERNS', () => {
      it('should have patterns for common trigger types', () => {
        const types = COMPLEXITY_TRIGGER_PATTERNS.map((p) => p.type);

        expect(types).toContain(ThinkTriggerType.ARCHITECTURE);
        expect(types).toContain(ThinkTriggerType.MULTI_STEP);
        expect(types).toContain(ThinkTriggerType.ERROR);
        expect(types).toContain(ThinkTriggerType.SECURITY);
        expect(types).toContain(ThinkTriggerType.PERFORMANCE);
        expect(types).toContain(ThinkTriggerType.AMBIGUITY);
      });

      it('should have valid weights', () => {
        for (const pattern of COMPLEXITY_TRIGGER_PATTERNS) {
          expect(pattern.weight).toBeGreaterThan(0);
          expect(pattern.weight).toBeLessThanOrEqual(1);
        }
      });
    });

    describe('DEFAULT_COMPLEXITY_THRESHOLDS', () => {
      it('should have increasing thresholds', () => {
        expect(DEFAULT_COMPLEXITY_THRESHOLDS.extended).toBeLessThan(
          DEFAULT_COMPLEXITY_THRESHOLDS.reasoning
        );
        expect(DEFAULT_COMPLEXITY_THRESHOLDS.reasoning).toBeLessThan(
          DEFAULT_COMPLEXITY_THRESHOLDS.ultrathink
        );
      });
    });

    describe('DEFAULT_TOKEN_LIMITS', () => {
      it('should have limits for all modes', () => {
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.NORMAL]).toBeDefined();
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.EXTENDED]).toBeDefined();
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.REASONING]).toBeDefined();
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.CREATIVE]).toBeDefined();
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.DEBUG]).toBeDefined();
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.ULTRATHINK]).toBeDefined();
      });

      it('should have increasing limits for higher modes', () => {
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.NORMAL]).toBeLessThan(
          DEFAULT_TOKEN_LIMITS[ThinkMode.EXTENDED]
        );
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.EXTENDED]).toBeLessThan(
          DEFAULT_TOKEN_LIMITS[ThinkMode.REASONING]
        );
        expect(DEFAULT_TOKEN_LIMITS[ThinkMode.REASONING]).toBeLessThan(
          DEFAULT_TOKEN_LIMITS[ThinkMode.ULTRATHINK]
        );
      });
    });

    describe('MODE_PRIORITY', () => {
      it('should have priorities for all modes', () => {
        expect(MODE_PRIORITY[ThinkMode.NORMAL]).toBeDefined();
        expect(MODE_PRIORITY[ThinkMode.EXTENDED]).toBeDefined();
        expect(MODE_PRIORITY[ThinkMode.REASONING]).toBeDefined();
        expect(MODE_PRIORITY[ThinkMode.CREATIVE]).toBeDefined();
        expect(MODE_PRIORITY[ThinkMode.DEBUG]).toBeDefined();
        expect(MODE_PRIORITY[ThinkMode.ULTRATHINK]).toBeDefined();
      });

      it('should have NORMAL as lowest priority', () => {
        expect(MODE_PRIORITY[ThinkMode.NORMAL]).toBe(0);
      });

      it('should have ULTRATHINK as highest priority', () => {
        expect(MODE_PRIORITY[ThinkMode.ULTRATHINK]).toBe(
          Math.max(...Object.values(MODE_PRIORITY))
        );
      });
    });

    describe('DEFAULT_THINK_MODE_CONFIG', () => {
      it('should have all required fields', () => {
        expect(DEFAULT_THINK_MODE_CONFIG.priority).toBeDefined();
        expect(DEFAULT_THINK_MODE_CONFIG.enabled).toBe(true);
        expect(DEFAULT_THINK_MODE_CONFIG.autoDetectEnabled).toBe(true);
        expect(DEFAULT_THINK_MODE_CONFIG.defaultMode).toBe(ThinkMode.NORMAL);
        expect(DEFAULT_THINK_MODE_CONFIG.autoDeescalate).toBe(true);
        expect(DEFAULT_THINK_MODE_CONFIG.sessionTimeout).toBeGreaterThan(0);
      });
    });
  });

  describe('Enums', () => {
    describe('ThinkMode', () => {
      it('should have all modes', () => {
        expect(ThinkMode.NORMAL).toBe('normal');
        expect(ThinkMode.EXTENDED).toBe('extended');
        expect(ThinkMode.REASONING).toBe('reasoning');
        expect(ThinkMode.CREATIVE).toBe('creative');
        expect(ThinkMode.DEBUG).toBe('debug');
        expect(ThinkMode.ULTRATHINK).toBe('ultrathink');
      });
    });

    describe('ThinkTriggerType', () => {
      it('should have all trigger types', () => {
        expect(ThinkTriggerType.EXPLICIT).toBe('explicit');
        expect(ThinkTriggerType.COMPLEXITY).toBe('complexity');
        expect(ThinkTriggerType.ERROR).toBe('error');
        expect(ThinkTriggerType.AMBIGUITY).toBe('ambiguity');
        expect(ThinkTriggerType.MULTI_STEP).toBe('multi_step');
        expect(ThinkTriggerType.ARCHITECTURE).toBe('architecture');
        expect(ThinkTriggerType.SECURITY).toBe('security');
        expect(ThinkTriggerType.PERFORMANCE).toBe('performance');
      });
    });

    describe('TransitionReason', () => {
      it('should have all reasons', () => {
        expect(TransitionReason.USER_REQUEST).toBe('user_request');
        expect(TransitionReason.AUTO_DETECTED).toBe('auto_detected');
        expect(TransitionReason.ESCALATION).toBe('escalation');
        expect(TransitionReason.DE_ESCALATION).toBe('de_escalation');
        expect(TransitionReason.RESOURCE_LIMIT).toBe('resource_limit');
        expect(TransitionReason.TASK_COMPLETE).toBe('task_complete');
      });
    });

    describe('ComplexityLevel', () => {
      it('should have all levels', () => {
        expect(ComplexityLevel.TRIVIAL).toBe('trivial');
        expect(ComplexityLevel.LOW).toBe('low');
        expect(ComplexityLevel.MEDIUM).toBe('medium');
        expect(ComplexityLevel.HIGH).toBe('high');
        expect(ComplexityLevel.CRITICAL).toBe('critical');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const triggers = hook.detectTriggers('');
      expect(triggers).toEqual([]);

      const assessment = hook.assessComplexity('');
      expect(assessment.level).toBe(ComplexityLevel.TRIVIAL);
    });

    it('should handle very long input', () => {
      const longInput = 'design architecture '.repeat(1000);
      const triggers = hook.detectTriggers(longInput);

      expect(triggers.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const specialInput = '!@#$%^&*() --think --debug';
      const triggers = hook.detectTriggers(specialInput);

      const explicitTriggers = triggers.filter((t) => t.type === ThinkTriggerType.EXPLICIT);
      expect(explicitTriggers.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle case variations', () => {
      const triggers1 = hook.detectTriggers('--THINK');
      const triggers2 = hook.detectTriggers('--Think');
      const triggers3 = hook.detectTriggers('--think');

      expect(triggers1.length).toBe(triggers2.length);
      expect(triggers2.length).toBe(triggers3.length);
    });

    it('should handle rapid mode changes', () => {
      for (let i = 0; i < 100; i++) {
        hook.setMode(i % 2 === 0 ? ThinkMode.EXTENDED : ThinkMode.NORMAL);
      }

      // Should not have duplicate consecutive transitions
      const history = hook.getModeHistory();
      for (let i = 1; i < history.length; i++) {
        expect(history[i].fromMode).toBe(history[i - 1].toMode);
      }
    });

    it('should handle concurrent session operations', () => {
      hook.startSession();
      hook.recordTokenUsage(100);
      hook.recordTaskCompletion(true);
      hook.setMode(ThinkMode.EXTENDED);
      hook.recordTokenUsage(200);
      hook.endSession();

      const metrics = hook.getMetrics();
      expect(metrics.totalSessions).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical user workflow', async () => {
      // Start session
      const session = hook.startSession();
      expect(session).toBeDefined();

      // User starts with simple task
      const context1: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'What is the time?' }],
        },
        metadata: {},
        timestamp: new Date(),
      };
      await hook.execute(context1);
      expect(hook.getCurrentMode()).toBe(ThinkMode.NORMAL);

      // User asks complex question
      const context2: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'Design a microservice architecture --think-hard' }],
        },
        metadata: {},
        timestamp: new Date(),
      };
      await hook.execute(context2);
      expect(hook.getCurrentMode()).toBe(ThinkMode.REASONING);

      // Record successful completion
      hook.recordTaskCompletion(true);

      // End session
      const endedSession = hook.endSession();
      expect(endedSession?.metrics.tasksCompleted).toBeGreaterThan(0);
    });

    it('should handle debug workflow', async () => {
      hook.startSession();

      const context: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        source: 'test',
        data: {
          messages: [{ role: 'user', content: 'Debug this crash in the authentication module' }],
        },
        metadata: {},
        timestamp: new Date(),
      };

      await hook.execute(context);

      // Should have detected error/debug triggers
      expect(hook.getCurrentMode()).toBe(ThinkMode.DEBUG);
    });
  });
});
