/**
 * Runtime (Unity) data model, schema version 1.
 *
 * Designed for UnityEngine.JsonUtility: no polymorphism, no null, no Dictionary,
 * no mixed-type values. Every node has the same field set; fields a node type
 * does not use hold their default ("", 0, false, []). Enums are strings.
 * Field names map 1:1 to C# fields in docs/UNITY_INTEGRATION.md.
 */
export type RuntimeValueType = 'int' | 'bool' | 'string';

/** A typed value: read the field matching `valueType`; the other two are defaults. */
export interface RuntimeTypedValue {
  valueType: RuntimeValueType;
  intValue: number;
  boolValue: boolean;
  stringValue: string;
}

export interface RuntimeEventParam extends RuntimeTypedValue {
  key: string;
}

export interface RuntimeVariable {
  name: string;
  /** "global" = persistent game state (never reset by dialogue start); "local" = per-session. */
  scope: 'global' | 'local';
  valueType: RuntimeValueType;
  /** local: starting value. global: fallback if the game's store has no value. */
  initial: RuntimeTypedValue;
}

export interface RuntimeChoice {
  id: string;
  text: string;
  next: string;
}

export type RuntimeNodeType = 'dialogue' | 'choice' | 'condition' | 'variable' | 'event' | 'end';

export interface RuntimeNode {
  id: string;
  type: RuntimeNodeType;
  // dialogue
  speaker: string;
  /** Resolved name to show: speakerOverride if set, otherwise speaker. */
  displayName: string;
  text: string;
  portraitId: string;
  expression: string;
  // choice
  choices: RuntimeChoice[];
  // condition
  variable: string;
  operator: string; // "==" "!=" ">" "<" ">=" "<="
  compare: RuntimeTypedValue;
  nextTrue: string;
  nextFalse: string;
  // variable
  operation: string; // "set" "add" "subtract"
  operand: RuntimeTypedValue;
  // event
  eventName: string;
  eventParams: RuntimeEventParam[];
  // dialogue / variable / event
  next: string;
  // end
  endingName: string;
}

export interface RuntimeDialogue {
  schemaVersion: 1;
  id: string;
  name: string;
  /** First executable node (the editor-only Start node is resolved away). */
  startNodeId: string;
  variables: RuntimeVariable[];
  nodes: RuntimeNode[];
}
