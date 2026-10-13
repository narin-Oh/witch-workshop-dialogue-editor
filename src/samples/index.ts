import { createProject } from '../model/factory';
import { newId } from '../model/ids';
import type { EditorProject, VariableDef } from '../model/types';
import { apprenticeQuestGraph, questVariables } from './apprenticeQuest';
import { potionCustomerGraph, potionVariables } from './potionCustomer';

/** A project containing both sample conversations, ready to open in the editor and preview. */
export function createSampleProject(): EditorProject {
  const potion = potionCustomerGraph();
  const quest = apprenticeQuestGraph();
  const variables: VariableDef[] = [...potionVariables, ...questVariables];
  return {
    ...createProject('Witch Workshop Samples'),
    id: newId('p'),
    variables,
    graphs: [potion, quest],
    activeGraphId: potion.id,
  };
}
