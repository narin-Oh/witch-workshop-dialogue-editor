import { canRedo, canUndo } from '../../logic/history';
import { activeGraphOf } from '../../logic/projectOps';
import { errorsOf, validateGraph } from '../../logic/validation';
import { pickTextFile, saveTextFile, slugify, type SaveOutcome } from '../../io/files';
import { parseProject, ProjectFileError, serializeProject } from '../../io/projectFile';
import { exportRuntime, runtimeToJson } from '../../io/runtimeExport';
import { getT, useLang, useT } from '../../i18n';
import { selectProject, useEditorStore } from '../../store/editorStore';
import { Button, IconButton } from '../ui/primitives';
import { IconExport, IconOpen, IconPlay, IconRedo, IconSave, IconUndo, Logo, Sparkle } from '../ui/Motifs';

/** Shows the result of a save. Cancelling the dialog is silent: no message, nothing changes. */
function reportSave(outcome: SaveOutcome, savedKey: string, downloadKey: string, params: Record<string, string> = {}): void {
  const t = getT();
  const st = useEditorStore.getState();
  if (outcome.status === 'cancelled') return;
  if (outcome.status === 'failed') st.notify({ kind: 'error', text: t('toast.saveFailed', { reason: outcome.reason }) });
  else st.notify({ kind: 'success', text: t(outcome.status === 'saved' ? savedKey : downloadKey, { ...params, name: outcome.name }) });
}

/** Save the project; the user picks the location and filename where the browser supports it. */
export async function saveProjectFile(): Promise<void> {
  const p = useEditorStore.getState().history.present;
  const outcome = await saveTextFile({
    suggestedName: `${slugify(p.name, 'witch-workshop')}.witchproj.json`,
    text: serializeProject(p),
    description: 'Witch Workshop project',
    extension: '.witchproj.json',
  });
  reportSave(outcome, 'toast.savedAs', 'toast.savedDownload');
}

async function openProjectFile(): Promise<void> {
  const t = getT();
  const st = useEditorStore.getState();
  const f = await pickTextFile();
  if (!f) return;
  try {
    st.loadProject(parseProject(f.text));
    st.notify({ kind: 'success', text: t('toast.opened', { name: f.name }) });
  } catch (e) {
    st.notify({ kind: 'error', text: e instanceof ProjectFileError ? t('toast.openFailed', { reason: t(e.key, e.params) }) : t('toast.openFailedGeneric') });
  }
}

/** Export the active graph for Unity. Blocked while the graph has validation errors. */
export async function exportUnity(): Promise<void> {
  const t = getT();
  const st = useEditorStore.getState();
  const p = st.history.present;
  const g = activeGraphOf(p);
  const issues = validateGraph(g, p.variables);
  const errors = errorsOf(issues);
  if (errors.length) {
    st.setBottom(true, 'validation');
    st.notify({ kind: 'error', text: t('toast.exportBlocked', { n: errors.length }) });
    return;
  }
  const warnings = issues.length;
  if (warnings && !window.confirm(t('confirm.exportWarnings', { n: warnings }))) return;
  let text: string;
  try {
    text = runtimeToJson(exportRuntime(g, p.variables));
  } catch {
    st.notify({ kind: 'error', text: t('toast.exportFailed') });
    return;
  }
  const outcome = await saveTextFile({
    suggestedName: `${slugify(g.name, 'dialogue')}.dialogue.json`,
    text,
    description: 'Witch Workshop dialogue (Unity)',
    extension: '.dialogue.json',
  });
  reportSave(outcome, 'toast.exportedAs', 'toast.exportedDownload', { graph: g.name });
}

export function Toolbar() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const name = useEditorStore((s) => selectProject(s).name);
  const undoable = useEditorStore((s) => canUndo(s.history));
  const redoable = useEditorStore((s) => canRedo(s.history));
  const { renameProject, undo, redo, newProject, loadSamples, setPreviewOpen } = useEditorStore.getState();
  return (
    <header className="flex flex-none items-center gap-3 border-b border-line bg-panel px-4 py-2 shadow-card">
      <div className="flex items-center gap-2">
        <Logo />
        <div className="leading-tight">
          <div className="font-serif text-[15px] font-bold">{t('app.title')}</div>
          <div className="text-[11px] text-text-sub">{t('app.subtitle')}</div>
        </div>
      </div>
      <input
        className="ml-3 w-56 rounded-t-xl border-b-2 border-primary/60 bg-primary-soft/60 px-3 py-1 font-serif text-[14px] font-semibold focus:border-primary-deep focus:bg-primary-soft"
        aria-label={t('toolbar.projectName')}
        value={name}
        onChange={(e) => renameProject(e.target.value)}
      />
      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label={t('toolbar.undo')} onClick={undo} disabled={!undoable}><IconUndo size={18} /></IconButton>
        <IconButton label={t('toolbar.redo')} onClick={redo} disabled={!redoable}><IconRedo size={18} /></IconButton>
        <span className="mx-1 h-6 w-px bg-line" />
        <Button variant="ghost" icon={<Sparkle size={16} />} onClick={() => window.confirm(t('confirm.new')) && newProject()}>{t('toolbar.new')}</Button>
        <Button variant="ghost" icon={<IconOpen size={16} />} onClick={() => void openProjectFile()}>{t('toolbar.open')}</Button>
        <Button variant="ghost" onClick={() => window.confirm(t('confirm.samples')) && loadSamples()}>{t('toolbar.samples')}</Button>
        <Button icon={<IconSave size={16} />} onClick={saveProjectFile}>{t('toolbar.save')}</Button>
        <Button icon={<IconExport size={16} />} onClick={exportUnity}>{t('toolbar.export')}</Button>
        <Button variant="primary" icon={<IconPlay size={16} />} onClick={() => setPreviewOpen(true)}>{t('toolbar.preview')}</Button>
        <span className="mx-1 h-6 w-px bg-line" />
        <div role="group" aria-label={t('lang.label')} className="flex overflow-hidden rounded-xl border border-primary/60 text-xs font-bold">
          {(['ko', 'en'] as const).map((l) => (
            <button key={l} type="button" lang={l} title={t(`lang.${l}`)} aria-pressed={lang === l} onClick={() => setLang(l)} className={`px-2.5 py-1.5 transition ${lang === l ? 'bg-primary-deep text-white' : 'bg-primary-soft text-primary-deep hover:bg-primary/30'}`}>
              {l === 'ko' ? t('lang.ko') : 'EN'}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
