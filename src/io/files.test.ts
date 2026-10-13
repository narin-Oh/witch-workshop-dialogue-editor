import { describe, expect, it, vi } from 'vitest';
import { saveTextFile, type SaveDeps } from './files';

const req = { suggestedName: 'my.witchproj.json', text: '{"a":1}', description: 'Project', extension: '.witchproj.json' };

function fakePicker(opts: { name?: string; pickError?: unknown; writeError?: unknown } = {}) {
  const written: string[] = [];
  const state = { closed: false, aborted: false, pickerOptions: undefined as unknown };
  const writable = {
    write: vi.fn(async (d: string) => {
      if (opts.writeError) throw opts.writeError;
      written.push(d);
    }),
    close: vi.fn(async () => {
      state.closed = true;
    }),
    abort: vi.fn(async () => {
      state.aborted = true;
    }),
  };
  const picker = vi.fn(async (o: unknown) => {
    state.pickerOptions = o;
    if (opts.pickError) throw opts.pickError;
    return { name: opts.name ?? 'chosen-name.witchproj.json', createWritable: async () => writable };
  });
  return { picker, written, state, writable };
}

const abort = () => Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });

describe('saveTextFile', () => {
  it('writes to the user-chosen file and reports the chosen name', async () => {
    const f = fakePicker({ name: 'elsewhere.witchproj.json' });
    const download = vi.fn();
    const r = await saveTextFile(req, { showSaveFilePicker: f.picker, download });
    expect(r).toEqual({ status: 'saved', name: 'elsewhere.witchproj.json' });
    expect(f.written).toEqual(['{"a":1}']);
    expect(f.state.closed).toBe(true);
    expect(download).not.toHaveBeenCalled();
  });

  it('offers the suggested name and restricts the dialog to the required extension', async () => {
    const f = fakePicker();
    await saveTextFile({ ...req, suggestedName: 'x.dialogue.json', extension: '.dialogue.json' }, { showSaveFilePicker: f.picker, download: vi.fn() });
    expect(f.state.pickerOptions).toMatchObject({
      suggestedName: 'x.dialogue.json',
      types: [{ accept: { 'application/json': ['.dialogue.json'] } }],
      excludeAcceptAllOption: true,
    });
  });

  it('cancelling the dialog writes nothing, downloads nothing and reports no success', async () => {
    const f = fakePicker({ pickError: abort() });
    const download = vi.fn();
    const r = await saveTextFile(req, { showSaveFilePicker: f.picker, download });
    expect(r).toEqual({ status: 'cancelled' });
    expect(f.written).toEqual([]);
    expect(download).not.toHaveBeenCalled();
  });

  it('falls back to a download when the browser has no picker', async () => {
    const download = vi.fn();
    const r = await saveTextFile(req, { download });
    expect(r).toEqual({ status: 'downloaded', name: 'my.witchproj.json' });
    expect(download).toHaveBeenCalledWith('my.witchproj.json', '{"a":1}');
  });

  it('falls back to a download when the picker is blocked (e.g. SecurityError in an iframe)', async () => {
    const f = fakePicker({ pickError: Object.assign(new Error('blocked'), { name: 'SecurityError' }) });
    const download = vi.fn();
    const r = await saveTextFile(req, { showSaveFilePicker: f.picker, download });
    expect(r.status).toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('reports a write failure without falling back to a second save and aborts the half-written file', async () => {
    const f = fakePicker({ writeError: new Error('disk full') });
    const download = vi.fn();
    const r = await saveTextFile(req, { showSaveFilePicker: f.picker, download });
    expect(r).toEqual({ status: 'failed', reason: 'disk full' });
    expect(f.state.aborted).toBe(true);
    expect(download).not.toHaveBeenCalled();
  });

  it('reports a failing download', async () => {
    const deps: SaveDeps = { download: () => { throw new Error('nope'); } };
    expect(await saveTextFile(req, deps)).toEqual({ status: 'failed', reason: 'nope' });
  });
});
