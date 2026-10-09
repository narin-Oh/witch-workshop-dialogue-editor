import type { Operator, Value, ValueType, VariableOperation } from '../model/types';

export function typeOfValue(v: Value): ValueType {
  return typeof v === 'number' ? 'int' : typeof v === 'boolean' ? 'bool' : 'string';
}

export function defaultValueFor(type: ValueType): Value {
  return type === 'int' ? 0 : type === 'bool' ? false : '';
}

/** Which comparison operators make sense for a variable type. */
export function operatorsFor(type: ValueType): Operator[] {
  return type === 'int' ? ['==', '!=', '>', '<', '>=', '<='] : ['==', '!='];
}

export function operationsFor(type: ValueType): VariableOperation[] {
  return type === 'int' ? ['set', 'add', 'subtract'] : ['set'];
}

/** Coerce an arbitrary value to `type` (used when the user changes a type in the UI). */
export function coerceValue(v: Value, type: ValueType): Value {
  switch (type) {
    case 'int': {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    }
    case 'bool':
      return typeof v === 'boolean' ? v : v === 'true';
    case 'string':
      return String(v);
  }
}

export function isValueOfType(v: unknown, type: ValueType): v is Value {
  return type === 'int' ? typeof v === 'number' && Number.isInteger(v) : type === 'bool' ? typeof v === 'boolean' : typeof v === 'string';
}

export function formatValue(v: Value): string {
  return typeof v === 'string' ? `"${v}"` : String(v);
}
