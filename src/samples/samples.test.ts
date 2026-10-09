import { describe, expect, it } from 'vitest';
import { createSampleProject } from './index';
import { validateGraph, errorsOf } from '../logic/validation';
import { advance, choose, startPreview, type PreviewState } from '../preview/runner';
import { exportRuntime } from '../io/runtimeExport';
import { POTION_ENDINGS, QUEST_ENDINGS } from './index.endings';
import type { EditorGraph, Value, VariableDef } from '../model/types';

const project = createSampleProject();
const [potion, quest] = project.graphs as [EditorGraph, EditorGraph];
const byName = (n: string): VariableDef => project.variables.find((v) => v.name === n) as VariableDef;

/** Explore every reachable (state-dependent) path with DFS over choices; collect endings reached. */
function explore(graph: EditorGraph, overrides: Record<string, Value> = {}): Set<string> {
  const endings = new Set<string>();
  const seen = new Set<string>();
  const visit = (s: PreviewState, depth: number) => {
    expect(s.status).not.toBe('error');
    if (s.status === 'finished') return void endings.add(s.endingName as string);
    if (depth > 40) return;
    const key = `${s.nodeId}|${JSON.stringify(s.vars)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (s.status === 'dialogue') visit(advance(graph, s), depth + 1);
    else for (const c of s.choices) visit(choose(graph, s, c.id), depth + 1);
  };
  visit(startPreview(graph, project.variables, overrides), 0);
  return endings;
}

describe('sample conversations', () => {
  it('have no validation errors', () => {
    for (const g of [potion, quest]) expect(errorsOf(validateGraph(g, project.variables))).toEqual([]);
  });
  it('export to runtime data', () => {
    for (const g of [potion, quest]) expect(exportRuntime(g, project.variables).nodes.length).toBeGreaterThan(5);
  });
  it('potion customer: default state reaches most endings', () => {
    const ends = explore(potion);
    for (const e of ['Fair Trade', 'Kindly Discount', 'Hard Bargain', 'Come Back Later', 'Politely Declined', 'Turned Away']) expect(ends.has(e)).toBe(true);
    expect(ends.has('Back Room Open')).toBe(false); // needs reputation >= 3
    expect(ends.has('Empty Pockets')).toBe(false); // needs gold < 50
  });
  it('potion customer: reputation override unlocks the back room and fires OpenShop', () => {
    const o = { [byName('reputation').id]: 3 };
    expect(explore(potion, o).has('Back Room Open')).toBe(true);
    let s = startPreview(potion, project.variables, o);
    s = advance(potion, s); // hello → welcome
    s = advance(potion, s); // welcome → choice
    s = choose(potion, s, s.choices[1]!.id); // "something stronger"
    s = advance(potion, s); // Mira's line → reputation check → OpenShop → Lumi's line
    expect(s.events).toEqual([{ name: 'OpenShop', params: { shopId: 'back_room' } }]);
  });
  it('potion customer: all declared endings are reachable across scenarios', () => {
    const all = new Set([
      ...explore(potion),
      ...explore(potion, { [byName('reputation').id]: 3 }),
      ...explore(potion, { [byName('gold').id]: 10 }), // too poor to learn the recipe
    ]);
    expect([...all].sort()).toEqual([...POTION_ENDINGS].sort());
  });
  it('potion customer: learning the recipe unlocks it and spends gold', () => {
    let s = startPreview(potion, project.variables);
    s = advance(potion, s); s = advance(potion, s);
    s = choose(potion, s, s.choices[0]!.id); // cough remedy → recipe unknown
    s = advance(potion, s);
    s = choose(potion, s, s.choices[0]!.id); // pay 50
    expect(s.vars.gold).toBe(50);
    expect(s.vars.knowsCoughRecipe).toBe(true);
    expect(s.events[0]?.name).toBe('UnlockRecipe');
  });
  it('apprentice quest: default and progressed states reach every ending', () => {
    const started = { [byName('moonpetalQuestStarted').id]: true };
    const done = { ...started, [byName('moonpetals').id]: 5 };
    const all = new Set([...explore(quest), ...explore(quest, started), ...explore(quest, done)]);
    expect([...all].sort()).toEqual([...QUEST_ENDINGS].sort());
    const s = startPreview(quest, project.variables, done);
    expect(s.text).toMatch(/found them all/);
  });
});
