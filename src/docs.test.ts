import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = join(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (['node_modules', 'dist', 'bin', 'obj', '.git'].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const docs = ['README.md', ...walk(join(repo, 'docs')), ...walk(join(repo, 'unity-package'))]
  .map((p) => (p.startsWith(repo) ? p : join(repo, p)))
  .filter((p) => p.endsWith('.md'));

describe('documentation links', () => {
  it('finds the documentation set', () => {
    expect(docs.length).toBeGreaterThanOrEqual(12);
  });

  it('every relative link and image in every markdown file resolves to a real file', () => {
    const broken: string[] = [];
    for (const file of docs) {
      const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, ''); // ignore code samples
      for (const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = (m[1] as string).split('#')[0] as string;
        if (!target || /^[a-z]+:/i.test(target)) continue; // anchors and http(s)/mailto
        if (!existsSync(resolve(dirname(file), decodeURI(target)))) broken.push(`${file.slice(repo.length + 1)} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
