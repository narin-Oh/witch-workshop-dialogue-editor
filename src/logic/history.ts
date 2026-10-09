/** Generic undo/redo history. Pure functions; the store owns the instance. */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
  lastTime: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastTime: 0 };
}

/**
 * Commit a new present. Consecutive commits with the same `key` within COALESCE_MS
 * merge into one undo step (e.g. typing in a text field).
 */
export function pushHistory<T>(h: History<T>, next: T, now: number, key?: string): History<T> {
  if (next === h.present) return h;
  if (key && key === h.lastKey && now - h.lastTime < COALESCE_MS && h.past.length > 0) {
    return { ...h, present: next, future: [], lastTime: now };
  }
  const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: key, lastTime: now };
}

/** Replace the present without creating an undo step (selection, measurement, in-progress drag). */
export function replacePresent<T>(h: History<T>, next: T): History<T> {
  return next === h.present ? h : { ...h, present: next };
}

/** Finish a transient change (drag): record `base` as the single undo step if the present differs. */
export function commitFrom<T>(h: History<T>, base: T, same: (a: T, b: T) => boolean, now: number): History<T> {
  if (same(base, h.present)) return h;
  return { past: [...h.past, base].slice(-HISTORY_LIMIT), present: h.present, future: [], lastKey: undefined, lastTime: now };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: undefined, lastTime: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), lastKey: undefined, lastTime: 0 };
}

export const canUndo = <T,>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T,>(h: History<T>): boolean => h.future.length > 0;
