import type { Value, ValueType } from './types';

export interface EventParamSpec {
  key: string;
  valueType: ValueType;
  required: boolean;
  defaultValue: Value;
  hint: string;
}
export interface EventSpec {
  name: string;
  description: string;
  params: EventParamSpec[];
}

/**
 * Known game events. Custom event names are also allowed in the editor;
 * the catalog only provides parameter presets and required-parameter validation.
 * Unity scripts register handlers by event name (see docs/UNITY_INTEGRATION.md).
 */
export const EVENT_CATALOG: readonly EventSpec[] = [
  { name: 'OpenShop', description: 'Open a shop window', params: [{ key: 'shopId', valueType: 'string', required: true, defaultValue: '', hint: 'e.g. main_shop' }] },
  {
    name: 'GiveItem',
    description: 'Give an item to the player',
    params: [
      { key: 'itemId', valueType: 'string', required: true, defaultValue: '', hint: 'e.g. moonpetal' },
      { key: 'amount', valueType: 'int', required: true, defaultValue: 1, hint: 'quantity' },
    ],
  },
  { name: 'StartQuest', description: 'Start a quest', params: [{ key: 'questId', valueType: 'string', required: true, defaultValue: '', hint: 'quest id' }] },
  { name: 'CompleteQuest', description: 'Complete a quest', params: [{ key: 'questId', valueType: 'string', required: true, defaultValue: '', hint: 'quest id' }] },
  { name: 'ChangeScene', description: 'Load another scene', params: [{ key: 'sceneName', valueType: 'string', required: true, defaultValue: '', hint: 'scene name' }] },
  { name: 'UnlockRecipe', description: 'Unlock a potion recipe', params: [{ key: 'recipeId', valueType: 'string', required: true, defaultValue: '', hint: 'recipe id' }] },
];

export function findEventSpec(name: string): EventSpec | undefined {
  return EVENT_CATALOG.find((e) => e.name === name);
}
