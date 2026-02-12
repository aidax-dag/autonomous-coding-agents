/**
 * State Tracker
 *
 * Reads/writes STATE.md with YAML frontmatter + Markdown body.
 * Tracks decisions and blockers.
 *
 * @module core/context/planning-context/state-tracker
 */

import { readFile, writeFile } from 'fs/promises';
import type {
  IStateTracker,
  PlanningState,
  Decision,
  Blocker,
} from './interfaces/planning.interface';

/**
 * State Tracker
 *
 * Persists planning state as a structured file.
 */
export class StateTracker implements IStateTracker {
  private statePath: string;
  private state: PlanningState | null = null;

  constructor(statePath: string) {
    this.statePath = statePath;
  }

  async load(): Promise<PlanningState> {
    try {
      const content = await readFile(this.statePath, 'utf-8');
      this.state = this.parseState(content);
    } catch {
      this.state = this.createDefaultState();
    }
    return { ...this.state };
  }

  async save(state: PlanningState): Promise<void> {
    this.state = { ...state, updatedAt: Date.now() };
    const content = this.serializeState(this.state);
    await writeFile(this.statePath, content, 'utf-8');
  }

  async addDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Promise<Decision> {
    if (!this.state) await this.load();
    const newDecision: Decision = {
      ...decision,
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    };
    this.state!.decisions.push(newDecision);
    await this.save(this.state!);
    return newDecision;
  }

  async addBlocker(blocker: Omit<Blocker, 'id' | 'timestamp' | 'resolved'>): Promise<Blocker> {
    if (!this.state) await this.load();
    const newBlocker: Blocker = {
      ...blocker,
      id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      resolved: false,
    };
    this.state!.blockers.push(newBlocker);
    await this.save(this.state!);
    return newBlocker;
  }

  async resolveBlocker(blockerId: string): Promise<void> {
    if (!this.state) await this.load();
    const blocker = this.state!.blockers.find((b) => b.id === blockerId);
    if (blocker) {
      blocker.resolved = true;
      await this.save(this.state!);
    }
  }

  private createDefaultState(): PlanningState {
    return {
      goal: '',
      status: 'planning',
      decisions: [],
      blockers: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private serializeState(state: PlanningState): string {
    const lines = [
      '---',
      `goal: "${state.goal}"`,
      `status: ${state.status}`,
      `currentPhaseId: ${state.currentPhaseId ?? 'null'}`,
      `createdAt: ${state.createdAt}`,
      `updatedAt: ${state.updatedAt}`,
      '---',
      '',
      '# Planning State',
      '',
      `## Decisions (${state.decisions.length})`,
      ...state.decisions.map(
        (d) => `- [${d.id}] ${d.description} — ${d.rationale}`,
      ),
      '',
      `## Blockers (${state.blockers.filter((b) => !b.resolved).length} active)`,
      ...state.blockers.map(
        (b) =>
          `- [${b.resolved ? 'x' : ' '}] [${b.severity}] ${b.description}`,
      ),
      '',
      `<!-- DATA ${JSON.stringify({ decisions: state.decisions, blockers: state.blockers })} -->`,
    ];
    return lines.join('\n');
  }

  private parseState(content: string): PlanningState {
    const state = this.createDefaultState();

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      const goalMatch = fm.match(/goal:\s*"([^"]*)"/);
      if (goalMatch) state.goal = goalMatch[1];

      const statusMatch = fm.match(/status:\s*(\S+)/);
      if (statusMatch) state.status = statusMatch[1] as PlanningState['status'];

      const phaseMatch = fm.match(/currentPhaseId:\s*(\S+)/);
      if (phaseMatch && phaseMatch[1] !== 'null') state.currentPhaseId = phaseMatch[1];

      const createdMatch = fm.match(/createdAt:\s*(\d+)/);
      if (createdMatch) state.createdAt = parseInt(createdMatch[1]);

      const updatedMatch = fm.match(/updatedAt:\s*(\d+)/);
      if (updatedMatch) state.updatedAt = parseInt(updatedMatch[1]);
    }

    // Parse embedded JSON data for decisions and blockers
    const dataMatch = content.match(/<!-- DATA (.+?) -->/);
    if (dataMatch) {
      try {
        const data = JSON.parse(dataMatch[1]);
        if (Array.isArray(data.decisions)) state.decisions = data.decisions;
        if (Array.isArray(data.blockers)) state.blockers = data.blockers;
      } catch {
        /* malformed data section — ignore */
      }
    }

    return state;
  }
}

/**
 * Create a state tracker
 */
export function createStateTracker(statePath: string): StateTracker {
  return new StateTracker(statePath);
}
