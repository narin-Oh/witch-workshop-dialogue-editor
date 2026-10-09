import type { Operator, Value } from '../model/types';
import { operatorsFor, typeOfValue } from './values';

export class ConditionError extends Error {}

/** Evaluate `left <op> right`. Throws ConditionError on type mismatch or an operator invalid for the type. */
export function evaluateCondition(left: Value, operator: Operator, right: Value): boolean {
  const lt = typeOfValue(left);
  const rt = typeOfValue(right);
  if (lt !== rt) throw new ConditionError(`Cannot compare ${lt} with ${rt}`);
  if (!operatorsFor(lt).includes(operator)) throw new ConditionError(`Operator "${operator}" is not valid for ${lt}`);
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return (left as number) > (right as number);
    case '<':
      return (left as number) < (right as number);
    case '>=':
      return (left as number) >= (right as number);
    case '<=':
      return (left as number) <= (right as number);
  }
}
