/**
 * Editor-side data model. This is what gets saved in project files.
 * Runtime (Unity) data lives in ./runtime.ts and is derived from this model.
 */

export type NodeType = 'start' | 'dialogue' | 'choice' | 'condition' | 'variable' | 'event' | 'end';
export const NODE_TYPES: readonly NodeType[] = ['start', 'dialogue', 'choice', 'condition', 'variable', 'event', 'end'];

export type ValueType = 'int' | 'bool' | 'string';
export type Value = number | boolean | string;
export type VariableScope = 'global' | 'local';

export interface VariableDef {
  id: string;
  /** Unique across the project. Referenced by name from nodes and exported data. */
  name: string;
  type: ValueType;
  /** global = persistent game state (Unity save data); local = lives for one dialogue session. */
  scope: VariableScope;
  /** local: value at session start. global: fallback when the game store has no value yet. */
  initialValue: Value;
}

export type Operator = '==' | '!=' | '>' | '<' | '>=' | '<=';
export const OPERATORS: readonly Operator[] = ['==', '!=', '>', '<', '>=', '<='];

export type VariableOperation = 'set' | 'add' | 'subtract';

export interface StartData {
  note: string;
}
export interface DialogueData {
  speaker: string;
  /** Optional display name shown instead of `speaker`. */
  speakerOverride: string;
  text: string;
  portraitId: string;
  expression: string;
}
export interface ChoiceItem {
  id: string;
  text: string;
}
export interface ChoiceData {
  choices: ChoiceItem[];
}
export interface ConditionData {
  variable: string;
  operator: Operator;
  value: Value;
}
export interface VariableNodeData {
  variable: string;
  operation: VariableOperation;
  value: Value;
}
export interface EventParam {
  id: string;
  key: string;
  valueType: ValueType;
  value: Value;
}
export interface EventData {
  eventName: string;
  params: EventParam[];
}
export interface EndData {
  /** Name of this ending, shown in preview and exported for game logic. */
  endingName: string;
}

export interface NodeDataMap {
  start: StartData;
  dialogue: DialogueData;
  choice: ChoiceData;
  condition: ConditionData;
  variable: VariableNodeData;
  event: EventData;
  end: EndData;
}
export type NodeData = NodeDataMap[NodeType];

export interface Position {
  x: number;
  y: number;
}

/** Discriminated union over node `type`. Transient React Flow fields are optional and never persisted. */
export type EditorNode = {
  [T in NodeType]: {
    id: string;
    type: T;
    position: Position;
    data: NodeDataMap[T];
    selected?: boolean;
    measured?: { width?: number; height?: number };
  };
}[NodeType];

export interface EditorEdge {
  id: string;
  source: string;
  /** 'next' | 'true' | 'false' | `choice:<choiceId>` */
  sourceHandle: string;
  target: string;
  selected?: boolean;
}

export interface EditorGraph {
  id: string;
  name: string;
  nodes: EditorNode[];
  edges: EditorEdge[];
}

export interface EditorProject {
  formatVersion: 1;
  id: string;
  name: string;
  variables: VariableDef[];
  graphs: EditorGraph[];
  activeGraphId: string;
  /** Preview-only starting values keyed by variable id. Never exported. */
  previewOverrides: Record<string, Value>;
}

export type Severity = 'error' | 'warning';
export interface ValidationIssue {
  id: string;
  severity: Severity;
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
