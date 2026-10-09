import { translate, type Params } from '../i18n/translate';
import type { Value, VariableDef, VariableOperation } from '../model/types';
import { typeOfValue } from './values';

export class VariableError extends Error {
  constructor(public readonly key: string, public readonly params: Params) {
    super(translate('en', key, params));
  }
}

/** Compute the new value for a variable node operation. Throws VariableError on invalid use. */
export function applyOperation(current: Value, operation: VariableOperation, operand: Value): Value {
  const ct = typeOfValue(current);
  const ot = typeOfValue(operand);
  if (ct !== ot) throw new VariableError('err.operandType', { operand: ot, target: ct });
  switch (operation) {
    case 'set':
      return operand;
    case 'add':
    case 'subtract': {
      if (ct !== 'int') throw new VariableError('err.intOnly', { op: operation });
      return operation === 'add' ? (current as number) + (operand as number) : (current as number) - (operand as number);
    }
  }
}

export type VariableStore = Record<string, Value>;

/** Initial variable values for a session: definition defaults, overridden by preview overrides (keyed by variable id). */
export function initialStore(defs: VariableDef[], overrides: Record<string, Value> = {}): VariableStore {
  const store: VariableStore = {};
  for (const d of defs) store[d.name] = d.id in overrides ? (overrides[d.id] as Value) : d.initialValue;
  return store;
}
