import type { EditorProject, VariableDef } from '../model/types';
import { newId } from '../model/ids';
import { GraphBuilder } from './builder';

const v = (name: string, type: VariableDef['type'], scope: VariableDef['scope'], initialValue: VariableDef['initialValue']): VariableDef => ({ id: newId('v'), name, type, scope, initialValue });

export const potionVariables: VariableDef[] = [
  v('gold', 'int', 'global', 100),
  v('reputation', 'int', 'global', 0),
  v('knowsCoughRecipe', 'bool', 'global', false),
  v('haggle', 'int', 'local', 0),
];

/** A customer visits the workshop and asks for a potion. Six endings; the back-room ending needs reputation >= 3. */
export function potionCustomerGraph() {
  const b = new GraphBuilder('Potion Customer');
  b.start('start')
    .say('hello', 'Mira', "Excuse me... is this the witch's workshop? I've had this awful cough for days.", 'worried', 'mira')
    .say('welcome', 'Lumi', "You've come to the right place, dear. What sort of potion do you need?", 'smile', 'lumi')
    .choice('ask', 'A cough remedy, please.', 'Do you have anything... stronger?', 'Sorry, we are closed today.')
    // --- cough remedy ---
    .cond('knows', 'knowsCoughRecipe', '==', true)
    .say('brew', 'Lumi', 'One Herbal Cough Syrup, fresh from the cauldron. How shall we settle the price?', 'smile')
    .choice('price', 'Thirty gold, as usual.', 'Fifteen is fine — a friendly discount.', 'Let her haggle.')
    .set('sell30', 'gold', 'add', 30)
    .say('thanks30', 'Mira', 'Thank you! I feel better already.', 'happy')
    .end('endFair', 'Fair Trade')
    .set('sell15', 'gold', 'add', 15)
    .set('goodwill', 'reputation', 'add', 2)
    .say('thanks15', 'Mira', 'You are too kind! I will tell everyone about this place.', 'delighted')
    .end('endKind', 'Kindly Discount')
    .set('hagglePlus', 'haggle', 'add', 1)
    .cond('hagglePush', 'haggle', '>=', 2)
    .say('haggleMore', 'Mira', 'Hmm... twenty-five? Please?', 'hopeful')
    .say('haggleDeal', 'Mira', 'Fine — twenty gold and not a coin more!', 'cheeky')
    .set('sell20', 'gold', 'add', 20)
    .end('endBargain', 'Hard Bargain')
    // --- recipe not known ---
    .say('noRecipe', 'Lumi', "Ah... I haven't mastered that recipe yet. A tutor in town would teach me for 50 gold.", 'embarrassed')
    .choice('learn', 'Pay 50 gold to learn the recipe.', 'Tell her to come back later.')
    .cond('canAfford', 'gold', '>=', 50)
    .set('pay', 'gold', 'subtract', 50)
    .set('learned', 'knowsCoughRecipe', 'set', true)
    .event('unlock', 'UnlockRecipe', { recipeId: 'herbal_cough_syrup' })
    .say('learnedSay', 'Lumi', 'Recipe learned! Now, where were we?', 'excited')
    .say('broke', 'Lumi', "Oh dear, my pockets are empty. I can't afford the lesson.", 'sad')
    .end('endBroke', 'Empty Pockets')
    .say('later', 'Mira', "Oh... I'll come back another day, then.", 'sad')
    .end('endLater', 'Come Back Later')
    // --- something stronger ---
    .say('stronger', 'Mira', 'Something with a bit more... kick?', 'nervous')
    .cond('trusted', 'reputation', '>=', 3)
    .event('openShop', 'OpenShop', { shopId: 'back_room' })
    .say('backRoom', 'Lumi', 'You come recommended. Take a look at the back-room shelf.', 'smirk')
    .end('endBack', 'Back Room Open')
    .say('declineStrong', 'Lumi', "I don't sell those to strangers. Come back when the town knows you.", 'stern')
    .end('endDecline', 'Politely Declined')
    // --- closed ---
    .say('closed', 'Mira', "Oh! I'm so sorry to have bothered you.", 'sad')
    .set('badRep', 'reputation', 'subtract', 1)
    .end('endClosed', 'Turned Away');

  b.link('start', 'next', 'hello').link('hello', 'next', 'welcome').link('welcome', 'next', 'ask')
    .link('ask', 0, 'knows').link('ask', 1, 'stronger').link('ask', 2, 'closed')
    .link('knows', 'true', 'brew').link('knows', 'false', 'noRecipe')
    .link('brew', 'next', 'price').link('price', 0, 'sell30').link('price', 1, 'sell15').link('price', 2, 'hagglePlus')
    .link('sell30', 'next', 'thanks30').link('thanks30', 'next', 'endFair')
    .link('sell15', 'next', 'goodwill').link('goodwill', 'next', 'thanks15').link('thanks15', 'next', 'endKind')
    .link('hagglePlus', 'next', 'hagglePush').link('hagglePush', 'true', 'haggleDeal').link('hagglePush', 'false', 'haggleMore')
    .link('haggleMore', 'next', 'price').link('haggleDeal', 'next', 'sell20').link('sell20', 'next', 'endBargain')
    .link('noRecipe', 'next', 'learn').link('learn', 0, 'canAfford').link('learn', 1, 'later').link('later', 'next', 'endLater')
    .link('canAfford', 'true', 'pay').link('canAfford', 'false', 'broke').link('broke', 'next', 'endBroke')
    .link('pay', 'next', 'learned').link('learned', 'next', 'unlock').link('unlock', 'next', 'learnedSay').link('learnedSay', 'next', 'brew')
    .link('stronger', 'next', 'trusted').link('trusted', 'true', 'openShop').link('trusted', 'false', 'declineStrong')
    .link('openShop', 'next', 'backRoom').link('backRoom', 'next', 'endBack').link('declineStrong', 'next', 'endDecline')
    .link('closed', 'next', 'badRep').link('badRep', 'next', 'endClosed');
  return b.build();
}

export const POTION_ENDINGS = ['Fair Trade', 'Kindly Discount', 'Hard Bargain', 'Empty Pockets', 'Come Back Later', 'Back Room Open', 'Politely Declined', 'Turned Away'];
export type { EditorProject };
