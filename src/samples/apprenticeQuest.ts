import type { VariableDef } from '../model/types';
import { newId } from '../model/ids';
import { GraphBuilder } from './builder';

const v = (name: string, type: VariableDef['type'], scope: VariableDef['scope'], initialValue: VariableDef['initialValue']): VariableDef => ({ id: newId('v'), name, type, scope, initialValue });

export const questVariables: VariableDef[] = [
  v('moonpetalQuestStarted', 'bool', 'global', false),
  v('moonpetals', 'int', 'global', 0),
  v('goldQuest', 'int', 'global', 0),
];

/** The apprentice asks for help in the moonpetal garden; reacts differently by quest progress. */
export function apprenticeQuestGraph() {
  const b = new GraphBuilder('Apprentice Quest');
  b.start('start')
    .cond('started', 'moonpetalQuestStarted', '==', false)
    .say('ask', 'Pip', 'Mistress! The moonpetal garden is wilting, and I cannot revive it alone...', 'worried', 'pip')
    .choice('offer', "I'll help. Let's start now.", 'Not today, Pip.')
    .event('startQ', 'StartQuest', { questId: 'moonpetal_garden' })
    .set('flag', 'moonpetalQuestStarted', 'set', true)
    .say('thanks', 'Pip', 'Thank you! Please bring me five moonpetals.', 'happy')
    .end('endAccept', 'Quest Accepted')
    .say('sulk', 'Pip', '...Okay. I will water them by moonlight, then.', 'sad')
    .end('endDecline', 'Declined')
    .cond('enough', 'moonpetals', '>=', 5)
    .say('done', 'Pip', 'You found them all! The garden is glowing again!', 'delighted')
    .event('tea', 'GiveItem', { itemId: 'moonpetal_tea', amount: 3 })
    .event('complete', 'CompleteQuest', { questId: 'moonpetal_garden' })
    .set('reward', 'goldQuest', 'add', 40)
    .event('scene', 'ChangeScene', { sceneName: 'workshop_evening' })
    .end('endDone', 'Quest Complete')
    .say('still', 'Pip', 'Still a few petals short. Keep searching the forest edge!', 'hopeful')
    .end('endKeep', 'Keep Searching');

  b.link('start', 'next', 'started').link('started', 'true', 'ask').link('started', 'false', 'enough')
    .link('ask', 'next', 'offer').link('offer', 0, 'startQ').link('offer', 1, 'sulk')
    .link('startQ', 'next', 'flag').link('flag', 'next', 'thanks').link('thanks', 'next', 'endAccept').link('sulk', 'next', 'endDecline')
    .link('enough', 'true', 'done').link('enough', 'false', 'still')
    .link('done', 'next', 'tea').link('tea', 'next', 'complete').link('complete', 'next', 'reward').link('reward', 'next', 'scene').link('scene', 'next', 'endDone')
    .link('still', 'next', 'endKeep');
  return b.build();
}
export const QUEST_ENDINGS = ['Quest Accepted', 'Declined', 'Quest Complete', 'Keep Searching'];
