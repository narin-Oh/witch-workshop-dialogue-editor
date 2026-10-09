import type { ReactNode } from 'react';
import type { NodeType } from '../../model/types';
import { IconChoice, IconCondition, IconDialogue, IconEnd, IconEvent, IconStart, IconVariable } from '../ui/Motifs';

export interface NodeMeta {
  label: string;
  description: string;
  icon: ReactNode;
  /** Full static class names so Tailwind can see them. */
  card: string;
  tape: string;
  chip: string;
  swatch: string;
}

export const NODE_META: Record<NodeType, NodeMeta> = {
  start: { label: 'Start', description: 'Entry point (editor only)', icon: <IconStart size={16} />, card: 'bg-mint-soft border-mint', tape: 'bg-mint/80', chip: 'bg-mint/40 text-mint-deep', swatch: 'bg-mint' },
  dialogue: { label: 'Dialogue', description: 'A line spoken by a character', icon: <IconDialogue size={16} />, card: 'bg-primary-soft border-primary', tape: 'bg-primary/80', chip: 'bg-primary/40 text-primary-deep', swatch: 'bg-primary' },
  choice: { label: 'Choice', description: 'Player picks an option', icon: <IconChoice size={16} />, card: 'bg-yellow-soft border-yellow', tape: 'bg-yellow/90', chip: 'bg-yellow/60 text-yellow-deep', swatch: 'bg-yellow' },
  condition: { label: 'Condition', description: 'Branch on a variable', icon: <IconCondition size={16} />, card: 'bg-blue-soft border-blue', tape: 'bg-blue/90', chip: 'bg-blue/50 text-blue-deep', swatch: 'bg-blue' },
  variable: { label: 'Variable', description: 'Set or change a variable', icon: <IconVariable size={16} />, card: 'bg-peach-soft border-peach', tape: 'bg-peach/90', chip: 'bg-peach/60 text-peach-deep', swatch: 'bg-peach' },
  event: { label: 'Event', description: 'Trigger a game event', icon: <IconEvent size={16} />, card: 'bg-pink-soft border-pink', tape: 'bg-pink/90', chip: 'bg-pink/60 text-pink-deep', swatch: 'bg-pink' },
  end: { label: 'End', description: 'Finish the conversation', icon: <IconEnd size={16} />, card: 'bg-mauve-soft border-mauve', tape: 'bg-mauve/90', chip: 'bg-mauve/60 text-mauve-deep', swatch: 'bg-mauve' },
};

export const PALETTE_ORDER: NodeType[] = ['start', 'dialogue', 'choice', 'condition', 'variable', 'event', 'end'];
