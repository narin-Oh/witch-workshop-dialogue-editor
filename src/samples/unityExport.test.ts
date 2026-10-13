import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildUnitySampleFiles } from './unityExport';
import { POTION_ENDINGS, QUEST_ENDINGS } from './index.endings';

const root = new URL('../../unity-package/', import.meta.url);

describe('Unity package sample data (unity-package/)', () => {
  const generated = buildUnitySampleFiles();

  it('is deterministic (stable ids, no randomness)', () => {
    expect(buildUnitySampleFiles()).toEqual(generated);
  });

  it('committed files are in sync with the exporter (run `npm run export:unity-samples` if this fails)', () => {
    for (const [rel, content] of Object.entries(generated)) {
      expect(readFileSync(new URL(rel, root), 'utf8'), rel).toBe(content);
    }
  });

  it('exports the sample dialogues in the documented runtime format', () => {
    const potion = JSON.parse(generated['Samples~/PotionCustomer/potion-customer.dialogue.json']!);
    expect(potion.schemaVersion).toBe(1);
    expect(potion.id).toBe('potion-customer');
    expect(potion.nodes.some((n: { type: string }) => n.type === 'start')).toBe(false);
    expect(potion.nodes.every((n: { id: string }) => /^node_\d{3}$/.test(n.id))).toBe(true);
    expect(potion.nodes.find((n: { id: string }) => n.id === potion.startNodeId)).toBeTruthy();
  });

  it('golden playthroughs cover every ending of both samples', () => {
    const endings = (file: string) =>
      new Set<string>(
        JSON.parse(generated[`Tests/Editor/Core/Golden/${file}`]!).scenarios.flatMap((s: { steps: { kind: string; ending: string }[] }) => s.steps.filter((x) => x.kind === 'end').map((x) => x.ending)),
      );
    expect([...endings('potion-customer.golden.json')].sort()).toEqual([...POTION_ENDINGS].sort());
    expect([...endings('apprentice-quest.golden.json')].sort()).toEqual([...QUEST_ENDINGS].sort());
  });
});
