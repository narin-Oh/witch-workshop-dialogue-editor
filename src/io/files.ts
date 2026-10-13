/** Browser file helpers. Kept separate from pure I/O so tests need no DOM. */
export function slugify(name: string, fallback = 'untitled'): string {
  const s = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- save with a user-chosen location

export interface SaveRequest {
  suggestedName: string;
  text: string;
  /** Shown in the picker's file-type list, e.g. "Witch Workshop project". */
  description: string;
  /** Required extension including the dot, e.g. ".witchproj.json". */
  extension: string;
}

export type SaveOutcome =
  | { status: 'saved'; name: string }
  | { status: 'downloaded'; name: string }
  | { status: 'cancelled' }
  | { status: 'failed'; reason: string };

interface WritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
interface FileHandleLike {
  name: string;
  createWritable(): Promise<WritableLike>;
}
export interface SaveDeps {
  /** `window.showSaveFilePicker` when the browser has it (File System Access API). */
  showSaveFilePicker?: (options: unknown) => Promise<FileHandleLike>;
  /** Classic "download" fallback. */
  download: (filename: string, text: string) => void;
}

const isAbort = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
const reasonOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function browserDeps(): SaveDeps {
  const w = globalThis as unknown as { showSaveFilePicker?: SaveDeps['showSaveFilePicker'] };
  return { showSaveFilePicker: typeof w.showSaveFilePicker === 'function' ? w.showSaveFilePicker.bind(globalThis) : undefined, download: (n, t) => downloadText(n, t) };
}

/**
 * Save text to a location the user picks (`showSaveFilePicker`), falling back to a normal download in browsers
 * without it. Cancelling the dialog returns `cancelled` and writes nothing. Must be called from a user gesture.
 */
export async function saveTextFile(req: SaveRequest, deps: SaveDeps = browserDeps()): Promise<SaveOutcome> {
  if (deps.showSaveFilePicker) {
    let handle: FileHandleLike | undefined;
    try {
      handle = await deps.showSaveFilePicker({
        suggestedName: req.suggestedName,
        types: [{ description: req.description, accept: { 'application/json': [req.extension] } }],
        excludeAcceptAllOption: true,
      });
    } catch (e) {
      if (isAbort(e)) return { status: 'cancelled' };
      handle = undefined; // picker unavailable here (e.g. SecurityError in an iframe): use the download fallback
    }
    if (handle) {
      let writable: WritableLike | undefined;
      try {
        writable = await handle.createWritable();
        await writable.write(req.text);
        await writable.close();
        return { status: 'saved', name: handle.name };
      } catch (e) {
        try {
          await writable?.abort?.();
        } catch {
          /* ignore */
        }
        return { status: 'failed', reason: reasonOf(e) };
      }
    }
  }
  try {
    deps.download(req.suggestedName, req.text);
    return { status: 'downloaded', name: req.suggestedName };
  } catch (e) {
    return { status: 'failed', reason: reasonOf(e) };
  }
}

/** Open a file picker and resolve with the file's text, or null if cancelled. */
export function pickTextFile(accept = '.json,application/json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
