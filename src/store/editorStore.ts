import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import { create } from 'zustand';
import { copySelection, connectNodes, deleteSelection, findFreePosition, pasteClipboard, pruneEdges, sameGraphContent, type Clipboard, type Connection } from '../logic/graphEdit';
import { COALESCE_MS, commitFrom, createHistory, pushHistory, redo as redoH, replacePresent, undo as undoH, type History } from '../logic/history';
import { activeGraphOf, newVariable, removeVariable, setPreviewOverride, updateActiveGraph, updateVariable } from '../logic/projectOps';
import { createGraph, createNode, createProject, defaultNodeData } from '../model/factory';
import type { EditorEdge, EditorGraph, EditorNode, EditorProject, NodeData, NodeType, Position, Value, VariableDef } from '../model/types';
import { loadAutosave } from '../io/autosave';
import { createSampleProject } from '../samples';
import type { LogEntry } from '../preview/runner';
import { getT, type MessageRef } from '../i18n';

export type BottomTab = 'validation' | 'events';
export interface Toast {
  kind: 'info' | 'success' | 'error';
  text: string;
}

interface EditorState {
  history: History<EditorProject>;
  clipboard: Clipboard | null;
  pasteCount: number;
  dragBase: EditorProject | null;
  // UI state
  previewOpen: boolean;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  focusRequest: { nodeId: string; seq: number } | null;
  toast: Toast | null;
  autosaveError: MessageRef | null;
  restoredFromAutosave: boolean;
  /** Log of the most recent preview run, shown in the bottom panel. */
  lastRun: LogEntry[];

  // graph editing
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  beginDrag: () => void;
  endDrag: () => void;
  /** Adds a node (selected afterwards) and returns its id, or null if refused. `avoidOverlap` nudges it off existing nodes. */
  addNode: (type: NodeType, position?: Position, avoidOverlap?: boolean) => string | null;
  updateNodeData: (id: string, updater: (d: NodeData) => NodeData, coalesceKey?: string) => void;
  deleteSelection: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  undo: () => void;
  redo: () => void;
  // variables
  addVariable: () => void;
  patchVariable: (id: string, patch: Partial<Omit<VariableDef, 'id'>>) => void;
  deleteVariable: (id: string) => void;
  setOverride: (id: string, value: Value | undefined) => void;
  // graphs / project
  addGraph: () => void;
  renameGraph: (id: string, name: string) => void;
  deleteGraph: (id: string) => void;
  setActiveGraph: (id: string) => void;
  renameProject: (name: string) => void;
  loadProject: (p: EditorProject) => void;
  newProject: () => void;
  loadSamples: () => void;
  // ui
  setPreviewOpen: (open: boolean) => void;
  setBottom: (open: boolean, tab?: BottomTab) => void;
  focusNode: (nodeId: string) => void;
  notify: (toast: Toast | null) => void;
  setAutosaveError: (e: MessageRef | null) => void;
  dismissRestored: () => void;
  setLastRun: (log: LogEntry[]) => void;
}

const now = () => Date.now();

function bootProject(): { project: EditorProject; restored: boolean } {
  const saved = loadAutosave();
  return saved ? { project: saved, restored: true } : { project: createSampleProject(), restored: false };
}

const asRf = <T,>(x: unknown): T => x as T;

export const useEditorStore = create<EditorState>((set, get) => {
  const boot = bootProject();

  const present = () => get().history.present;
  /** Commit a project change as an undo step. */
  const commit = (next: EditorProject, key?: string) => set((s) => ({ history: pushHistory(s.history, next, now(), key) }));
  /** Replace without an undo step. */
  const quiet = (next: EditorProject) => set((s) => ({ history: replacePresent(s.history, next) }));
  const commitGraph = (fn: (g: EditorGraph) => EditorGraph, key?: string) => commit(updateActiveGraph(present(), fn), key);
  const reset = (p: EditorProject) => set({ history: createHistory(p), clipboard: get().clipboard, dragBase: null, previewOpen: false, restoredFromAutosave: false });

  return {
    history: createHistory(boot.project),
    clipboard: null,
    pasteCount: 0,
    dragBase: null,
    previewOpen: false,
    bottomOpen: true,
    bottomTab: 'validation',
    focusRequest: null,
    toast: null,
    autosaveError: null,
    restoredFromAutosave: boot.restored,
    lastRun: [],

    onNodesChange: (changes) => {
      // Deletion is handled by deleteSelection() so edges/history stay consistent.
      const relevant = changes.filter((c) => c.type !== 'remove');
      if (!relevant.length) return;
      quiet(updateActiveGraph(present(), (g) => ({ ...g, nodes: asRf<EditorNode[]>(applyNodeChanges(relevant, asRf(g.nodes))) })));
    },
    onEdgesChange: (changes) => {
      const relevant = changes.filter((c) => c.type !== 'remove');
      if (!relevant.length) return;
      quiet(updateActiveGraph(present(), (g) => ({ ...g, edges: asRf<EditorEdge[]>(applyEdgeChanges(relevant, asRf(g.edges))) })));
    },
    onConnect: (c) => commitGraph((g) => connectNodes(g, c)),
    beginDrag: () => set({ dragBase: present() }),
    endDrag: () => {
      const base = get().dragBase;
      if (!base) return;
      set((s) => ({
        dragBase: null,
        history: commitFrom(s.history, base, (a, b) => sameGraphContent(activeGraphOf(a), activeGraphOf(b)), now()),
      }));
    },
    addNode: (type, position, avoidOverlap = false) => {
      const g = activeGraphOf(present());
      if (type === 'start' && g.nodes.some((n) => n.type === 'start')) {
        get().notify({ kind: 'info', text: getT()('toast.startExists') });
        return null;
      }
      const desired = position ?? (g.nodes.length ? { x: Math.max(...g.nodes.map((n) => n.position.x)) + 320, y: 120 } : { x: 80, y: 120 });
      const pos = avoidOverlap ? findFreePosition(g.nodes, desired) : desired;
      const node = createNode(type, pos);
      commitGraph((gr) => ({ ...gr, nodes: [...gr.nodes.map((n) => (n.selected ? ({ ...n, selected: false } as EditorNode) : n)), { ...node, selected: true } as EditorNode] }));
      return node.id;
    },
    updateNodeData: (id, updater, key) =>
      commitGraph((g) => {
        const nodes = g.nodes.map((n) => (n.id === id ? ({ ...n, data: updater(n.data) } as EditorNode) : n));
        return pruneEdges({ ...g, nodes });
      }, key ? `${key}:${id}` : undefined),
    deleteSelection: () => commitGraph(deleteSelection),
    copy: () => {
      const clip = copySelection(activeGraphOf(present()));
      if (!clip) return;
      set({ clipboard: clip, pasteCount: 0 });
      get().notify({ kind: 'info', text: getT()('toast.copied', { n: clip.nodes.length }) });
    },
    paste: () => {
      const { clipboard, pasteCount } = get();
      if (!clipboard) return;
      const k = pasteCount + 1;
      commitGraph((g) => pasteClipboard(g, clipboard, { x: 40 * k, y: 40 * k }));
      set({ pasteCount: k });
    },
    duplicate: () => {
      const clip = copySelection(activeGraphOf(present()));
      if (!clip) return;
      commitGraph((g) => pasteClipboard(g, clip, { x: 40, y: 40 }));
    },
    undo: () => set((s) => ({ history: undoH(s.history) })),
    redo: () => set((s) => ({ history: redoH(s.history) })),

    addVariable: () => commit({ ...present(), variables: [...present().variables, newVariable(present().variables)] }),
    patchVariable: (id, patch) => commit(updateVariable(present(), id, patch), `var:${id}:${Object.keys(patch).join(',')}`),
    deleteVariable: (id) => commit(removeVariable(present(), id)),
    setOverride: (id, value) => quiet(setPreviewOverride(present(), id, value)),

    addGraph: () => {
      const g = createGraph(getT()('default.graphN', { n: present().graphs.length + 1 }));
      commit({ ...present(), graphs: [...present().graphs, g], activeGraphId: g.id });
    },
    renameGraph: (id, name) => commit({ ...present(), graphs: present().graphs.map((g) => (g.id === id ? { ...g, name } : g)) }, `rename:${id}`),
    deleteGraph: (id) => {
      const p = present();
      if (p.graphs.length <= 1) {
        get().notify({ kind: 'info', text: getT()('toast.lastGraph') });
        return;
      }
      const graphs = p.graphs.filter((g) => g.id !== id);
      commit({ ...p, graphs, activeGraphId: p.activeGraphId === id ? (graphs[0] as EditorGraph).id : p.activeGraphId });
    },
    setActiveGraph: (id) => quiet({ ...present(), activeGraphId: id }),
    renameProject: (name) => commit({ ...present(), name }, 'rename-project'),
    loadProject: (p) => reset(p),
    newProject: () => reset(createProject(getT()('default.project'), getT()('default.graph'))),
    loadSamples: () => reset(createSampleProject()),

    setPreviewOpen: (open) => set({ previewOpen: open }),
    setBottom: (open, tab) => set((s) => ({ bottomOpen: open, bottomTab: tab ?? s.bottomTab })),
    focusNode: (nodeId) => {
      quiet(updateActiveGraph(present(), (g) => ({ ...g, nodes: g.nodes.map((n) => ({ ...n, selected: n.id === nodeId }) as EditorNode) })));
      set((s) => ({ focusRequest: { nodeId, seq: (s.focusRequest?.seq ?? 0) + 1 } }));
    },
    notify: (toast) => set({ toast }),
    setAutosaveError: (e) => set({ autosaveError: e }),
    dismissRestored: () => set({ restoredFromAutosave: false }),
    setLastRun: (log) => set({ lastRun: log }),
  };
});

export const selectProject = (s: EditorState): EditorProject => s.history.present;
export { COALESCE_MS, defaultNodeData };
