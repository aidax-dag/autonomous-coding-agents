/**
 * Cursor Sync
 * Manages real-time cursor position tracking and synchronization
 * across pair programming session participants.
 *
 * @module core/pair-programming
 */

import { EventEmitter } from 'events';
import type { CursorPosition, CursorEvent, SessionRole } from './types';

export class CursorSync extends EventEmitter {
  private cursors: Map<string, CursorPosition> = new Map();
  private _history: CursorEvent[] = [];

  /**
   * Update the cursor position for a participant.
   * Emits 'cursor:moved' for move/insert/delete actions
   * and 'cursor:selected' when a selection range is present.
   */
  updateCursor(
    userId: string,
    role: SessionRole,
    position: CursorPosition,
  ): void {
    this.cursors.set(userId, position);

    const action = position.selection ? 'select' : 'move';
    const event: CursorEvent = {
      userId,
      role,
      action,
      position,
      timestamp: Date.now(),
    };

    this._history.push(event);

    if (action === 'select') {
      this.emit('cursor:selected', event);
    } else {
      this.emit('cursor:moved', event);
    }
  }

  /**
   * Get the current cursor position for a specific participant.
   */
  getCursor(userId: string): CursorPosition | undefined {
    return this.cursors.get(userId);
  }

  /**
   * Get all active cursor positions keyed by participant ID.
   */
  getAllCursors(): Map<string, CursorPosition> {
    return new Map(this.cursors);
  }

  /**
   * Retrieve cursor event history, optionally limited to the most recent N entries.
   */
  getHistory(limit?: number): CursorEvent[] {
    if (limit !== undefined && limit >= 0) {
      return this._history.slice(-limit);
    }
    return [...this._history];
  }

  /**
   * Clear all cursor history while preserving current cursor positions.
   */
  clearHistory(): void {
    this._history = [];
  }

  /**
   * Remove a participant's cursor and emit a disconnected event.
   */
  removeCursor(userId: string): boolean {
    const removed = this.cursors.delete(userId);
    if (removed) {
      this.emit('cursor:disconnected', { userId, timestamp: Date.now() });
    }
    return removed;
  }

  /**
   * Remove all cursors and clear history. Does not emit events.
   */
  clear(): void {
    this.cursors.clear();
    this._history = [];
  }
}
