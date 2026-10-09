import type { EditorProject } from '../model/types';
import { parseProject, serializeProject } from './projectFile';

const KEY = 'witch-workshop:autosave:v1';
const CORRUPT_KEY = 'witch-workshop:autosave:corrupt';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveAutosave(p: EditorProject, store: Storage | null = storage()): SaveResult {
  if (!store) return { ok: false, error: 'Local storage is unavailable; autosave is off.' };
  try {
    store.setItem(KEY, serializeProject(p));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Autosave failed (${(e as Error).name}). Save the project to a file to avoid losing work.` };
  }
}

/** Load the last autosave. A corrupt entry is moved to a backup key (never silently deleted). */
export function loadAutosave(store: Storage | null = storage()): EditorProject | null {
  if (!store) return null;
  let text: string | null = null;
  try {
    text = store.getItem(KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    return parseProject(text);
  } catch {
    try {
      store.setItem(CORRUPT_KEY, text);
      store.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearAutosave(store: Storage | null = storage()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
