import { useT } from '../../i18n';
import { Handle, Position, useNodeId, useStoreApi, type HandleProps, type NodeProps } from '@xyflow/react';
import type { HTMLAttributes } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { memo, type ReactNode } from 'react';
import { choiceHandle } from '../../logic/graphUtils';
import { formatValue } from '../../logic/values';
import type { EditorNode, NodeType } from '../../model/types';
import { IconError, IconWarn } from '../ui/Motifs';
import { useValidation } from '../validation/ValidationContext';
import { NODE_META } from './nodeMeta';

/** Whether a click-connect gesture was in progress before the current click sequence began (set on the first click). */
let gestureBeforeClick = false;

/**
 * A React Flow Handle that also supports double-click: cancel a connection gesture in progress, or remove the
 * connection(s) attached to this handle (the node is never deleted). Single click and drag keep React Flow's behaviour.
 */
function NodeHandle(props: HandleProps & Omit<HTMLAttributes<HTMLDivElement>, 'id'>) {
  const rf = useStoreApi();
  const nodeId = useNodeId();
  return (
    <Handle
      {...props}
      onClickCapture={(e) => {
        if (e.detail <= 1) gestureBeforeClick = rf.getState().connectionClickStartHandle != null;
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!nodeId) return;
        useEditorStore.getState().handleDoubleClick(
          { nodeId, type: props.type, handleId: props.id, hadGesture: gestureBeforeClick, point: { x: e.clientX, y: e.clientY } },
          () => {
            rf.getState().cancelConnection();
            rf.setState({ connectionClickStartHandle: null });
          },
        );
      }}
    />
  );
}

type Data<T extends NodeType> = Extract<EditorNode, { type: T }>['data'];

function Shell({ id, type, selected, children, input = true }: { id: string; type: NodeType; selected?: boolean; children: ReactNode; input?: boolean }) {
  const t = useT();
  const meta = NODE_META[type];
  const issues = useValidation().byNode.get(id) ?? [];
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  return (
    <div
      className={`relative w-[260px] rounded-2xl border-2 shadow-card transition-shadow ${meta.card} ${selected ? 'ring-[3px] ring-primary-deep/70 ring-offset-2 ring-offset-bg' : ''}`}
    >
      {/* masking-tape accent */}
      <span aria-hidden="true" className={`pointer-events-none absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 rounded-sm opacity-90 ${meta.tape}`} />
      <div className="flex items-center gap-2 px-3 pb-1 pt-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide ${meta.chip}`}>
          {meta.icon}
          {t(`node.${type}.label`)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {errors > 0 && (
            <span title={issues.filter((i) => i.severity === 'error').map((i) => t(i.key, i.params)).join('\n')} className="inline-flex items-center gap-0.5 rounded-full bg-pink px-1.5 py-0.5 text-[11px] font-bold text-pink-deep">
              <IconError size={13} />
              {errors}
            </span>
          )}
          {warnings > 0 && (
            <span title={issues.filter((i) => i.severity === 'warning').map((i) => t(i.key, i.params)).join('\n')} className="inline-flex items-center gap-0.5 rounded-full bg-yellow px-1.5 py-0.5 text-[11px] font-bold text-yellow-deep">
              <IconWarn size={13} />
              {warnings}
            </span>
          )}
        </span>
      </div>
      <div className="px-3 pb-3 text-[13px] leading-snug text-text">{children}</div>
      {input && <NodeHandle type="target" position={Position.Left} id="in" aria-label={t('handle.in')} />}
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="italic text-text-sub">{children}</span>;
const Out = ({ id = 'next' }: { id?: string }) => {
  const t = useT();
  return <NodeHandle type="source" position={Position.Right} id={id} aria-label={t('handle.next')} />;
};

function StartNode({ id, selected }: NodeProps) {
  const t = useT();
  return (
    <Shell id={id} type="start" selected={selected} input={false}>
      <p className="text-text-sub">{t('card.start')}</p>
      <Out />
    </Shell>
  );
}

function DialogueNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'dialogue'>;
  const name = d.speakerOverride.trim() || d.speaker;
  return (
    <Shell id={id} type="dialogue" selected={selected}>
      {d.displayMode === 'character'
        ? <p className="font-bold">{name || <Muted>{t('card.noSpeaker')}</Muted>}</p>
        : <p className="inline-block rounded-full bg-bg/70 px-2 py-0.5 text-[11px] font-bold text-text-sub">{t(`dialogue.mode.${d.displayMode}`)}</p>}
      <p className={`mt-0.5 line-clamp-3 whitespace-pre-wrap ${d.displayMode === 'narration' ? 'italic' : ''} ${d.displayMode === 'sceneTransition' ? 'text-center font-serif' : ''}`}>{d.text || <Muted>{t('card.emptyText')}</Muted>}</p>
      {d.displayMode === 'character' && (d.portraitId || d.expression) && (
        <p className="mt-1.5 text-[11px] text-text-sub">
          {d.portraitId || '—'} · {d.expression || '—'}
        </p>
      )}
      <Out />
    </Shell>
  );
}

function ChoiceNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'choice'>;
  return (
    <Shell id={id} type="choice" selected={selected}>
      <ol className="-mx-3 -mb-3 mt-0.5">
        {d.choices.map((c, i) => (
          <li key={c.id} className="relative flex items-start gap-2 border-t border-yellow/70 px-3 py-1.5">
            <span className="mt-px inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-yellow text-[11px] font-bold text-yellow-deep">{i + 1}</span>
            <span className="line-clamp-2 pr-2">{c.text || <Muted>{t('card.emptyChoice')}</Muted>}</span>
            <NodeHandle type="source" position={Position.Right} id={choiceHandle(c.id)} aria-label={t('handle.choice', { n: i + 1 })} />
          </li>
        ))}
        {d.choices.length === 0 && <li className="px-3 py-2"><Muted>{t('card.noChoices')}</Muted></li>}
      </ol>
    </Shell>
  );
}

function ConditionNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'condition'>;
  return (
    <Shell id={id} type="condition" selected={selected}>
      <p className="font-mono text-[13px] font-semibold">{d.variable ? `${d.variable} ${d.operator} ${formatValue(d.value)}` : <Muted>{t('card.chooseVar')}</Muted>}</p>
      <div className="-mx-3 -mb-3 mt-2">
        <div className="relative flex items-center justify-end gap-2 border-t border-blue/70 px-3 py-1.5 text-xs font-bold text-mint-deep">
          {t('card.true')}
          <NodeHandle type="source" position={Position.Right} id="true" style={{ background: 'rgb(var(--c-mint-deep))' }} aria-label={t('card.true')} />
        </div>
        <div className="relative flex items-center justify-end gap-2 rounded-b-2xl border-t border-blue/70 px-3 py-1.5 text-xs font-bold text-pink-deep">
          {t('card.false')}
          <NodeHandle type="source" position={Position.Right} id="false" style={{ background: 'rgb(var(--c-pink-deep))' }} aria-label={t('card.false')} />
        </div>
      </div>
    </Shell>
  );
}

const OP_SYMBOL = { set: '=', add: '+=', subtract: '−=' } as const;

function VariableNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'variable'>;
  return (
    <Shell id={id} type="variable" selected={selected}>
      <p className="font-mono text-[13px] font-semibold">{d.variable ? `${d.variable} ${OP_SYMBOL[d.operation]} ${formatValue(d.value)}` : <Muted>{t('card.chooseVar')}</Muted>}</p>
      <Out />
    </Shell>
  );
}

function EventNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'event'>;
  return (
    <Shell id={id} type="event" selected={selected}>
      <p className="font-bold">{d.eventName || <Muted>{t('card.unnamedEvent')}</Muted>}</p>
      {d.params.length > 0 && (
        <ul className="mt-1 space-y-0.5 font-mono text-[12px] text-text-sub">
          {d.params.slice(0, 4).map((p) => (
            <li key={p.id} className="truncate">{p.key || '?'} = {formatValue(p.value)}</li>
          ))}
          {d.params.length > 4 && <li>{t('card.moreParams', { n: d.params.length - 4 })}</li>}
        </ul>
      )}
      <Out />
    </Shell>
  );
}

function EndNode({ id, selected, data }: NodeProps) {
  const t = useT();
  const d = data as unknown as Data<'end'>;
  return (
    <Shell id={id} type="end" selected={selected}>
      <p className="font-bold">{d.endingName || <Muted>{t('card.unnamedEnding')}</Muted>}</p>
    </Shell>
  );
}

export const nodeTypes = {
  start: memo(StartNode),
  dialogue: memo(DialogueNode),
  choice: memo(ChoiceNode),
  condition: memo(ConditionNode),
  variable: memo(VariableNode),
  event: memo(EventNode),
  end: memo(EndNode),
};
