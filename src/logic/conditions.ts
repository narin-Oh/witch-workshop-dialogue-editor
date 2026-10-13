import { translate, type Params } from '../i18n/translate';
import type { Operator, Value } from '../model/types';
import { operatorsFor, typeOfValue } from './values';

export class ConditionError extends Error {
  constructor(public readonly key: string, public readonly params: Params) {
    super(translate('en', key, params));
  }
}

/** Evaluate `left <op> right`. Throws ConditionError on type mismatch or an operator invalid for the type. */
export function evaluateCondition(left: Value, operator: Operator, right: Value): boolean {
  const lt = typeOfValue(left);
  const rt = typeOfValue(right);
  if (lt !== rt) throw new ConditionError('err.compareTypes', { a: lt, b: rt });
  if (!operatorsFor(lt).includes(operator)) throw new ConditionError('err.operatorInvalid', { op: operator, type: lt });
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
