import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const tokens = new Map<string, [number, number, number]>();
for (const m of css.matchAll(/--c-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) tokens.set(m[1] as string, [Number(m[2]), Number(m[3]), Number(m[4])]);

const lum = ([r, g, b]: [number, number, number]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const t = (n: string) => tokens.get(n) as [number, number, number];
const TONES = ['primary', 'mint', 'pink', 'blue', 'yellow', 'peach', 'mauve'];

describe('theme contrast (WCAG AA, 4.5:1)', () => {
  it('defines every token', () => {
    for (const n of ['bg', 'panel', 'line', 'text', 'text-sub', ...TONES.flatMap((x) => [x, `${x}-soft`, `${x}-deep`])]) expect(tokens.has(n), n).toBe(true);
  });
  it('body text is readable on app surfaces', () => {
    for (const s of ['bg', 'panel']) {
      expect(ratio(t('text'), t(s)), `text on ${s}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t('text-sub'), t(s)), `text-sub on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(TONES)('%s: text and deep accent are readable on the soft card and on the base tone', (tone) => {
    expect(ratio(t('text'), t(`${tone}-soft`))).toBeGreaterThanOrEqual(4.5);
    // chips are `deep` text on the tone at 40-60% over a soft card; check the worst case (full tone)
    expect(ratio(t(`${tone}-deep`), t(tone))).toBeGreaterThanOrEqual(3); // large/bold chip text threshold
    expect(ratio(t(`${tone}-deep`), t(`${tone}-soft`))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t(`${tone}-deep`), t('panel'))).toBeGreaterThanOrEqual(4.5);
  });
  it('primary button label (white on primary-deep) is readable', () => {
    expect(ratio([255, 255, 255], t('primary-deep'))).toBeGreaterThanOrEqual(4.5);
  });
});
