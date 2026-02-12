/**
 * Phase Manager Tests
 */

import { PhaseManager } from '@/core/context/planning-context/phase-manager';

describe('PhaseManager', () => {
  let manager: PhaseManager;

  beforeEach(() => {
    manager = new PhaseManager();
  });

  it('should create a phase', () => {
    const phase = manager.createPhase({
      name: 'Analysis',
      description: 'Analyze requirements',
      order: 0,
    });
    expect(phase.id).toMatch(/^phase-/);
    expect(phase.name).toBe('Analysis');
    // First phase auto-activates
    expect(phase.status).toBe('active');
  });

  it('should auto-activate first phase only', () => {
    const p1 = manager.createPhase({ name: 'Phase 1', description: '', order: 0 });
    const p2 = manager.createPhase({ name: 'Phase 2', description: '', order: 1 });
    expect(p1.status).toBe('active');
    expect(p2.status).toBe('pending');
  });

  it('should advance to next phase', () => {
    manager.createPhase({ name: 'Phase 1', description: '', order: 0 });
    manager.createPhase({ name: 'Phase 2', description: '', order: 1 });

    const next = manager.advancePhase();
    expect(next?.name).toBe('Phase 2');
    expect(next?.status).toBe('active');

    const phases = manager.getAllPhases();
    expect(phases[0].status).toBe('completed');
  });

  it('should skip a phase', () => {
    const p1 = manager.createPhase({ name: 'Phase 1', description: '', order: 0 });
    manager.createPhase({ name: 'Phase 2', description: '', order: 1 });

    manager.skipPhase(p1.id);
    expect(manager.getPhase(p1.id)?.status).toBe('skipped');
    expect(manager.getCurrentPhase()?.name).toBe('Phase 2');
  });

  it('should complete a phase', () => {
    const p1 = manager.createPhase({ name: 'Phase 1', description: '', order: 0 });
    manager.completePhase(p1.id);
    expect(manager.getPhase(p1.id)?.status).toBe('completed');
  });

  it('should reorder phases', () => {
    const p1 = manager.createPhase({ name: 'Phase 1', description: '', order: 0 });
    const p2 = manager.createPhase({ name: 'Phase 2', description: '', order: 1 });
    manager.reorderPhases([p2.id, p1.id]);
    const phases = manager.getAllPhases();
    expect(phases[0].id).toBe(p2.id);
    expect(phases[1].id).toBe(p1.id);
  });

  it('should return undefined for nonexistent phase', () => {
    expect(manager.getPhase('nonexistent')).toBeUndefined();
  });
});
