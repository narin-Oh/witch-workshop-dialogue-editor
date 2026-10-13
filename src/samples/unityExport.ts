import { exportRuntime } from '../io/runtimeExport';
import type { RuntimeDialogue, RuntimeTypedValue } from '../model/runtime';
import { toTypedValue } from '../io/runtimeExport';
import { advance, choose, startPreview, type PreviewState } from '../preview/runner';
import type { EditorGraph, Value, VariableDef } from '../model/types';
import { typeOfValue } from '../logic/values';
import { createSampleProject } from './index';

/**
 * Generates the files shipped in `unity-package/`: the sample dialogues exported exactly like the editor's
 * "Export for Unity" does (with deterministic ids), plus "golden" playthroughs produced by the editor's own preview
 * runner. The Unity package's tests replay the golden playthroughs to prove the C# engine behaves identically.
 * Run `npm run export:unity-samples` to regenerate; `unityExport.test.ts` fails if the committed files are stale.
 */

export type GeneratedFiles = Record<string, string>;

// ---------------------------------------------------------------- deterministic ids

/** Replaces random UUID ids with stable readable ones, in order of appearance. Structure is unchanged. */
export function canonicalizeIds(d: RuntimeDialogue, slug: string): RuntimeDialogue {
  const nodeIds = new Map<string, string>();
  d.nodes.forEach((n, i) => nodeIds.set(n.id, `node_${String(i + 1).padStart(3, '0')}`));
  const choiceIds = new Map<string, string>();
  let c = 0;
  for (const n of d.nodes) for (const ch of n.choices) choiceIds.set(ch.id, `choice_${String(++c).padStart(3, '0')}`);
  const nid = (id: string): string => (id === '' ? '' : (nodeIds.get(id) ?? id));
  return {
    ...d,
    id: slug,
    startNodeId: nid(d.startNodeId),
    nodes: d.nodes.map((n) => ({
      ...n,
      id: nid(n.id),
      next: nid(n.next),
      nextTrue: nid(n.nextTrue),
      nextFalse: nid(n.nextFalse),
      choices: n.choices.map((ch) => ({ ...ch, id: choiceIds.get(ch.id) ?? ch.id, next: nid(ch.next) })),
    })),
  };
}

// ---------------------------------------------------------------- golden playthroughs

interface Scenario {
  name: string;
  /** Global variable overrides by name (the game's saved values at the start of the conversation). */
  overrides?: Record<string, Value>;
  /** Index to pick at each choice, in order. */
  picks?: number[];
}

type NamedValue = RuntimeTypedValue & { name: string };
const named = (name: string, v: Value): NamedValue => ({ name, ...toTypedValue(typeOfValue(v), v) });

function playScenario(graph: EditorGraph, project: { variables: VariableDef[] }, exported: RuntimeDialogue, sc: Scenario) {
  const overridesById: Record<string, Value> = {};
  for (const [name, v] of Object.entries(sc.overrides ?? {})) {
    const def = project.variables.find((x) => x.name === name);
    if (!def) throw new Error(`Scenario "${sc.name}" overrides unknown variable ${name}`);
    overridesById[def.id] = v;
  }
  let state: PreviewState = startPreview(graph, project.variables, overridesById);
  const picks = [...(sc.picks ?? [])];
  const steps: Record<string, unknown>[] = [];
  const blank = { kind: '', displayMode: '', displayName: '', text: '', portraitId: '', expression: '', choices: [] as string[], pick: 0, ending: '' };
  for (let guard = 0; guard < 500; guard++) {
    if (state.status === 'error') throw new Error(`Scenario "${sc.name}" hit an error: ${state.error}`);
    if (state.status === 'finished') {
      steps.push({ ...blank, kind: 'end', ending: state.endingName ?? '' });
      break;
    }
    if (state.status === 'dialogue') {
      steps.push({ ...blank, kind: 'line', displayMode: state.displayMode, displayName: state.speaker, text: state.text, portraitId: state.portraitId, expression: state.expression });
      state = advance(graph, state);
    } else {
      steps.push({ ...blank, kind: 'choices', choices: state.choices.map((c) => c.text) });
      const pick = picks.shift();
      if (pick === undefined) throw new Error(`Scenario "${sc.name}" ran out of picks`);
      const choice = state.choices[pick];
      if (!choice) throw new Error(`Scenario "${sc.name}": no choice ${pick}`);
      steps.push({ ...blank, kind: 'pick', pick, text: choice.text });
      state = choose(graph, state, choice.id);
    }
  }
  if (picks.length) throw new Error(`Scenario "${sc.name}" has unused picks`);
  return {
    name: sc.name,
    globalOverrides: Object.entries(sc.overrides ?? {}).map(([k, v]) => named(k, v)),
    picks: sc.picks ?? [],
    steps,
    events: state.events.map((e) => ({ name: e.name, parameters: Object.entries(e.params).map(([k, v]) => ({ key: k, ...toTypedValue(typeOfValue(v), v) })) })),
    finalVars: exported.variables.map((v) => named(v.name, state.vars[v.name] as Value)),
  };
}

const POTION_SCENARIOS: Scenario[] = [
  { name: 'learn the recipe, then sell at full price', picks: [0, 0, 0] },
  { name: 'friendly discount', picks: [0, 0, 1] },
  { name: 'haggle twice', picks: [0, 0, 2, 2] },
  { name: 'cannot afford the recipe', overrides: { gold: 10 }, picks: [0, 0] },
  { name: 'recipe already known, sell at full price', overrides: { knowsCoughRecipe: true }, picks: [0, 0] },
  { name: 'decline to learn the recipe', picks: [0, 1] },
  { name: 'stronger potion without reputation', picks: [1] },
  { name: 'stronger potion with reputation opens the back room', overrides: { reputation: 3 }, picks: [1] },
  { name: 'shop is closed', picks: [2] },
];

const QUEST_SCENARIOS: Scenario[] = [
  { name: 'accept the quest', picks: [0] },
  { name: 'decline the quest', picks: [1] },
  { name: 'quest started, not enough petals', overrides: { moonpetalQuestStarted: true }, picks: [] },
  { name: 'quest started, enough petals', overrides: { moonpetalQuestStarted: true, moonpetals: 5, goldQuest: 7 }, picks: [] },
];

// ---------------------------------------------------------------- build

export const stringify = (x: unknown): string => `${JSON.stringify(x, null, 2)}\n`;

const TESTS = 'Tests/Editor/Core/Golden/';

/** Builds every generated file (paths are relative to `unity-package/`). Pure: no file-system access. */
export function buildUnitySampleFiles(): GeneratedFiles {
  const project = createSampleProject();
  const [potionGraph, questGraph] = project.graphs as [EditorGraph, EditorGraph];
  const files: GeneratedFiles = {};

  const add = (slug: string, graph: EditorGraph, scenarios: Scenario[], sampleDir: string) => {
    const raw = exportRuntime(graph, project.variables);
    const exported = canonicalizeIds(raw, slug);
    const json = stringify(exported);
    files[`${sampleDir}/${slug}.dialogue.json`] = json;
    files[`${TESTS}${slug}.dialogue.json`] = json;
    files[`${TESTS}${slug}.golden.json`] = stringify({
      dialogueFile: `${slug}.dialogue.json`,
      dialogueId: slug,
      scenarios: scenarios.map((s) => playScenario(graph, project, exported, s)),
    });
    return exported;
  };

  const potion = add('potion-customer', potionGraph, POTION_SCENARIOS, 'Samples~/PotionCustomer');
  add('apprentice-quest', questGraph, QUEST_SCENARIOS, 'Samples~/GameEventsExample');

  // Schema contract: the exact key sets the C# DTOs must declare.
  const node = potion.nodes[0]!;
  files[`${TESTS}schema.golden.json`] = stringify({
    schemaVersion: potion.schemaVersion,
    rootFields: Object.keys(potion),
    nodeFields: Object.keys(node),
    typedValueFields: Object.keys(node.compare),
    variableFields: Object.keys(potion.variables[0]!),
    choiceFields: Object.keys(potion.nodes.flatMap((n) => n.choices)[0]!),
    eventParamFields: Object.keys(potion.nodes.flatMap((n) => n.eventParams)[0]!),
    nodeTypes: [...new Set(potion.nodes.map((n) => n.type))].sort(),
  });
  return files;
}
