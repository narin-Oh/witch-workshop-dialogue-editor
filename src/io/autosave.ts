import type { EditorProject } from '../model/types';
import type { MessageRef } from '../i18n/translate';
import { parseProject, serializeProject } from './projectFile';

const KEY = 'witch-workshop:autosave:v1';
const CORRUPT_KEY = 'witch-workshop:autosave:corrupt';

export interface SaveResult {
  ok: boolean;
  /** Localizable message (key + params). */
  error?: MessageRef;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveAutosave(p: EditorProject, store: Storage | null = storage()): SaveResult {
  if (!store) return { ok: false, error: { key: 'autosave.unavailable' } };
  try {
    store.setItem(KEY, serializeProject(p));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: { key: 'autosave.failed', params: { name: (e as Error).name } } };
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
