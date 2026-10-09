import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from './en';
import { ko } from './ko';
import { translate } from './translate';
import { validateGraph } from '../logic/validation';
import { GraphBuilder } from '../samples/builder';
import { vdef } from '../test.helpers';

const SRC = join(__dirname, '..');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const sourceFiles = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes('/i18n/'));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('Korean and English define exactly the same keys', () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });
  it('every key has identical {placeholders} in both languages', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(placeholders(ko[k]), k).toEqual(placeholders(en[k]));
  });
  it('no Korean entry is empty or left in English by mistake', () => {
    for (const [k, v] of Object.entries(ko)) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      if (/^(node|nodeDesc|toolbar|vars|preview|bottom|issue|run|file|toast|confirm|card|inspector)\./.test(k)) {
        expect(/[가-힣]/.test(v) || /^[^A-Za-z]*$/.test(v) || ['vars.global', 'common.true', 'inspector.id'].includes(k), `${k}: ${v}`).toBe(true);
      }
    }
  });
});

describe('key usage', () => {
  it('every literal t(...) key used in the source exists', () => {
    const missing: string[] = [];
    for (const f of sourceFiles) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)) if (!(m[1] as string in en)) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it('every dynamic key family resolves for all its members', () => {
    const types = ['start', 'dialogue', 'choice', 'condition', 'variable', 'event', 'end'];
    for (const t of types) for (const s of ['label', 'desc']) expect(`node.${t}.${s}` in en).toBe(true);
    for (const e of ['OpenShop', 'GiveItem', 'StartQuest', 'CompleteQuest', 'ChangeScene', 'UnlockRecipe']) expect(`event.desc.${e}` in en).toBe(true);
    for (const o of ['set', 'add', 'subtract']) expect(`var.op.${o}` in en).toBe(true);
    for (const k of ['dialogue', 'choice', 'condition', 'variable', 'event', 'end', 'error']) expect(`logkind.${k}` in en).toBe(true);
    for (const l of ['ko', 'en']) expect(`lang.${l}` in en).toBe(true);
  });
  it('every validation / runner / file / error key referenced by logic exists', () => {
    const logic = sourceFiles.filter((f) => /\/(logic|preview|io)\//.test(f));
    const missing: string[] = [];
    for (const f of logic) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/'((?:run|runlog|file|err|autosave)\.[A-Za-z.]+)'/g)) if (!(m[1] as string in en)) missing.push(`${f}: ${m[1]}`);
      if (f.endsWith('validation.ts')) for (const m of text.matchAll(/'([A-Z][A-Z_]{3,})'/g)) if (!(`issue.${m[1]}` in en)) missing.push(`issue.${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it('user-facing Korean lives only in the i18n folder (no Hangul in other source files)', () => {
    const offenders = sourceFiles.filter((f) => /[가-힣]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('translate', () => {
  it('interpolates and falls back', () => {
    expect(translate('en', 'toast.copied', { n: 3 })).toBe('Copied 3 node(s).');
    expect(translate('ko', 'toast.copied', { n: 3 })).toBe('노드 3개를 복사했습니다.');
    expect(translate('ko', 'no.such.key')).toBe('no.such.key');
    expect(translate('en', 'toast.copied')).toContain('{n}');
  });
  it('derives localized node descriptors', () => {
    expect(translate('ko', 'issue.DIALOGUE_EMPTY_TEXT', { nodeType: 'dialogue', nodeText: '안녕' })).toBe('대사 "안녕"에 대사 내용이 없습니다.');
    expect(translate('en', 'issue.DIALOGUE_EMPTY_TEXT', { nodeType: 'dialogue', nodeText: 'Hi' })).toBe('Dialogue "Hi" has no dialogue text.');
    expect(translate('ko', 'issue.MISSING_NEXT', { nodeType: 'dialogue', nodeText: '' })).toContain('대사 노드');
  });
  it('localizes validation issues without leaving placeholders behind', () => {
    const g = new GraphBuilder('t').start('s').say('d', '', '').choice('c', '', 'x').event('ev', 'OpenShop').cond('k', 'nope', '>', 1).set('v', 'flag', 'add', true).end('orphan', 'o')
      .link('s', 'next', 'd').link('d', 'next', 'c').link('c', 0, 'ev').link('ev', 'next', 'k').link('k', 'true', 'v').link('v', 'next', 'v').build();
    const issues = validateGraph({ ...g, edges: [...g.edges, { id: 'x', source: 'ghost', sourceHandle: 'next', target: 'd' }] }, [vdef('flag', 'bool', false), vdef('flag', 'bool', false), vdef('9bad', 'int', 0)]);
    expect(issues.length).toBeGreaterThan(8);
    for (const lang of ['ko', 'en'] as const) {
      for (const i of issues) {
        const text = translate(lang, i.key, i.params);
        expect(text, `${lang} ${i.code}`).not.toMatch(/\{\w+\}/);
        expect(text).not.toBe(i.key);
      }
    }
    // English text on the issue itself stays available for logs/tests
    expect(issues.every((i) => i.message === translate('en', i.key, i.params))).toBe(true);
  });
});

describe('language preference', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });
  const fakeStorage = (initial: Record<string, string> = {}) => {
    const m = new Map(Object.entries(initial));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it('defaults to Korean', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const { useLang } = await import('./index');
    expect(useLang.getState().lang).toBe('ko');
  });
  it('remembers the selection across sessions', async () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    const first = await import('./index');
    first.useLang.getState().setLang('en');
    expect(store.getItem('witch-workshop:lang')).toBe('en');
    vi.resetModules();
    const second = await import('./index');
    expect(second.useLang.getState().lang).toBe('en');
  });
  it('ignores invalid stored values and survives unavailable storage', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'witch-workshop:lang': 'fr' }));
    expect((await import('./index')).useLang.getState().lang).toBe('ko');
    vi.resetModules();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    const m = await import('./index');
    expect(m.useLang.getState().lang).toBe('ko');
    expect(() => m.useLang.getState().setLang('en')).not.toThrow();
  });
});
