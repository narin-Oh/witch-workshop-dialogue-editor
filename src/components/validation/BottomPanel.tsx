import { selectProject, useEditorStore, type BottomTab } from '../../store/editorStore';
import { useValidation } from './ValidationContext';
import { IconCheck, IconDown, IconError, IconUp, IconWarn } from '../ui/Motifs';
import type { LogEntry } from '../../preview/runner';

const TAB = (active: boolean) => `rounded-t-lg px-3 py-1.5 text-[13px] font-semibold ${active ? 'bg-panel text-primary-deep shadow-[0_-2px_0_0_rgb(var(--c-primary-deep))_inset]' : 'text-text-sub hover:text-text'}`;

const KIND_STYLE: Record<LogEntry['kind'], string> = {
  dialogue: 'bg-primary-soft text-primary-deep', choice: 'bg-yellow-soft text-yellow-deep', condition: 'bg-blue-soft text-blue-deep',
  variable: 'bg-peach-soft text-peach-deep', event: 'bg-pink-soft text-pink-deep', end: 'bg-mauve-soft text-mauve-deep', error: 'bg-pink text-pink-deep',
};

export function BottomPanel() {
  const open = useEditorStore((s) => s.bottomOpen);
  const tab = useEditorStore((s) => s.bottomTab);
  const lastRun = useEditorStore((s) => s.lastRun);
  const nodes = useEditorStore((s) => selectProject(s).graphs.find((g) => g.id === selectProject(s).activeGraphId)?.nodes);
  const { setBottom, focusNode } = useEditorStore.getState();
  const { issues } = useValidation();
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.length - errors.length;
  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const events = lastRun.filter((l) => l.kind === 'event');
  const exists = (id?: string) => !!id && !!nodes?.some((n) => n.id === id);

  const go = (t: BottomTab) => setBottom(true, t);
  return (
    <section aria-label="Validation and logs" className={`flex-none border-t border-line bg-bg/70 ${open ? 'h-48' : 'h-9'} flex flex-col`}>
      <div className="flex items-end gap-1 px-3 pt-1">
        <button type="button" className={TAB(tab === 'validation' && open)} onClick={() => go('validation')}>
          Validation{' '}
          {errors.length > 0 && <span className="ml-1 rounded-full bg-pink px-1.5 text-[11px] text-pink-deep">{errors.length}</span>}
          {warnings > 0 && <span className="ml-1 rounded-full bg-yellow px-1.5 text-[11px] text-yellow-deep">{warnings}</span>}
          {issues.length === 0 && <span className="ml-1 text-mint-deep">✓</span>}
        </button>
        <button type="button" className={TAB(tab === 'events' && open)} onClick={() => go('events')}>
          Preview log{events.length > 0 && <span className="ml-1 rounded-full bg-primary/50 px-1.5 text-[11px] text-primary-deep">{events.length} events</span>}
        </button>
        <button type="button" className="ml-auto rounded-lg p-1 text-text-sub hover:bg-primary-soft" aria-label={open ? 'Collapse panel' : 'Expand panel'} onClick={() => setBottom(!open)}>
          {open ? <IconDown size={16} /> : <IconUp size={16} />}
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-panel px-3 py-2">
          {tab === 'validation' ? (
            issues.length === 0 ? (
              <p className="flex items-center gap-2 text-mint-deep"><IconCheck size={18} /> No problems found. This graph is ready to export.</p>
            ) : (
              <ul className="space-y-1">
                {sorted.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      disabled={!exists(i.nodeId)}
                      onClick={() => i.nodeId && focusNode(i.nodeId)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-[13px] enabled:hover:brightness-95 ${i.severity === 'error' ? 'bg-pink-soft text-pink-deep' : 'bg-yellow-soft text-yellow-deep'}`}
                    >
                      {i.severity === 'error' ? <IconError size={16} className="mt-0.5 flex-none" /> : <IconWarn size={16} className="mt-0.5 flex-none" />}
                      <span className="flex-1">{i.message}</span>
                      {exists(i.nodeId) && <span className="flex-none text-[11px] underline">Show node</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : lastRun.length === 0 ? (
            <p className="text-text-sub">Run a preview to see dialogue, variable changes and triggered events here.</p>
          ) : (
            <ul className="space-y-1 font-mono text-[12px]">
              {lastRun.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`w-20 flex-none rounded px-1.5 text-center text-[11px] font-bold uppercase ${KIND_STYLE[l.kind]}`}>{l.kind}</span>
                  <span className="whitespace-pre-wrap">{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
