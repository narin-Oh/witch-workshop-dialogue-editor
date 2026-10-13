import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportRuntime, runtimeToJson } from '../io/runtimeExport';
import { parseProject } from '../io/projectFile';
import { errorsOf, validateGraph } from '../logic/validation';
import { advance, choose, startPreview, type PreviewState } from '../preview/runner';

const dir = new URL('../../docs/examples/', import.meta.url);
const projectText = readFileSync(new URL('potion-customer-tutorial.witchproj.json', dir), 'utf8');
const exportedText = readFileSync(new URL('potion-customer-tutorial.dialogue.json', dir), 'utf8');

/** The Korean user guide's tutorial result. These files must keep working with the code. */
describe('user guide tutorial example (docs/examples)', () => {
  const project = parseProject(projectText);
  const graph = project.graphs[0]!;

  it('loads, has the documented shape (11 nodes, 10 connections) and validates without problems', () => {
    expect(graph.nodes).toHaveLength(11);
    expect(graph.edges).toHaveLength(10);
    expect(validateGraph(graph, project.variables)).toEqual([]);
  });

  it('exports to exactly the committed Unity JSON (schema unchanged)', () => {
    expect(runtimeToJson(exportRuntime(graph, project.variables))).toBe(exportedText.trimEnd());
    const data = JSON.parse(exportedText);
    expect(data.schemaVersion).toBe(1);
    expect(data.nodes.some((n: { type: string }) => n.type === 'start')).toBe(false);
    expect(data.variables.map((v: { name: string; scope: string }) => `${v.name}:${v.scope}`).sort()).toEqual(['gold:global', 'reputation:global']);
    expect(errorsOf(validateGraph(graph, project.variables))).toEqual([]);
  });

  it('plays the three documented endings', () => {
    const play = (picks: number[], overrides = {}) => {
      let s: PreviewState = startPreview(graph, project.variables, overrides);
      for (const pick of picks) s = s.status === 'choice' ? choose(graph, s, s.choices[pick]!.id) : advance(graph, s);
      return s;
    };
    const rep = project.variables.find((v) => v.name === 'reputation')!.id;
    // 다음 ▸, 선택지 2 (reputation 0) -> 거절 대사, 다음 ▸ -> 종료
    const refused = play([0, 1, 0, 0]);
    expect(refused.status).toBe('finished');
    expect(refused.endingName).toBe('정중한 거절');
    const sold = play([0, 0]);
    expect(sold.endingName).toBe('기침약 판매');
    expect(sold.vars.gold).toBe(130);
    expect(sold.events).toEqual([{ name: 'GiveItem', params: { itemId: 'cough_potion', amount: 1 } }]);
    const shop = play([0, 1], { [rep]: 3 });
    expect(shop.endingName).toBe('비밀 상점 개방');
    expect(shop.events).toEqual([{ name: 'OpenShop', params: { shopId: 'secret_shop' } }]);
  });
});
