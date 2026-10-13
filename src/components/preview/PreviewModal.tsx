import { useT } from '../../i18n';
import { useEffect, useMemo, useState } from 'react';
import { formatValue } from '../../logic/values';
import { activeGraphOf } from '../../logic/projectOps';
import { advance, choose, startPreview, type PreviewState } from '../../preview/runner';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { ValueInput } from '../common/ValueInput';
import { Button, IconButton } from '../ui/primitives';
import { IconBack, IconClose, IconRestart, Leaf, Moon, Ribbon, Sparkle, Star } from '../ui/Motifs';

function Portrait({ speaker, portraitId, expression }: { speaker: string; portraitId: string; expression: string }) {
  const t = useT();
  const initial = (speaker.trim()[0] ?? '?').toUpperCase();
  return (
    <div className="flex w-28 flex-none flex-col items-center gap-1.5 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-panel bg-gradient-to-br from-primary-soft to-pink-soft font-serif text-4xl font-bold text-primary-deep shadow-card">
        {initial}
        <Star size={16} className="absolute -right-1 top-1 text-yellow-deep" />
      </div>
      <div className="text-[11px] leading-tight text-text-sub">
        <div className="truncate font-semibold">{portraitId || t('preview.noPortrait')}</div>
        <div className="truncate italic">{expression || '—'}</div>
      </div>
    </div>
  );
}

function Stage({ state, onNext, onChoose, onRestart, onShowNode }: { state: PreviewState; onNext: () => void; onChoose: (id: string) => void; onRestart: () => void; onShowNode: () => void }) {
  const t = useT();
  if (state.status === 'error') {
    return (
      <div className="m-auto max-w-md rounded-3xl border-2 border-pink bg-pink-soft p-6 text-center text-pink-deep" role="alert">
        <h3 className="font-serif text-lg font-bold">{t('preview.problem')}</h3>
        <p className="mt-2">{state.errorKey ? t(state.errorKey, state.errorParams) : state.error}</p>
        <div className="mt-4 flex justify-center gap-2">
          {state.nodeId && <Button onClick={onShowNode}>{t('preview.showNode')}</Button>}
          <Button onClick={onRestart} icon={<IconRestart size={14} />}>{t('preview.restart')}</Button>
        </div>
      </div>
    );
  }
  if (state.status === 'finished') {
    return (
      <div className="m-auto max-w-md rounded-3xl border-2 border-mauve bg-mauve-soft p-6 text-center">
        <Moon size={28} className="mx-auto text-mauve-deep" />
        <h3 className="mt-1 font-serif text-lg font-bold">{t('preview.end')}</h3>
        <p className="mt-1 text-text-sub">{state.endingName ? <b className="text-text">{t('preview.ending', { name: state.endingName })}</b> : t('preview.finished')}</p>
        <Button className="mt-4" variant="primary" onClick={onRestart} icon={<IconRestart size={14} />}>{t('preview.playAgain')}</Button>
      </div>
    );
  }
  const isChoice = state.status === 'choice';
  if (state.status === 'dialogue' && state.displayMode === 'sceneTransition') return null; // rendered as a black overlay by the session
  return (
    <div className="mt-auto flex flex-col gap-3">
      {isChoice && (
        <ul className="ml-auto flex w-full max-w-lg flex-col gap-2" aria-label={t('preview.choices')}>
          {state.choices.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                autoFocus={i === 0}
                onClick={() => onChoose(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-yellow bg-yellow-soft px-4 py-2.5 text-left font-semibold text-text shadow-card transition hover:-translate-y-0.5 hover:bg-yellow/60"
              >
                <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-yellow text-xs font-bold text-yellow-deep">{i + 1}</span>
                {c.text || <i className="text-text-sub">{t('preview.emptyChoice')}</i>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'dialogue' && state.displayMode === 'narration' && (
        <div className="relative mx-auto w-full max-w-2xl" data-testid="preview-narration">
          <div className="relative rounded-3xl border-[3px] border-dashed border-line bg-panel/90 p-1 shadow-pop">
            <div className="rounded-[20px] px-6 pb-4 pt-6">
              <div className="absolute -top-3 left-6 rounded-full border border-line bg-bg px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-text-sub">{t('preview.modeNarration')}</div>
              <p className="min-h-[3.5rem] whitespace-pre-wrap text-[16px] italic leading-[1.8] text-text">{state.text}</p>
              <div className="mt-2 flex justify-end">
                <Button autoFocus variant="primary" onClick={onNext}>{t('preview.next')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {state.status === 'dialogue' && state.displayMode === 'character' && (
        <div className="relative flex items-end gap-4" data-testid="preview-character">
          <Portrait speaker={state.speaker} portraitId={state.portraitId} expression={state.expression} />
          <div className="relative flex-1 rounded-3xl border-[3px] border-primary bg-panel p-1 shadow-pop">
            <div className="rounded-[20px] border border-line px-5 pb-4 pt-6">
              <div className="absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full border-2 border-primary-deep bg-primary-soft px-4 py-0.5 font-serif text-[15px] font-bold text-primary-deep shadow-card">
                <Sparkle size={14} /> {state.speaker || t('preview.unknownSpeaker')}
              </div>
              <Star size={14} className="absolute right-4 top-3 text-yellow-deep" />
              <p className="min-h-[3.5rem] whitespace-pre-wrap text-[16px] leading-[1.8]">{state.text}</p>
              <div className="mt-2 flex justify-end">
                <Button autoFocus variant="primary" onClick={onNext}>{t('preview.next')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewModal() {
  const open = useEditorStore((s) => s.previewOpen);
  if (!open) return null;
  return <PreviewSession />;
}

function PreviewSession() {
  const t = useT();
  const project = useEditorStore(selectProject);
  const { setPreviewOpen, setOverride, setLastRun, focusNode } = useEditorStore.getState();
  const graph = activeGraphOf(project);
  const [stack, setStack] = useState<PreviewState[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [runId, setRunId] = useState(0);

  // (Re)start whenever the graph, starting values or restart counter change.
  useEffect(() => {
    setStack([startPreview(graph, project.variables, project.previewOverrides)]);
  }, [graph, project.variables, project.previewOverrides, runId]);

  const state = stack[stack.length - 1];
  useEffect(() => {
    if (state) setLastRun(state.log);
  }, [state, setLastRun]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreviewOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPreviewOpen]);

  const first = stack[0];
  const changed = useMemo(() => new Set(state && first ? Object.keys(state.vars).filter((k) => state.vars[k] !== first.vars[k]) : []), [state, first]);
  if (!state) return null;
  const push = (s: PreviewState) => setStack((st) => [...st, s]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={t('preview.aria')}>
      <div className="flex h-[min(720px,92vh)] w-[min(1080px,96vw)] flex-col overflow-hidden rounded-[28px] border border-line bg-bg shadow-pop">
        <header className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
          <Moon size={20} className="text-primary-deep" />
          <h2 className="font-serif text-base font-bold">{t('preview.title', { name: graph.name })}</h2>
          <div className="ml-auto flex items-center gap-1">
            <Button compact icon={<IconBack size={14} />} disabled={stack.length <= 1} onClick={() => setStack((s) => s.slice(0, -1))}>{t('preview.back')}</Button>
            <Button compact icon={<IconRestart size={14} />} onClick={() => setRunId((n) => n + 1)}>{t('preview.restart')}</Button>
            <IconButton label={t('preview.close')} onClick={() => setPreviewOpen(false)}><IconClose size={18} /></IconButton>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-blue-soft via-primary-soft to-pink-soft p-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-primary-deep/25">
              <Star size={18} className="absolute left-10 top-8" /><Star size={12} className="absolute right-24 top-14" /><Moon size={34} className="absolute right-10 top-8" />
              <Leaf size={26} className="absolute bottom-6 right-6" /><Sparkle size={16} className="absolute left-1/3 top-20" />
            </div>
            {state.status === 'dialogue' && state.displayMode === 'sceneTransition' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black px-12 text-center" data-testid="preview-scene">
                <p className="max-w-2xl whitespace-pre-wrap font-serif text-2xl leading-relaxed text-white">{state.text}</p>
                <Button className="mt-10" autoFocus variant="primary" onClick={() => push(advance(graph, state))}>{t('preview.next')}</Button>
                <span className="absolute bottom-3 text-[11px] uppercase tracking-wide text-white/50">{t('preview.modeScene')}</span>
              </div>
            )}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <Stage
                state={state}
                onNext={() => push(advance(graph, state))}
                onChoose={(id) => push(choose(graph, state, id))}
                onRestart={() => setRunId((n) => n + 1)}
                onShowNode={() => { setPreviewOpen(false); if (state.nodeId) focusNode(state.nodeId); }}
              />
            </div>
          </main>
          <aside className="w-80 flex-none overflow-y-auto border-l border-line bg-panel p-3 text-[13px]" aria-label={t('preview.stateAria')}>
            <h3 className="mb-1 font-serif text-sm font-bold">{t('preview.variables')}</h3>
            <ul className="space-y-1">
              {project.variables.map((v) => (
                <li key={v.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${changed.has(v.name) ? 'bg-yellow-soft' : 'bg-bg'}`}>
                  {v.scope === 'global' ? <Ribbon size={14} className="text-yellow-deep" /> : <Leaf size={14} className="text-mint-deep" />}
                  <span className="flex-1 truncate font-mono">{v.name}</span>
                  <span className="font-mono font-bold">{state.vars[v.name] === undefined ? '—' : formatValue(state.vars[v.name]!)}</span>
                </li>
              ))}
              {project.variables.length === 0 && <li className="text-xs italic text-text-sub">{t('preview.noVariables')}</li>}
            </ul>
            <button type="button" className="mt-3 text-xs font-semibold text-primary-deep underline" aria-expanded={showSetup} onClick={() => setShowSetup((v) => !v)}>
              {showSetup ? t('preview.hideStart') : t('preview.editStart')}
            </button>
            {showSetup && (
              <div className="mt-2 space-y-2 rounded-xl border border-line bg-bg p-2">
                <p className="text-xs text-text-sub">{t('preview.startHint')}</p>
                {project.variables.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <span className="w-24 flex-none truncate font-mono text-xs">{v.name}</span>
                    <ValueInput label={t('preview.startValueOf', { name: v.name })} type={v.type} value={v.id in project.previewOverrides ? (project.previewOverrides[v.id] as never) : v.initialValue} onChange={(val) => setOverride(v.id, val)} />
                  </div>
                ))}
                <Button compact onClick={() => project.variables.forEach((v) => setOverride(v.id, undefined))}>{t('preview.resetDefaults')}</Button>
              </div>
            )}
            <h3 className="mb-1 mt-4 font-serif text-sm font-bold">{t('preview.events')}</h3>
            <ul className="space-y-1">
              {state.events.map((e, i) => (
                <li key={i} className="rounded-lg bg-pink-soft px-2 py-1 font-mono text-xs text-pink-deep">
                  {e.name}({Object.entries(e.params).map(([k, v]) => `${k}=${formatValue(v)}`).join(', ')})
                </li>
              ))}
              {state.events.length === 0 && <li className="text-xs italic text-text-sub">{t('preview.noEvents')}</li>}
            </ul>
            <h3 className="mb-1 mt-4 font-serif text-sm font-bold">{t('preview.steps')}</h3>
            <p className="text-xs text-text-sub">{t('preview.stepsText', { n: state.steps })}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
