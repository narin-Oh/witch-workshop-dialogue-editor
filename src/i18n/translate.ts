import { en, type Key } from './en';
import { ko } from './ko';

export type Lang = 'ko' | 'en';
export type Params = Record<string, string | number>;
export const LANGS: readonly Lang[] = ['ko', 'en'];
export const DEFAULT_LANG: Lang = 'ko';

const DICTS: Record<Lang, Record<string, string>> = { en, ko };

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Pure translation: unknown keys fall back to English, then to the key itself. Language-independent callers use 'en'. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const p = withDerived(lang, params);
  return interpolate(DICTS[lang][key] ?? DICTS.en[key] ?? key, p);
}

/** Derived params: `node` descriptor, `reason` (nested error key) and `branch` (True/False label). */
function withDerived(lang: Lang, params?: Params): Params | undefined {
  let p = withNodeDescriptor(lang, params);
  if (p && 'reasonKey' in p) {
    const nested = JSON.parse(String(p.reasonParams ?? '{}')) as Params;
    p = { ...p, reason: translate(lang, String(p.reasonKey), nested) };
  }
  if (p && 'branchValue' in p) p = { ...p, branch: translate(lang, `run.branch.${p.branchValue}`) };
  return p;
}

/** If params carry `nodeType` (+ optional `nodeText`), derive a localized `node` descriptor like `대사 "안녕"`. */
function withNodeDescriptor(lang: Lang, params?: Params): Params | undefined {
  if (!params || !('nodeType' in params) || 'node' in params) return params;
  const text = String(params.nodeText ?? '').trim();
  const base = `nodeDesc.${params.nodeType}`;
  const shown = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  const needsText = DICTS.en[`${base}.bare`] !== undefined;
  const tpl = text || !needsText ? DICTS[lang][base] : DICTS[lang][`${base}.bare`];
  return { ...params, node: interpolate(tpl ?? DICTS.en[base] ?? base, { text: shown }) };
}

/** Message data that is translated at display time (keeps logic modules language-independent). */
export interface MessageRef {
  key: string;
  params?: Params;
}

export const isKey = (k: string): k is Key => k in en;
