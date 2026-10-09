import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listImportedEntries, metaContent } from '../scripts/unityMeta';

const root = join(__dirname, '..', 'unity-package');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const entries = listImportedEntries(root);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === 'bin' || n === 'obj') return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('unity-package structure (sandbox check, not a Unity import)', () => {
  const manifest = JSON.parse(read('package.json'));

  it('has a valid UPM manifest', () => {
    expect(manifest.name).toBe('com.witchworkshop.dialogue');
    expect(manifest.unity).toBe('6000.0');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.dependencies).toEqual({ 'com.unity.ugui': '2.0.0' });
    for (const s of manifest.samples) expect(existsSync(join(root, s.path)), s.path).toBe(true);
  });

  it('every imported file and folder has a correct, unique .meta (required for Git-installed packages)', () => {
    const guids = new Set<string>();
    for (const { rel, isDirectory } of entries) {
      const metaPath = join(root, `${rel}.meta`);
      expect(existsSync(metaPath), `missing ${rel}.meta`).toBe(true);
      const text = readFileSync(metaPath, 'utf8');
      expect(text, rel).toBe(metaContent(rel, isDirectory));
      const guid = /guid: ([0-9a-f]{32})/.exec(text)?.[1];
      expect(guid, rel).toBeTruthy();
      expect(guids.has(guid!), `duplicate guid for ${rel}`).toBe(false);
      guids.add(guid!);
    }
  });

  it('has no orphan .meta files', () => {
    const expected = new Set(entries.map((e) => `${e.rel}.meta`));
    const orphans = walk(root)
      .map((p) => p.slice(root.length + 1))
      .filter((p) => p.endsWith('.meta') && !p.split('/').some((s) => s.endsWith('~')) && !expected.has(p));
    expect(orphans).toEqual([]);
  });

  it('assembly definitions are valid JSON and only reference known assemblies', () => {
    const known = new Set([
      'WitchWorkshop.Dialogue.Core', 'WitchWorkshop.Dialogue', 'Unity.TextMeshPro', 'UnityEngine.UI', 'Unity.InputSystem',
      'UnityEngine.TestRunner', 'UnityEditor.TestRunner',
    ]);
    const names = new Set<string>();
    const asmdefs = walk(root).filter((p) => p.endsWith('.asmdef'));
    expect(asmdefs.length).toBeGreaterThanOrEqual(8);
    for (const f of asmdefs) {
      const d = JSON.parse(readFileSync(f, 'utf8'));
      expect(names.has(d.name), `duplicate assembly ${d.name}`).toBe(false);
      names.add(d.name);
      for (const r of d.references) expect(known.has(r) || names.has(r) || r.startsWith('WitchWorkshop.'), `${d.name} -> ${r}`).toBe(true);
    }
    const core = JSON.parse(read('Runtime/Core/WitchWorkshop.Dialogue.Core.asmdef'));
    expect(core.noEngineReferences).toBe(true);
    expect(core.references).toEqual([]);
  });

  it('the core assembly never touches UnityEngine/UnityEditor (it is compiled and tested without Unity)', () => {
    for (const f of walk(join(root, 'Runtime', 'Core')).filter((p) => p.endsWith('.cs'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/using\s+Unity(Engine|Editor)|UnityEngine\.|UnityEditor\./);
    }
  });

  it('editor-only and test code stays out of the runtime assembly', () => {
    for (const f of walk(join(root, 'Runtime')).filter((p) => p.endsWith('.cs'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/using\s+UnityEditor/);
    }
  });

  it('documentation links in the package README resolve', () => {
    const readme = read('README.md');
    for (const m of readme.matchAll(/\]\(((?:Documentation~|Samples~)[^)#]+)\)/g)) expect(existsSync(join(root, m[1]!)), m[1]).toBe(true);
    for (const f of ['Setup', 'CustomUI', 'Portraits', 'Events', 'SaveIntegration', 'Schema', 'TestingStatus', 'GettingStarted_KO']) expect(existsSync(join(root, 'Documentation~', `${f}.md`)), f).toBe(true);
  });
});
